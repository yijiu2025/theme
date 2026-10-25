/**
 * 配色注册表 —— 构建层（加载表 → 注册表）+ 查询层（内核唯一实现）
 *
 * 把 virtual:theme 扫出的三个加载表构建成 Map，键为「包/设备/页面/配色」四段
 * （view ≡ pkg，没有独立版式段）。纯机制、与框架无关，任何前端可复用。
 *
 * 设备段只做形态校验（THEME_ID_RE）—— 设备词汇表是宿主事实，内核不绑定。
 * 配色 id 唯一性作用域 = 同包 × 同设备 × 同页面；跨设备 / 跨包 / 跨页面可同名。
 * 同范围内重名按路径排序先到先得并告警，不静默覆盖。
 */
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  THEME_COLOR_STYLE_FILE,
  THEME_COLORS_SEGMENT,
  THEME_DEF_FILE_CANDIDATES,
  THEME_ID_RE
} from './constants.js';
import type {
  MauthThemeColor,
  MauthThemeMeta,
  MauthThemePackage,
  MauthThemeRecord
} from './types.js';
import { normalizeTone, type ThemeTone } from './scheme.js';

/* ---------------------------------------------------------------------------
 * 构建层
 * ------------------------------------------------------------------------- */

/**
 * 虚拟模块 `virtual:theme` 产出的三个加载表（由 `skinsuite/vite` 的 `themeAssets()`
 * 在构建期扫描生成）。键相对主题包目录 `themes/`（`./<包>/...`）。
 */
export interface ThemeAssetModules {
  /** 包定义：`./<包>/index.ts` */
  packages: Record<string, { default: MauthThemePackage }>;
  /** 配色元信息 + tokens：`./<包>/<设备>/<页面>/colors/<配色>/index.ts` */
  colors: Record<string, { default: MauthThemeColor }>;
  /** 附加样式（惰性，取编译后的 CSS 字符串）：`.../theme.scss` */
  styles: Record<string, () => Promise<string>>;
}

/** 从配色键里取出的归属四段（包 / 设备 / 页面或 part: 命名空间 / 配色） */
interface ColorKeyInfo {
  pkg: string;
  device: string;
  page: string;
  colorId: string;
}

