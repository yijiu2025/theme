/**
 * 主题（配色）注册表 —— **构建层 + 查询层**（内核唯一实现）
 *
 * 把「虚拟模块 `virtual:theme` 扫出来的三个加载表」构建成一张可查询的注册表，
 * 并提供全部查询函数。原先这两层住在宿主（`oauth21/src/theme/{registry,index}.ts`），
 * 2026-10-17 下沉到内核 —— 它们是「主题配色」的**纯机制**，与业务、与框架都无关，
 * 任何前端（Vue / React / SSR）都能复用。
 *
 * === 为什么能下沉、设备白名单怎么处理 ===
 * 构建层的唯一「宿主事实」是**设备取值集合**（哪些目录名算合法设备）。内核不绑定
 * 某个应用的设备词汇表（见 `constants.ts` 的说明），所以 `buildRegistry` 把它收成
 * **参数** `isKnownDevice(raw): boolean` —— 宿主把自己的 `asThemeDevice` 或设备清单
 * 传进来，内核据此判断「设备段是否合法」。
 *
 * === 目录骨架（唯一形态）===
 * ```
 * themes/<包>/<设备>/<页面>/colors/<配色>/{index.ts, theme.scss}
 * ```
 * 一个主题包 = 一种版式（`view ≡ pkg`），所以配色键是「包/设备/页面/配色」**四段**，
 * 没有独立的「版式」段。目录结构契约见 `constants.ts` 的 `THEME_DIR_LEVELS` /
 * `THEME_COLORS_SEGMENT` / `THEME_COLOR_*`。
 *
 * === 键的唯一性作用域 ===
 * 配色 id 唯一性作用域 = 「同包 × 同设备 × 同页面」。跨设备 / 跨包 / 跨页面可以同名
 * （同名 ≠ 冲突：取一份配色时这三段必然同时给出）。同范围内重名按路径排序先到先得
 * 并告警，不静默覆盖。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme 下沉）
 */
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  DEFAULT_THEME_PAGE,
  THEME_COLOR_DEF_FILE,
  THEME_COLOR_STYLE_FILE,
  THEME_COLORS_SEGMENT,
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

/** 从配色键里取出的归属四段（包 / 设备 / 页面 / 配色） */
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

/** 从包定义入口的键里取出包名；不合法返回 null */
function packageFromKey(key: string): string | null {
  const id = /^\.\/([^/]+)\/index\.ts$/.exec(key)?.[1];
  return id && THEME_ID_RE.test(id) ? id : null;
}

/**
 * 从配色键里取出归属；不合法返回 null
 *
 * 目录只有**一种**形态（见文件头）：
 *   `./themes/<包>/<设备>/<页面>/colors/<配色>/index.ts`
 * 设备段由宿主注入的 `isKnownDevice` 判断（内核不认设备词汇表）。
 *
 * 🔴 目录结构（`colors` 固定字面段 + 文件名）由 `constants.ts` 派生，与构建插件
 *    `scan()` 共享同一来源，避免"扫得到但解析不出"的静默脱节。
 */
function colorFromKey(
  key: string,
  suffix: string
): ColorKeyInfo | null {
  const file = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `^\\./([^/]+)/([^/]+)/([^/]+)/${THEME_COLORS_SEGMENT}/([^/]+)/${file}$`
  );
  const m = re.exec(key);
  if (!m) return null;
  const pkg = m[1];
  const device = m[2];
  const page = m[3];
  const colorId = m[4];
  if (!pkg || !device || !page || !colorId) return null;
  // 设备段也走字符白名单（设备词汇表已收进库内设备域，这里只挡"目录名不是合法 id"；
  // 字符合法但未声明的设备目录会被扫进注册表，但查询按设备 id 取、永不命中，无害）。
  if (
    !THEME_ID_RE.test(pkg) ||
    !THEME_ID_RE.test(device) ||
    !THEME_ID_RE.test(page) ||
    !THEME_ID_RE.test(colorId)
  )
    return null;
  // 一个主题包 = 一种版式 ⇒ 配色归属只到包段（view ≡ pkg，不再单列一段）
  return { pkg, device, page, colorId };
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
    const parsed = colorFromKey(key, THEME_COLOR_DEF_FILE);
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
    const parsed = colorFromKey(key, THEME_COLOR_STYLE_FILE);
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
 * 查询函数都读**模块级单例 `themeRegistry`**（主题配色注册表本来就是全局单例）。
 * 由宿主在启动时调 `installThemeRegistry(buildThemeRegistry(...))` 一次性装入，
 * 之后所有查询函数直接可用 —— 与宿主旧实现「`export const registry = buildRegistry()`」
 * 同一形态，`export function` 签名不变，断言与调用点几乎不用改。
 * ------------------------------------------------------------------------- */

/** 模块级注册表单例（宿主 `installThemeRegistry` 装入；未装入时为空表，查询走空兜底） */
let themeRegistry: Map<string, MauthThemeRecord> = new Map();

