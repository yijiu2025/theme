/**
 * 主题域扫描插件 —— themeAssets()（随 skinsuite/vite 发布）
 *
 * 把主题根目录（VITE_THEME_DIR，缺省 src/theme）扫成虚拟模块 virtual:theme，一次产出：
 *   ① 资产：包定义 / 配色 / 附加样式（惰性）/ 版式组件表 themeViews / 部件组件表 themeParts
 *   ② 清单：根目录的 theme.config.ts（调试开关）
 *   ③ 声明：views/*.ts 页面契约（副作用 import 拉齐注册）
 *
 * 本模块被 import 的那一刻自动完成装配（installThemeViews / installThemeParts /
 * installThemeRegistry / installThemeManifest），宿主无需再手动 import 任何声明文件。
 *
 * 根目录内固定三个名字：theme.config.ts（清单）、themes/（包）、views/（页面契约）——
 * 插件在 dir 下再进一层 themes/ 扫包、再进一层 views/ 拉声明。
 *
 * 为什么用虚拟模块而不是 import.meta.glob：glob 模式必须是字面量，「主题目录放在哪」
 * 一旦写进 glob 就再也改不了；扫描搬到构建期后目录路径只是一个 env 变量。
 * 不用 codegen 落盘：落盘产物会 git status 常脏、忘重新生成就静默过期。
 *
 * 容错边界：目录不存在、包写坏、配色缺 tone —— 一律跳过而不是报错（一个写歪的目录
 * 不该让整站起不来），dev 下经 load() 边界去重警告。唯独清单不跳过：写错时
 * defineThemeManifest 启动即抛（「面板不出现」这类症状无从归因）。
 *
 * 运行时走 dist/vite/index.js（vite.config 由 esbuild 预打包后交给 Node 执行），
 * 类型由 exports 的 types 直供源码 —— 宿主消费已发布的包不需要先构建工作区。
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import {
  DEFAULT_THEME_PACKAGE,
  THEME_COLOR_STYLE_FILE,
  THEME_COLORS_SEGMENT,
  THEME_DEF_FILE_CANDIDATES,
  THEME_DIR_LEVELS,
  THEME_PARTS_SEGMENT
} from '../constants.js';
import { DEFAULT_THEME_DIR, DEFAULT_THEME_MANIFEST, THEME_DIR_ENV_KEY, THEME_PACKAGES_SUBDIR, THEME_VIEWS_SUBDIR } from './dir.js';

/** 版式组件的叶子文件名（`themes/<包>/<设备>/<页面>/index.vue`） */
const VIEW_COMPONENT_FILE = 'index.vue';

/** 部件组件的叶子文件名（`themes/<包>/<设备>/parts/<部件id>/index.vue`，与版式同名） */
const PART_COMPONENT_FILE = 'index.vue';

export interface ThemeAssetsPluginOptions {
  /**
   * 主题**根目录**：相对 Vite root 或绝对路径。
   *
   * **推荐省略**：省略时插件在 `configResolved` 里用 Vite 自己加载的 env
   * （`.env` / `.env.<mode>` / `.env.local` / CLI `--env-dir` 的合并结果）读
   * `VITE_THEME_DIR`，未配置则回落 `DEFAULT_THEME_DIR`（`src/theme`）。
   * 相比宿主自己 `loadEnv(mode, root)` 手工读：root 取 `config.root`（权威值，
   * 无 `process.cwd()` 陷阱）、env 分层与 Vite 实际行为天然一致、宿主 config
   * 零参数。显式传入仍用于「同仓多套主题目录」「目录与 env 无关的固定场景」。
   */
  dir?: string;
  /** 虚拟模块 id，缺省 `virtual:theme` */
  moduleId?: string;
  /** 清单文件名，缺省 `theme.config.ts`；设为空串则**不**注入清单 */
  manifestFile?: string;
}

interface ScanEntry {
  key: string;
  file: string;
}