/** 按路径排序后再遍历：让"重名先到先得"与文件系统顺序无关 */
function sortedEntries<T>(mods: Record<string, T>): [string, T][] {
  return Object.entries(mods).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 把文件名转义成正则字面片段（`.` 等字符不当元字符用） */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 包定义入口键的形态：`./<包>/index.ts` **或** `./<包>/index.js`
 * （单一来源 = `THEME_DEF_FILE_CANDIDATES`，扫描侧按同一清单取文件）
 */
const PACKAGE_DEF_KEY_RE = new RegExp(
  `^\\.\\/([^/]+)\\/(?:${THEME_DEF_FILE_CANDIDATES.map(escapeRegExp).join('|')})$`
);

/** 从包定义入口的键里取出包名；不合法返回 null */
function packageFromKey(key: string): string | null {
  const id = key.match(PACKAGE_DEF_KEY_RE)?.[1];
  return id && THEME_ID_RE.test(id) ? id : null;
}

/**
 * 从配色键里取出归属；不合法返回 null
 *
 * 键只有两种形态：
 *   页面配色：./<包>/<设备>/<页面>/colors/<配色>/index.ts
 *   部件配色：./<包>/<设备>/parts/<部件id>/colors/<配色>/index.ts → page 段记 part:<部件id>
 * （冒号对内核只是普通字符；页面名过 THEME_ID_RE 不含冒号，与真实页面名不可能撞。）
 * 🔴 目录结构由 constants.ts 派生，与构建插件 scan() 同源，防「扫得到但解析不出」。
 * 🔴 两种形态按先页面后部件的顺序尝试：页面真叫 parts 的病理键按页面形态归档。
 */
function parseColorKey(
  key: string,
  suffix: string | readonly string[]
): { pkg: string; device: string; page: string; colorId: string } | null {
  // 🔴 多后缀时必须整体包 (?:…)：裸拼 `a|b` 会被 | 劈成「前缀 a」或「b$」两半
  const file = `(?:${(typeof suffix === 'string' ? [suffix] : [...suffix])
    .map(escapeRegExp)
    .join('|')})`;

  // ① 页面形态：四段 + colors 字面段 + 文件
  const pageMatch = key.match(
    new RegExp(`^\\./([^/]+)/([^/]+)/([^/]+)/${THEME_COLORS_SEGMENT}/([^/]+)/${file}$`)
  );
  if (pageMatch) {
    const [, pkg, device, page, colorId] = pageMatch;
    if (themeIdOk(pkg, device, page, colorId)) return { pkg, device, page, colorId };
  }

  // ② 部件形态：包/设备/parts 字面段/部件id + colors + 文件（页段记 part: 命名空间）
  const partMatch = key.match(
    new RegExp(`^\\./([^/]+)/([^/]+)/parts/([^/]+)/${THEME_COLORS_SEGMENT}/([^/]+)/${file}$`)
  );
  if (partMatch) {
    const [, pkg, device, partId, colorId] = partMatch;
    if (themeIdOk(pkg, device, partId, colorId)) {
      return { pkg, device, page: `part:${partId}`, colorId };
    }
  }
  return null;
}

/** 四段目录名全部过字符白名单（部件形态里 page 段是 partId，同一条白名单） */
function themeIdOk(...segments: string[]): boolean {
  return segments.every(seg => !!seg && THEME_ID_RE.test(seg));
}

/**
 * 把三个加载表构建成一张配色注册表
 *
 * @param modules 虚拟模块 `virtual:theme` 的三个加载表
 * @param onWarn  构建期告警回调（可选；内核默认静默以保持零依赖，宿主传 `console.warn`）
 */
export function buildThemeRegistry(
  modules: ThemeAssetModules,
  onWarn: (msg: string) => void = () => {}
): Map<string, MauthThemeRecord> {
  const { packages: packageModules, colors: colorModules, styles: colorStyles } = modules;

  const registry = new Map<string, MauthThemeRecord>();
  /** 包名 → 包定义的版式声明（配色未自带声明时继承它；跨设备共用一份） */
  const packageViews = new Map<string, Record<string, string> | undefined>();

  // 复合键：`包/设备/页面/配色`（四段，避免嵌套 Map 样板）
  const keyOf = (info: ColorKeyInfo): string =>
    `${info.pkg}/${info.device}/${info.page}/${info.colorId}`;

  // ① 包定义：只提供 meta 与可选的 views 声明（不再充当默认配色）
  for (const [key, mod] of sortedEntries(packageModules)) {
    const pkg = packageFromKey(key);
    const def = mod?.default;
    // 目录名不合规、或忘了 export default，都跳过而不是抛错：一个写坏的包不该让整页起不来。
    if (!pkg || !def || typeof def !== 'object' || !def.meta) continue;
    packageViews.set(pkg, def.views);
  }

  // ② 各包下的配色 —— 每条记录都带 pkg + device + page 三段归属
  for (const [key, mod] of sortedEntries(colorModules)) {
    const parsed = parseColorKey(key, THEME_DEF_FILE_CANDIDATES);
    const def = mod?.default;
    if (!parsed || !def || typeof def !== 'object' || !def.meta) continue;
    // 包定义缺失（包本身写坏）：该配色无处可依，跳过
    if (!packageViews.has(parsed.pkg)) continue;
    if (registry.has(keyOf(parsed))) {
      onWarn(
        `[theme] 配色 id「${parsed.colorId}」在「${parsed.pkg}/${parsed.device}/${parsed.page}」内重复` +
          `（${key} 已忽略）：同一个包内的配色 id 必须唯一。`
      );
      continue;
    }
    // 系别：类型上必填，但运行时再兜一次 —— 系别判错的后果是"开夜间不联动"，极难归因。
    const tone = normalizeTone(def.tone);
    if (!tone) {
      onWarn(
        `[theme] 配色「${parsed.colorId}」未声明合法的 tone（light/dark），` +
          `已按 'light' 兜底：${key}`
      );
    }
    registry.set(keyOf(parsed), {
      pkg: parsed.pkg,
      device: parsed.device,
      page: parsed.page,
      meta: { ...def.meta, id: parsed.colorId },
      tone: tone ?? 'light',
      tokens: def.tokens,
      // 配色自己声明了就用自己的，否则继承包定义 —— 包根写一次，全包配色共用
      views: def.views ?? packageViews.get(parsed.pkg),
      loadStyle: undefined
    });
  }

  // ③ 附加样式：按与 ② 相同的键挂上去，避免歧义
  for (const [key, loader] of sortedEntries(colorStyles)) {
    const parsed = parseColorKey(key, THEME_COLOR_STYLE_FILE);
    if (!parsed) continue;
    const record = registry.get(keyOf(parsed));
    // 有 theme.scss 但没 index.ts 的目录视为残缺，忽略其样式
    if (record) record.loadStyle = loader;
  }

  return registry;
}

/* ---------------------------------------------------------------------------
 * 查询层
 *
 * 查询函数都读模块级单例 themeRegistry（主题配色注册表本来就是全局单例），由宿主
 * 启动时调 installThemeRegistry(...) 一次性装入。
 *
 * 索引：回退链与范围查询走惰性索引（WeakMap 按注册表实例缓存，换表自动失效），
 * 各查询 O(1)~O(k)；索引只从 Map 的插入序（= 构建时的路径序）派生，各回退链
 * 「先到先得」的语义与全表扫描一致；精确四段键查询仍是 Map.get。
 * ------------------------------------------------------------------------- */

/** 模块级注册表单例（宿主 `installThemeRegistry` 装入；未装入时为空表，查询走空兜底） */
let themeRegistry: Map<string, MauthThemeRecord> = new Map();

/** 装入一张已构建好的配色注册表（宿主在启动时调一次） */
export function installThemeRegistry(registry: Map<string, MauthThemeRecord>): void {
  themeRegistry = registry;
}

/** 查询索引：一次遍历注册表派生出的全部辅助结构 */
interface RegistryIndex {
  /** 配色 id → 该 id 的全部记录（路径序；findRecord 回退 / toneOfAnyScope / resolveThemeId 用） */
  byColorId: Map<string, MauthThemeRecord[]>;
  /** 作用域键 `pkg/device/page` → 该范围的记录（路径序；范围查询用） */
  byScope: Map<string, MauthThemeRecord[]>;
  /** 作用域键 → id 字母序清单（defaultColorIdOf 用；建索引时排一次，不再每查询 sort） */
  sortedIdsByScope: Map<string, string[]>;
  /** 设备/页面键 `device/page` → 已登记 pkg 集合（listColorViews 用） */
  pkgsByDevicePage: Map<string, Set<string>>;
  /** 设备 → 记录（listThemes 按设备过滤用） */
  byDevice: Map<string, MauthThemeRecord[]>;
}

/** 索引缓存：按注册表实例（WeakMap）—— 换表自动失效，旧索引随 Map 一起 GC */
const indexCache = new WeakMap<Map<string, MauthThemeRecord>, RegistryIndex>();

/** 作用域键：`pkg/device/page`（与 findRecord 的精确四段键同一拼法，去掉末段 id） */
const scopeKeyOf = (pkg: string, device: string, page: string): string =>
  `${pkg}/${device}/${page}`;

function pushTo<K>(map: Map<K, MauthThemeRecord[]>, key: K, record: MauthThemeRecord): void {
  const list = map.get(key);
  if (list) list.push(record);
  else map.set(key, [record]);
}

/** 取注册表的查询索引（首次查询时构建一次，此后 O(1) 命中缓存） */
function registryIndex(registry: Map<string, MauthThemeRecord>): RegistryIndex {
  const cached = indexCache.get(registry);
  if (cached) return cached;

  const idx: RegistryIndex = {
    byColorId: new Map(),
    byScope: new Map(),
    sortedIdsByScope: new Map(),
    pkgsByDevicePage: new Map(),
    byDevice: new Map()
  };
  // Map 迭代 = 插入序 = 构建时的路径序 —— 回退链"先到先得"与旧全表扫描逐字一致
  for (const record of registry.values()) {
    pushTo(idx.byColorId, record.meta.id, record);
    pushTo(idx.byScope, scopeKeyOf(record.pkg, record.device, record.page), record);
    pushTo(idx.byDevice, record.device, record);
    const dpKey = `${record.device}/${record.page}`;
    const pkgs = idx.pkgsByDevicePage.get(dpKey);
    if (pkgs) pkgs.add(record.pkg);
    else idx.pkgsByDevicePage.set(dpKey, new Set([record.pkg]));
  }
  // 排序口径与旧 defaultColorIdOf 的裸 .sort() 一致（码点序，不用 localeCompare）
  for (const [scope, records] of idx.byScope) {
    idx.sortedIdsByScope.set(
      scope,
      records.map(r => r.meta.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    );
  }
  indexCache.set(registry, idx);
  return idx;
}

/**
 * 查找一条配色记录
 *
 * 四段都必须给（包 / 设备 / 页面 / 配色）。回退链：
 *   ① 精确匹配当前包 × 当前设备 × 当前页面（Map.get，O(1)）；
 *   ② 兜底扫描同包（切包后 pkg 还没跟上的那一帧；按 meta.id 走索引候选，
 *      兼容手工装入、键段与 meta.id 不一致的注册表）；
 *   ③ 跨包兜底回默认包（当前包没有这个 id 时）。
 */
function findRecord(
  id: string,
  pkg: string,
  device: string,
  page: string
): MauthThemeRecord | undefined {
  const exact = themeRegistry.get(`${pkg}/${device}/${page}/${id}`);
  if (exact) return exact;
  const candidates = registryIndex(themeRegistry).byColorId.get(id);
  if (!candidates) return undefined;
  const samePkg = candidates.find(r => r.pkg === pkg && r.device === device && r.page === page);
  if (samePkg) return samePkg;
  return pkg !== DEFAULT_THEME_PACKAGE
    ? candidates.find(
        r => r.pkg === DEFAULT_THEME_PACKAGE && r.device === device && r.page === page
      )
    : undefined;
}

/** 某版式下的兜底配色 id：先显式默认色 `white`，没有才退回 id 字母序第一 */
function defaultColorIdOf(device: string, page: string, pkg: string): string | null {
  const ids = registryIndex(themeRegistry).sortedIdsByScope.get(scopeKeyOf(pkg, device, page));
  if (!ids) return null;
  if (ids.includes(DEFAULT_THEME_COLOR)) return DEFAULT_THEME_COLOR;
  return ids[0] ?? null;
}

/** 注册表为空 / 该范围无配色时给一个空记录兜底 */
function emptyRecord(device: string, page: string): MauthThemeRecord {
  return {
    pkg: DEFAULT_THEME_PACKAGE,
    device,
    page,
    meta: { id: DEFAULT_THEME_ID, name: '默认' },
    tone: 'light',
    tokens: undefined,
    views: undefined,
    loadStyle: undefined
  };
}

/** 当前有哪些配色（可选按设备过滤；不传则返回全部） */
export function listThemes(device?: string): MauthThemeMeta[] {
  const records = device
    ? registryIndex(themeRegistry).byDevice.get(device) ?? []
    : [...themeRegistry.values()];
  return records.map(r => r.meta);
}



/**
 * 列出某个包下的全部配色（按 id 去重、按目录名排序）
 *
 * 🔴 排序只按 id 字母序（`black < blue < cyan < rainbow < white`），不给黑白特权。
 * 🔴 view ≡ pkg，所以本函数只列「当前包」下的配色。
 */
export function listColorsOf(device: string, page: string, pkg: string): MauthThemeMeta[] {
  const records = registryIndex(themeRegistry).byScope.get(scopeKeyOf(pkg, device, page)) ?? [];
  const seen = new Map<string, MauthThemeMeta>();
  for (const record of records) {
    if (!seen.has(record.meta.id)) seen.set(record.meta.id, record.meta);
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** 某配色在指定归属下的明暗系别；未登记返回 null */
export function toneOfColor(
  id: string,
  device: string,
  page: string,
  pkg: string
): ThemeTone | null {
  return findRecord(id, pkg, device, page)?.tone ?? null;
}

/** 某配色的系别（任意登记处，路径序第一份）；给"槽归位"这类没有明确范围的场景用 */
export function toneOfAnyScope(id: string): ThemeTone | null {
  return registryIndex(themeRegistry).byColorId.get(id)?.[0]?.tone ?? null;
}

/** 某个版式下、指定系别的全部配色 id（按目录名排序） */
export function listColorIdsOfTone(
  device: string,
  page: string,
  pkg: string,
  tone: ThemeTone
): string[] {
  const records = registryIndex(themeRegistry).byScope.get(scopeKeyOf(pkg, device, page)) ?? [];
  const seen = new Set<string>();
  for (const record of records) {
    if (record.tone !== tone) continue;
    seen.add(record.meta.id);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** 归一化并校验外部传入的配色 id（URL 参数 / 后端下发） */
export function resolveThemeId(
  raw: unknown,
  device?: string,
  page?: string,
  pkg?: string
): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  if (!id || !THEME_ID_RE.test(id)) return null;
  // 候选 = 该 id 的全部登记处（通常 1~几条），替代旧的全表 some() 扫描
  const candidates = registryIndex(themeRegistry).byColorId.get(id);
  if (!candidates || candidates.length === 0) return null;
  if (device === undefined && page === undefined && pkg === undefined) return id;
  return candidates.some(
    r =>
      (!device || r.device === device) &&
      (!page || r.page === page) &&
      (!pkg || r.pkg === pkg)
  )
    ? id
    : null;
}

/**
 * 取配色记录
 *
 * 回退链：指定 id（四段都匹配）→ 同系别首套 → 该范围兜底 → 空记录。
 *
 * 🔴 内核不设「默认设备」（默认设备是哪台是宿主的词汇表），所以 `device` **必填**
 *    （无默认值）。宿主在 re-export 壳里补齐自己的默认设备。
 * 🔴 同理不设「默认页面」：`page` **必填**（页面是宿主的词汇表，内核不认 `login`）。
 *
 * 🔴 命名参数对象（2026-10-17 收口）：此前 `(id, device, pkg, page)` 与宿主
 *    `themeRecordFor(pkg, device, page)` 参数顺序不一致（中间三段对着，但首尾互换），
 *    调用点传错只会有「配色找错范围」这种无从归因的症状。现在改为对象，名字即语义。
 */
export function getThemeRecord(params: {
  id: string;
  device: string;
  pkg?: string;
  page: string;
}): MauthThemeRecord {
  const id = params.id;
  const device = params.device;
  const pkg = params.pkg ?? DEFAULT_THEME_PACKAGE;
  const page = params.page;
  const record = findRecord(id, pkg, device, page);
  if (record) return record;
  const tone = toneOfAnyScope(id);
  if (tone) {
    const sameTone = listColorIdsOfTone(device, page, pkg, tone)[0];
    const sameToneHit = sameTone ? findRecord(sameTone, pkg, device, page) : undefined;
    if (sameToneHit) return sameToneHit;
  }
  const fallback = defaultColorIdOf(device, page, pkg);
  return (fallback && findRecord(fallback, pkg, device, page)) ||
    emptyRecord(device, page);
}

/** 该范围内默认用哪套配色；无配色时返回 null。`page` 必填（页面是宿主的词汇表） */
export function getDefaultThemeId(params: {
  device: string;
  page: string;
  pkg?: string;
}): string | null {
  return defaultColorIdOf(params.device, params.page, params.pkg ?? DEFAULT_THEME_PACKAGE);
}

/** 该配色是否登记过（限定哪几段就要求哪几段匹配） */
export function isKnownTheme(id: unknown, device?: string, page?: string, pkg?: string): boolean {
  return resolveThemeId(id, device, page, pkg) !== null;
}


/** 某设备某页面下有哪些包登记了配色（面板要按包分组） */
export function listColorViews(device: string, page: string): string[] {
  const pkgs = registryIndex(themeRegistry).pkgsByDevicePage.get(`${device}/${page}`);
  return [...(pkgs ?? [])].sort();
}