/** 装入一张已构建好的配色注册表（宿主在启动时调一次） */
export function installThemeRegistry(registry: Map<string, MauthThemeRecord>): void {
  themeRegistry = registry;
}

/**
 * 查找一条配色记录
 *
 * 四段都必须给（包 / 设备 / 页面 / 配色）。回退链：
 *   ① 精确匹配当前包 × 当前设备 × 当前页面；
 *   ② 兜底扫描同包（切包后 pkg 还没跟上的那一帧）；
 *   ③ 跨包兜底回默认包（当前包没有这个 id 时）。
 */
function findRecord(
  id: string,
  pkg: string,
  device: string,
  page: string
): MauthThemeRecord | undefined {
  return themeRegistry.get(`${pkg}/${device}/${page}/${id}`) ??
    [...themeRegistry.values()].find(
      r => r.meta.id === id && r.device === device && r.page === page && r.pkg === pkg
    ) ??
    (pkg !== DEFAULT_THEME_PACKAGE
      ? [...themeRegistry.values()].find(
          r => r.meta.id === id && r.device === device && r.page === page && r.pkg === DEFAULT_THEME_PACKAGE
        )
      : undefined);
}

/** 某版式下的兜底配色 id：先显式默认色 `white`，没有才退回 id 字母序第一 */
function defaultColorIdOf(device: string, page: string, pkg: string): string | null {
  const ids = [...themeRegistry.values()]
    .filter(r => r.device === device && r.page === page && r.pkg === pkg)
    .map(r => r.meta.id)
    .sort();
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
  const records = [...themeRegistry.values()];
  return (device ? records.filter(r => r.device === device) : records).map(r => r.meta);
}



/**
 * 列出某个包下的全部配色（按 id 去重、按目录名排序）
 *
 * 🔴 排序只按 id 字母序（`black < blue < cyan < rainbow < white`），不给黑白特权。
 * 🔴 view ≡ pkg，所以本函数只列「当前包」下的配色。
 */
export function listColorsOf(device: string, page: string, pkg: string): MauthThemeMeta[] {
  const seen = new Map<string, MauthThemeMeta>();
  for (const record of themeRegistry.values()) {
    if (record.device !== device || record.page !== page) continue;
    if (record.pkg !== pkg) continue;
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

/** 某配色的系别（任意登记处）；给"槽归位"这类没有明确范围的场景用 */
export function toneOfAnyScope(id: string): ThemeTone | null {
  for (const record of themeRegistry.values()) {
    if (record.meta.id === id) return record.tone;
  }
  return null;
}

/** 某个版式下、指定系别的全部配色 id（按目录名排序） */
export function listColorIdsOfTone(
  device: string,
  page: string,
  pkg: string,
  tone: ThemeTone
): string[] {
  const seen = new Set<string>();
  for (const record of themeRegistry.values()) {
    if (record.device !== device || record.page !== page || record.pkg !== pkg) continue;
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
  const match = (record: MauthThemeRecord): boolean =>
    record.meta.id === id &&
    (!device || record.device === device) &&
    (!page || record.page === page) &&
    (!pkg || record.pkg === pkg);
  return [...themeRegistry.values()].some(match) ? id : null;
}

/**
 * 取配色记录
 *
 * 回退链：指定 id（四段都匹配）→ 同系别首套 → 该范围兜底 → 空记录。
 *
 * 🔴 内核不设「默认设备」（默认设备是哪台是宿主的词汇表），所以 `device` **必填**
 *    （无默认值）。宿主在 re-export 壳里补齐自己的默认设备。
 *
 * 🔴 命名参数对象（2026-10-17 收口）：此前 `(id, device, pkg, page)` 与宿主
 *    `themeRecordFor(pkg, device, page)` 参数顺序不一致（中间三段对着，但首尾互换），
 *    调用点传错只会有「配色找错范围」这种无从归因的症状。现在改为对象，名字即语义。
 */
export function getThemeRecord(params: {
  id: string;
  device: string;
  pkg?: string;
  page?: string;
}): MauthThemeRecord {
  const id = params.id;
  const device = params.device;
  const pkg = params.pkg ?? DEFAULT_THEME_PACKAGE;
  const page = params.page ?? DEFAULT_THEME_PAGE;
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

/** 该范围内默认用哪套配色；无配色时返回 null */
export function getDefaultThemeId(params: {
  device: string;
  page?: string;
  pkg?: string;
}): string | null {
  return defaultColorIdOf(params.device, params.page ?? DEFAULT_THEME_PAGE, params.pkg ?? DEFAULT_THEME_PACKAGE);
}

/** 该配色是否登记过（限定哪几段就要求哪几段匹配） */
export function isKnownTheme(id: unknown, device?: string, page?: string, pkg?: string): boolean {
  return resolveThemeId(id, device, page, pkg) !== null;
}


/** 某设备某页面下有哪些包登记了配色（面板要按包分组） */
export function listColorViews(device: string, page: string): string[] {
  return [
    ...new Set(
      [...themeRegistry.values()]
        .filter(r => r.device === device && r.page === page)
        .map(r => r.pkg)
    )
  ].sort();
}