/** 版式组件条目（`themes/<包>/<设备>/<页面>/index.vue`） */
interface ViewEntry {
  /** 包名（内置包判断用） */
  pkg: string;
  /** 页面名（分组用） */
  page: string;
  key: string;
  file: string;
}

/** 部件组件条目（`themes/<包>/<设备>/parts/<部件id>/index.vue`） */
interface PartEntry {
  /** 包名（内置包判断用） */
  pkg: string;
  /** 设备名（部件按 包×设备 分辨实现） */
  device: string;
  /** 部件 id（分组用，`[a-z0-9-]`） */
  partId: string;
  key: string;
  file: string;
}

/**
 * 扫描期「读不到/写歪就跳过」的记录
 *
 * 扫描全程 fail-soft（一个写歪的目录不该让整站起不来），但纯静默会把问题
 * 推给宿主 e2e 关卡大喊。`load()` 边界在 **dev**（`command === 'serve'`）下
 * 把这些记录去重后 `console.warn` —— 构建期零噪音，开发期第一时间看见。
 */
interface SkipNote {
  /** 问题位置（相对主题根目录，正斜杠） */
  path: string;
  /** 跳过原因（一句话，给人看） */
  reason: string;
}

interface ScanResult {
  packages: ScanEntry[];
  colors: ScanEntry[];
  styles: ScanEntry[];
  views: ViewEntry[];
  /** 部件组件（`parts/<id>/index.vue`），按 partId 分组出 `themeParts` */
  parts: PartEntry[];
  /** views/*.ts 页面契约（副作用 import 拉齐注册） */
  decls: ScanEntry[];
  /** 写歪/读不到而被跳过的点（dev 下警告，见 SkipNote） */
  skips: SkipNote[];
}

const DEFAULT_MODULE_ID = 'virtual:theme';

/**
 * 已警告过的跳过点（模块级去重，键 = 位置::原因）
 *
 * dev 下虚拟模块每次失效重建都会重新 `load()` → 重新扫描，不去重会在改主题目录时
 * 刷屏；键按「问题点」记忆，跨 rebuild 稳定，规模上限 = 实际问题数，无需清理。
 */
const warnedSkips = new Set<string>();

/** 目录不存在 / 没有清单时的产出：空注册表 + 空清单（import 本模块即自动装配） */
const EMPTY_MODULE = [
  "import { installThemeRegistry, buildThemeRegistry, resolveThemeManifest, installThemeManifest } from 'skinsuite';",
  "import { installThemeViews, installThemeParts } from 'skinsuite/vue';",
  'export const packages = {};',
  'export const colors = {};',
  'export const styles = {};',
  'export const themeViews = {};',
  'export const themeParts = {};',
  'installThemeViews(themeViews);',
  'installThemeParts(themeParts);',
  'installThemeRegistry(buildThemeRegistry({ packages, colors, styles }));',
  'export const themeManifest = resolveThemeManifest(null);',
  'installThemeManifest(themeManifest);'
].join('\n');

/** 是否为目录；不存在或不可读一律 false（扫描全程"读不到就跳过"） */
function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function subdirs(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** 目录下的 `.ts` 文件（不含 `.d.ts`）；不存在或不可读返回空（读不到就跳过） */
function tsFiles(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      // 🔴 声明是 .ts 源文件不是 .js（曾误写成 .js 导致 decls 恒空、页面静默不注册）
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * 目录内按 `THEME_DEF_FILE_CANDIDATES` 优先级取**第一个存在**的定义文件名
 *
 * 常规宿主是 `index.ts`；**纯 JS 宿主**（无 TS 工具链）可全用 `index.js`。
 * 两种并存时 `.ts` 优先（清单序即优先级，确定性）。返回 undefined = 一个都没有。
 */
function pickDefFile(dir: string): string | undefined {
  for (const name of THEME_DEF_FILE_CANDIDATES) {
    if (existsSync(join(dir, name))) return name;
  }
  return undefined;
}

/**
 * 扫描主题包目录（根目录下的 themes/ 子目录）
 *
 * 目录结构由 constants.ts 契约驱动（THEME_DIR_LEVELS + THEME_COLORS_SEGMENT +
 * THEME_DEF_FILE_CANDIDATES / THEME_COLOR_STYLE_FILE）：walk 按它递归下降，
 * 与注册表的键解析同源，不会有「扫得到但解析不出」的脱节。只认契约里的文件，其余忽略。
 */
function scan(dir: string): ScanResult {
  const packagesDir = join(dir, THEME_PACKAGES_SUBDIR);
  const result: ScanResult = { packages: [], colors: [], styles: [], views: [], parts: [], decls: [], skips: [] };

  for (const pkg of subdirs(packagesDir)) {
    const pkgDir = join(packagesDir, pkg);
    // 包定义：index.ts 优先，纯 JS 宿主可 index.js（键带实际文件名，解析侧同步认）
    const pkgDef = pickDefFile(pkgDir);
    if (pkgDef) {
      result.packages.push({
        key: `./${pkg}/${pkgDef}`,
        file: join(pkgDir, pkgDef)
      });
    } else {
      result.skips.push({
        path: `themes/${pkg}`,
        reason: `缺少 ${THEME_DEF_FILE_CANDIDATES.join(' / ')}（包定义），未进 packages 表；其下版式/配色仍会生效`
      });
    }
    // 按契约递归下降：取值目录段（THEME_DIR_LEVELS）逐层深入，最后在 `colors/`
    // 固定字面段之下收叶子（index.ts / theme.scss）。
    walk(pkgDir, [pkg], result);
  }

  // 声明目录 views/*.ts（页面契约）：插件以副作用 import 拉齐，宿主不必手动 import。
  for (const name of tsFiles(join(dir, THEME_VIEWS_SUBDIR))) {
    result.decls.push({
      key: `./${THEME_VIEWS_SUBDIR}/${name}`,
      file: join(dir, THEME_VIEWS_SUBDIR, name)
    });
  }
  return result;
}

/**
 * 按 `THEME_DIR_LEVELS` 递归下降主题包目录
 *
 * `THEME_DIR_LEVELS = ['pkg','device','page','colorId']`，其中 `pkg` 由 `scan()` 的
 * 外层循环进入，本函数递归「设备 → 页面 → 配色」三段；`colorId` 是最后一个取值段，
 * 它的**父目录**是固定字面段 `colors/`（不是一层取值目录），所以到 `colorId` 这层
 * 不再递归子目录，而是直接在 `colors/<配色>/` 下收叶子文件。
 *
 * @param base     当前目录的绝对路径
 * @param segments 已累积的**取值段**值（与 `THEME_DIR_LEVELS` 前缀一一对应，含包名）
 * @param result   累积产物
 */
function walk(base: string, segments: string[], result: ScanResult): void {
  // 已累积到「包/设备/页面」三段后，下一层是固定字面段 `colors/` + 最后一个取值段 `colorId`。
  // 判定依据 = `THEME_DIR_LEVELS` 里还剩几段未进入：只剩 `colorId` 一段时收叶子。
  if (segments.length === THEME_DIR_LEVELS.length - 1) {
    // 已到「包/设备/页面」层：版式组件（本页 index.vue）+ colors/ 配色
    const viewFile = join(base, VIEW_COMPONENT_FILE);
    if (existsSync(viewFile)) {
      result.views.push({
        pkg: segments[0],
        page: segments[2],
        key: './' + [...segments, VIEW_COMPONENT_FILE].join('/'),
        file: viewFile
      });
    } else {
      result.skips.push({
        path: './' + segments.join('/'),
        reason: `缺少版式组件 ${VIEW_COMPONENT_FILE}，该页无版式可渲染（其下配色仍会注册）`
      });
    }
    const colorsDir = join(base, THEME_COLORS_SEGMENT);
    for (const color of subdirs(colorsDir)) {
      const colorDir = join(colorsDir, color);
      // 键以 `./` 开头（相对主题包目录），段间单斜杠：`./<包>/<设备>/<页面>/colors/<配色>`
      const keyBase = './' + [...segments, THEME_COLORS_SEGMENT, color].join('/');
      // 配色定义同包定义：index.ts 优先、index.js 可用（键带实际文件名）
      const colorDef = pickDefFile(colorDir);
      if (colorDef) {
        result.colors.push({
          key: `${keyBase}/${colorDef}`,
          file: join(colorDir, colorDef)
        });
      } else {
        result.skips.push({
          path: keyBase,
          reason: `缺少 ${THEME_DEF_FILE_CANDIDATES.join(' / ')}（配色定义），该配色未注册`
        });
      }
      if (existsSync(join(colorDir, THEME_COLOR_STYLE_FILE))) {
        result.styles.push({
          key: `${keyBase}/${THEME_COLOR_STYLE_FILE}`,
          file: join(colorDir, THEME_COLOR_STYLE_FILE)
        });
      }
    }
    return;
  }

  // 取值段逐层下降：设备 → 页面。设备层下的 `parts/` 固定字面段分流给 collectParts
  // （部件与页面平级但语义分开：page = 导航表面，part = 复用零件，见 constants.ts）。
  // `.` 开头的目录（.git / 编辑器残留）不是任何合法取值段，静默跳过不递归也不警告。
  for (const name of subdirs(base)) {
    if (name.startsWith('.')) continue;
    if (segments.length === 2 && name === THEME_PARTS_SEGMENT) {
      collectParts(join(base, name), segments, result);
      continue;
    }
    walk(join(base, name), [...segments, name], result);
  }
}

/**
 * 收集一个「包 × 设备」下的全部部件（P1b 部件层，2026-10-23）
 *
 * 目录形态：`parts/<partId>/{index.vue, colors/<配色>/{index.ts, theme.scss}}`
 *   · `index.vue`   → parts 条目（键含 parts 段，`themeParts` 按部件 id 分组）
 *   · `colors/…`    → colors/styles 条目（**部件形状的键**：多一个 parts 段；
 *     注册表按 parts 解析器归到 `page = 'part:<partId>'` 命名空间，复用现有回退链）
 * 与页面层的口径一致：目录名走 `THEME_ID_RE`（不合规静默跳过，一个写歪的部件目录
 * 不该让整站起不来）；叶子文件名与页面共用 `index.ts` / `theme.scss` / `index.vue`。
 */
function collectParts(partsDir: string, segments: string[], result: ScanResult): void {
  const [pkg, device] = segments;
  for (const partId of subdirs(partsDir)) {
    const partDir = join(partsDir, partId);

    // 部件实现：`parts/<id>/index.vue`（default 包 eager，其余惰性——与页面版式同口径）
    const partFile = join(partDir, PART_COMPONENT_FILE);
    if (existsSync(partFile)) {
      result.parts.push({
        pkg,
        device,
        partId,
        key: './' + [...segments, THEME_PARTS_SEGMENT, partId, PART_COMPONENT_FILE].join('/'),
        file: partFile
      });
    } else {
      result.skips.push({
        path: './' + [...segments, THEME_PARTS_SEGMENT, partId].join('/'),
        reason: `缺少部件组件 ${PART_COMPONENT_FILE}，该部件无实现可渲染`
      });
    }

    // 部件配色（可选）：`parts/<id>/colors/<配色>/{index.ts, theme.scss}`
    // 键是部件形状（多一个 parts 段），注册表用 parts 解析器识别
    const colorsDir = join(partDir, THEME_COLORS_SEGMENT);
    for (const color of subdirs(colorsDir)) {
      const colorDir = join(colorsDir, color);
      const keyBase =
        './' + [...segments, THEME_PARTS_SEGMENT, partId, THEME_COLORS_SEGMENT, color].join('/');
      const colorDef = pickDefFile(colorDir);
      if (colorDef) {
        result.colors.push({
          key: `${keyBase}/${colorDef}`,
          file: join(colorDir, colorDef)
        });
      }
      if (existsSync(join(colorDir, THEME_COLOR_STYLE_FILE))) {
        result.styles.push({
          key: `${keyBase}/${THEME_COLOR_STYLE_FILE}`,
          file: join(colorDir, THEME_COLOR_STYLE_FILE)
        });
      }
    }
  }
}

/** 绝对路径 → 模块说明符（root 内用 `/xxx`，root 外用正斜杠绝对路径） */
function toSpecifier(abs: string, root: string): string {
  const absolute = resolve(abs);
  const base = resolve(root);
  if (absolute.startsWith(base + sep)) {
    return assertSafeModuleSpec('/' + absolute.slice(base.length + 1).split(sep).join('/'));
  }
  return assertSafeModuleSpec(absolute.split(sep).join('/'));
}

/**
 * 模块说明符安全断言（纵深防御）：说明符会以 `import(<spec>)` 形式进入生成的
 * 虚拟模块代码。路径来自本插件构建期对宿主仓内主题目录的扫描，`JSON.stringify`
 * 已做字面量转义；这层断言锁定形态 —— 引号 / 反引号 / 反斜杠 / 尖括号 / 控制字符
 * 一律拒绝，杜绝任何把路径变成可执行载荷的可能。
 */
function assertSafeModuleSpec(spec: string): string {
  if (/["'`\\<>]|\r|\n|\u0000/.test(spec)) {
    throw new Error(`[theme] 模块说明符含不允许的字符，已拒绝生成 import：${spec}`);
  }
  return spec;
}

/**
 * 渲染一张「按分组键组织的组件加载表」（themeViews / themeParts 共用同一形态）
 *
 * 形态契约（两表**逐字一致**，此前是两段近似重复的拼接代码，2026-10-24 收拢）：
 * - 内置包（DEFAULT_THEME_PACKAGE）的条目先做**静态 import**，表内用**同步返回**
 *   `` () => __<tag>N `` —— `ViewRegistry.builtin()` 要首帧零请求拿到内置包版式，不闪屏；
 * - 其余包**惰性**：`() => import(spec)`，按需加载；
 * - 分组键 = 页面名（themeViews）/ 部件 id（themeParts），组内顺序 = 扫描顺序。
 *
 * @param lines      输出行缓冲（import 行与表体一并追加，保持「先 import 后表」）
 * @param entries    组件条目（views 或 parts）
 * @param groupOf    取分组键（entry.page / entry.partId）
 * @param exportName 导出名（'themeViews' | 'themeParts'）
 * @param tag        静态 import 的临时命名空间前缀（'view' | 'part'）
 * @param root       toSpecifier 用的工程根
 */
function renderLoaderTable<T extends { key: string; file: string; pkg: string }>(
  lines: string[],
  entries: T[],
  groupOf: (entry: T) => string,
  exportName: 'themeViews' | 'themeParts',
  tag: 'view' | 'part',
  root: string
): void {
  const builtin = entries.filter(entry => entry.pkg === DEFAULT_THEME_PACKAGE);
  builtin.forEach((entry, index) => {
    lines.push(`import * as __${tag}${index} from ${JSON.stringify(toSpecifier(entry.file, root))};`);
  });
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = groupOf(entry);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  lines.push(`export const ${exportName} = {`);
  for (const [group, grouped] of groups) {
    lines.push(`  ${JSON.stringify(group)}: {`);
    grouped.forEach(entry => {
      if (entry.pkg === DEFAULT_THEME_PACKAGE) {
        const idx = builtin.indexOf(entry);
        lines.push(`    ${JSON.stringify(entry.key)}: () => __${tag}${idx},`);
      } else {
        // codeql[js/bad-code-sanitization] : 值是本插件构建期扫描宿主仓主题目录得到的文件路径，
        // JSON.stringify 做的是字符串字面量转义（codegen 的正确编码），且 toSpecifier 内有
        // assertSafeModuleSpec 白名单断言 —— 非外部输入，豁免。
        const spec = JSON.stringify(toSpecifier(entry.file, root));
        lines.push(`    ${JSON.stringify(entry.key)}: () => import(${spec}),`);
      }
    });
    lines.push('  },');
  }
  lines.push('};');
}

/** 生成虚拟模块源码 */
function render(result: ScanResult, root: string, manifestSpec: string | null): string {
  const lines: string[] = [
    // 装配依赖（纯内核机制）：本模块被 import 时自动装注册表 + 解析清单单例
    "import { installThemeRegistry, buildThemeRegistry, resolveThemeManifest, installThemeManifest } from 'skinsuite';",
    // 版式/部件加载表单例（Vue 绑定层）：本模块体把 themeViews / themeParts 装进内核单例
    "import { installThemeViews, installThemeParts } from 'skinsuite/vue';",
    manifestSpec
      ? `import { default as __manifest } from ${JSON.stringify(manifestSpec)};`
      : 'const __manifest = null;',
    // 声明文件副作用 import（views/*.ts）：拉齐 defineThemePage 页面注册。
    // 🔴 必须是 import 语句（ESM 全部提升到模块体之前执行），且在 installThemeViews 之前；
    //    页面契约是惰性解析 loader，不读 themeViews —— 不会构成循环。
    ...result.decls.map(entry => `import ${JSON.stringify(toSpecifier(entry.file, root))};`),
    ''
  ];

  const emit = (entries: ScanEntry[], exportName: 'packages' | 'colors'): void => {
    entries.forEach((entry, index) => {
      lines.push(
        `import * as __${exportName}${index} from ${JSON.stringify(toSpecifier(entry.file, root))};`
      );
    });
    lines.push(`export const ${exportName} = {`);
    entries.forEach((entry, index) => {
      lines.push(`  ${JSON.stringify(entry.key)}: __${exportName}${index},`);
    });
    lines.push('};');
  };

  emit(result.packages, 'packages');
  emit(result.colors, 'colors');

  lines.push('export const styles = {');
  result.styles.forEach((entry, index) => {
    // codeql[js/bad-code-sanitization] : 同上——构建期自扫描路径 + 字面量转义 + 白名单断言，非外部输入。
    const spec = JSON.stringify(toSpecifier(entry.file, root) + '?inline');
    lines.push(
      `  ${JSON.stringify(entry.key)}: () => import(${spec}).then(__m${index} => __m${index}.default),`
    );
  });
  lines.push('};');

  // ---- themeViews / themeParts：组件加载表（按页面 / 部件 id 分组；内置包 eager、其余惰性）----
  // 🔴 内置包用**同步返回**（`() => __viewN`，eager 静态 import 的模块命名空间），
  //    这样 `ViewRegistry.builtin()` 才能首帧同步拿到内置包版式（零请求、不闪屏）。
  renderLoaderTable(lines, result.views, entry => entry.page, 'themeViews', 'view', root);
  renderLoaderTable(lines, result.parts, entry => entry.partId, 'themeParts', 'part', root);

  // ---- 装配副作用 + 清单单例（import 本模块即自动装版式/部件加载表 + 注册表 + 清单）----
  lines.push('installThemeViews(themeViews);');
  lines.push('installThemeParts(themeParts);');
  lines.push('installThemeRegistry(buildThemeRegistry({ packages, colors, styles }));');
  lines.push('export const themeManifest = resolveThemeManifest(__manifest);');
  lines.push('installThemeManifest(themeManifest);');

  return lines.join('\n');
}

/**
 * 主题域插件
 *
 * @example
 * ```ts
 * // vite.config.ts —— 目录缺省走 env VITE_THEME_DIR（无 env 则 src/theme）
 * import { themeAssets } from 'skinsuite/vite';
 *
 * export default defineConfig({
 *   plugins: [themeAssets(), vue()]
 * });
 * ```
 */
export function themeAssets(options: ThemeAssetsPluginOptions = {}): Plugin {
  const moduleId = options.moduleId ?? DEFAULT_MODULE_ID;
  const virtualId = '\0' + moduleId;
  const manifestFile = options.manifestFile ?? DEFAULT_THEME_MANIFEST;
  let root = process.cwd();
  // dev server / vitest 下 command === 'serve'：跳过警告只在开发期喊，构建期零噪音
  let dev = false;
  // 目录先按「显式传入或默认值」定型；未显式传 dir 时 configResolved 会用
  // Vite 已加载的 env（VITE_THEME_DIR）重解析 —— load/configureServer 都在其后，时序安全。
  let themeDir = options.dir || DEFAULT_THEME_DIR;
  const resolveDir = (): string => resolve(root, themeDir);

  /** dev 下把扫描跳过点去重后警告（前缀与内核一致的 `[theme]`） */
  const warnSkips = (skips: SkipNote[]): void => {
    if (!dev) return;
    for (const note of skips) {
      const dedupeKey = `${note.path}::${note.reason}`;
      if (warnedSkips.has(dedupeKey)) continue;
      warnedSkips.add(dedupeKey);
      console.warn(`[theme] 扫描跳过 ${note.path}：${note.reason}`);
    }
  };

  return {
    name: 'skinsuite:theme-assets',
    // 虚拟模块要抢在 Vite 的内置解析之前
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      dev = config.command === 'serve';
      if (!options.dir) {
        const configured = (config.env[THEME_DIR_ENV_KEY] ?? '').trim();
        themeDir = configured || DEFAULT_THEME_DIR;
      }
    },

    resolveId(id) {
      return id === moduleId ? virtualId : null;
    },

    load(id) {
      if (id !== virtualId) return null;
      const dir = resolveDir();
      // 根目录不存在 = 还没建主题，给**空注册表 + 空清单**而不是让应用起不来
      if (!isDir(dir)) return { code: EMPTY_MODULE, map: null };

      const manifestPath = manifestFile ? join(dir, manifestFile) : '';
      const manifestSpec = manifestPath && existsSync(manifestPath)
        ? toSpecifier(manifestPath, root)
        : null;

      const scanned = scan(dir);
      warnSkips(scanned.skips);
      // 返回 { code, map } 形态（而非裸字符串）：map 显式为 null = 声明「无 sourcemap」，
      // 虚拟模块内的运行时报错行号不再参与任何 map 推断；将来要挂真 map 也不用改契约。
      return { code: render(scanned, root, manifestSpec), map: null };
    },

    configureServer(server) {
      const dir = resolveDir();
      // 主题目录在 Vite root **之外**时，chokidar 默认只 watch root —— 必须显式加进来，
      // 否则增删主题目录的事件永远收不到（monorepo 里目录指到别的包下时就是这种形态）。
      server.watcher.add(dir);
      // 路径归一比较：盘符大小写在 Windows 上不稳定（C: / c:），统一小写 + 正斜杠；
      // 前缀带分隔符 —— 不带的话 `D:/theme` 会误匹配 `D:/theme-other` 下的文件。
      const normPrefix = dir.split(sep).join('/').toLowerCase() + '/';
      const underThemeDir = (file: string): boolean =>
        file.split(sep).join('/').toLowerCase().startsWith(normPrefix);
      const onChange = (file: string): void => {
        if (!underThemeDir(file)) return;
        const mod = server.moduleGraph.getModuleById(virtualId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      // 只监听**增删**：新增/删除主题目录或清单会改变虚拟模块的导出面；
      // 改已有文件的内容由 HMR 自己处理（那是普通模块，不必重建清单）。
      // add/unlink 覆盖文件级增删，addDir/unlinkDir 覆盖目录级增删
      // （删除整个配色目录时只发 unlinkDir，没有它这条刷新会漏）。
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
      server.watcher.on('addDir', onChange);
      server.watcher.on('unlinkDir', onChange);
    }
  };
}
