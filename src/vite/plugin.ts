/**
 * 主题域扫描插件 —— **主题库自带的 Vite 适配器**（随 `skinsuite/vite` 一起发布）
 *
 * 把 `VITE_THEME_DIR` 指向的**主题根目录**扫成一个虚拟模块 `virtual:theme`，它同时产出两样东西：
 *
 *   ① **资产**：主题包定义、配色元信息、配色附加样式（惰性）
 *   ② **清单**：根目录里那份 `theme.config.ts`（调试开关 + 路由投影，见 `defineThemeManifest`）
 *
 * === 目录口径：`VITE_THEME_DIR` 是「主题根目录」，不是「主题包目录」===
 * 根目录内固定三个名字（约定俗成，换根目录位置时整包跟着走）：
 *   `theme.config.ts`  清单
 *   `themes/`          主题包目录（本插件扫这里）
 *   `views/`           版式契约目录（不扫，由 `views/*.ts` 自己的 glob 负责）
 * 所以本插件在 `dir` 下**再进一层 `themes/`** 扫包，清单则从 `dir` 根层读。
 *
 * === 为什么它放在库里（而非让每个宿主各写一份）===
 * 它是主题机制的**构建期半边**：内核负责契约（`ThemeManifest` / `ThemeRouteRule`），
 * 这里负责扫描。没有它，「主题目录是配置项」就只实现了一半 —— 每个宿主都得
 * 自己抄一遍一百多行的扫描逻辑，正是"库不够强大"的典型症状。
 *
 * `vite.config.ts` 由 Vite 用 esbuild 预打包后执行，裸包说明符会被当外部依赖交给
 * Node `import()`。因此本入口**刻意用 subpath export 指向源码 `.ts`**（而非 `dist/`），
 * 与 `skinsuite/vue` 同一手法：Vite 自己能转译 TS，源码直供就绕开了
 * "包必须先构建 dist 才能被 config 引用"的脆弱前提（CI 里 `npm ci` 不会构建工作区包）。
 *
 * === 它解决的问题 ===
 * `import.meta.glob` 的模式必须是**字面量**（Vite 在编译期静态展开），所以
 * 「主题目录放在哪」一旦写进 glob 就再也改不了 —— 想换目录只能改源码。
 * 本插件把扫描搬到构建期（Node 侧 `fs`），用**虚拟模块**把结果喂给运行时，
 * 于是目录路径变成 `VITE_THEME_DIR` 这一个环境变量。
 *
 * === 产出形态（资产部分与 `import.meta.glob` 的结果保持一致）===
 * ```ts
 * export const packages: { './default/index.ts': Module }
 * export const colors:   { './default/mobile/login/colors/white/index.ts': Module }
 * export const styles:   { './default/mobile/login/colors/white/theme.scss': () => Promise<string> }
 * export { default as manifest } from '/src/theme/theme.config.ts'
 * ```
 * 资产键**相对主题包目录**（`themes/`，`./` 开头），值保持「模块命名空间」而非默认导出 ——
 * 这样宿主注册表代码一行都不用改（它按「包/设备/页面/配色」四段解析键）。`styles` 是
 * **惰性**的（`?inline` 动态 import），背景图与字体不会进首屏包。
 *
 * === 为什么不用 codegen 落盘 ===
 * 生成物入库有两个麻烦：`git status` 常脏、以及"忘了重新生成"导致的静默过期。
 * 虚拟模块没有落盘产物，改一个目录下次请求就是新的。
 *
 * === 容错的边界 ===
 * 目录不存在、包写坏、配色缺 `tone` —— 一律**跳过而不是报错**：一个写歪的目录不该
 * 让整站起不来。目录口径的问题由宿主的关卡负责大喊。
 * **唯独清单不跳过**：它一旦写错，`defineThemeManifest` 会在启动时直接抛，
 * 因为「面板不出现」「路由推不出页面」这类症状根本无从归因。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import {
  THEME_COLOR_DEF_FILE,
  THEME_COLOR_STYLE_FILE,
  THEME_COLORS_SEGMENT,
  THEME_DIR_LEVELS,
  THEME_PACKAGE_DEF_FILE
} from '../constants.ts';
import { DEFAULT_THEME_MANIFEST, THEME_PACKAGES_SUBDIR } from './dir.ts';

export interface ThemeAssetsPluginOptions {
  /** 主题**根目录**：相对 Vite root 或绝对路径（通常来自 `resolveThemeDir()`，已是绝对路径） */
  dir: string;
  /** 虚拟模块 id，缺省 `virtual:theme` */
  moduleId?: string;
  /** 清单文件名，缺省 `theme.config.ts`；设为空串则**不**注入清单 */
  manifestFile?: string;
}

interface ScanEntry {
  key: string;
  file: string;
}

interface ScanResult {
  packages: ScanEntry[];
  colors: ScanEntry[];
  styles: ScanEntry[];
}

const DEFAULT_MODULE_ID = 'virtual:theme';

/** 目录不存在 / 没有清单时的产出：空注册表 + 空清单 */
const EMPTY_MODULE = [
  'export const packages = {};',
  'export const colors = {};',
  'export const styles = {};',
  'export const manifest = null;'
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

/**
 * 扫描主题**包目录**（根目录下的 `themes/` 子目录）
 *
 * `dir` 是主题根目录（`VITE_THEME_DIR`），真正的包住在 `dir/themes/` 下 ——
 * 这个子目录名固定，宿主 `views/*.ts` 的 `import.meta.glob` 字面量也认它，两边靠名字对齐。
 *
 * === 目录结构由内核契约驱动，而非手写嵌套 for（2026-10-17）===
 * 「包 / 设备 / 页面 / colors / 配色」这五段里，`colors` 是**固定字面段**、其余四段
 * 是**取值段**（取值由文件系统与宿主设备清单决定，本插件不认识具体值）。这段结构的
 * 唯一来源是 `constants.ts` 的 `THEME_DIR_LEVELS`（取值目录段）+ `THEME_COLORS_SEGMENT`
 * （固定字面段）+ `THEME_COLOR_DEF_FILE` / `THEME_COLOR_STYLE_FILE`（叶子文件）。
 * 本函数用 `walk` 按 `THEME_DIR_LEVELS` 做**通用递归下降**——目录加一层、或 `colors`
 * 改名，只动那一份契约，这里与注册表的 `colorFromKey()` 一起跟着变，不再有
 * "扫得到但解析不出"或反之的静默脱节。
 *
 * 只认内核约定的三种文件，其余一律忽略（清单文件住在根层，不在 `themes/` 里，天然不进这里）。
 */
function scan(dir: string): ScanResult {
  const packagesDir = join(dir, THEME_PACKAGES_SUBDIR);
  const result: ScanResult = { packages: [], colors: [], styles: [] };

  for (const pkg of subdirs(packagesDir)) {
    const pkgDir = join(packagesDir, pkg);
    if (existsSync(join(pkgDir, THEME_PACKAGE_DEF_FILE))) {
      result.packages.push({
        key: `./${pkg}/${THEME_PACKAGE_DEF_FILE}`,
        file: join(pkgDir, THEME_PACKAGE_DEF_FILE)
      });
    }
    // 按契约递归下降：取值目录段（THEME_DIR_LEVELS）逐层深入，最后在 `colors/`
    // 固定字面段之下收叶子（index.ts / theme.scss）。
    walk(pkgDir, [pkg], result);
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
    const colorsDir = join(base, THEME_COLORS_SEGMENT);
    for (const color of subdirs(colorsDir)) {
      const colorDir = join(colorsDir, color);
      // 键以 `./` 开头（相对主题包目录），段间单斜杠：`./<包>/<设备>/<页面>/colors/<配色>`
      const keyBase = './' + [...segments, THEME_COLORS_SEGMENT, color].join('/');
      if (existsSync(join(colorDir, THEME_COLOR_DEF_FILE))) {
        result.colors.push({
          key: `${keyBase}/${THEME_COLOR_DEF_FILE}`,
          file: join(colorDir, THEME_COLOR_DEF_FILE)
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

  // 取值段逐层下降：设备 → 页面。
  for (const name of subdirs(base)) {
    walk(join(base, name), [...segments, name], result);
  }
}

/** 绝对路径 → 模块说明符（root 内用 `/xxx`，root 外用正斜杠绝对路径） */
function toSpecifier(abs: string, root: string): string {
  const absolute = resolve(abs);
  const base = resolve(root);
  if (absolute.startsWith(base + sep)) {
    return '/' + absolute.slice(base.length + 1).split(sep).join('/');
  }
  return absolute.split(sep).join('/');
}

/** 生成虚拟模块源码 */
function render(result: ScanResult, root: string, manifestSpec: string | null): string {
  const lines: string[] = [];

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
    const spec = JSON.stringify(toSpecifier(entry.file, root) + '?inline');
    lines.push(
      `  ${JSON.stringify(entry.key)}: () => import(${spec}).then(__m${index} => __m${index}.default),`
    );
  });
  lines.push('};');

  lines.push(
    manifestSpec
      ? `export { default as manifest } from ${JSON.stringify(manifestSpec)};`
      : 'export const manifest = null;'
  );

  return lines.join('\n');
}

/**
 * 主题域插件
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { themeAssets, resolveThemeDir } from 'skinsuite/vite';
 *
 * export default defineConfig(({ mode }) => ({
 *   plugins: [themeAssets({ dir: resolveThemeDir(mode) })]
 * }));
 * ```
 */
export function themeAssets(options: ThemeAssetsPluginOptions): Plugin {
  const moduleId = options.moduleId ?? DEFAULT_MODULE_ID;
  const virtualId = '\0' + moduleId;
  const manifestFile = options.manifestFile ?? DEFAULT_THEME_MANIFEST;
  let root = process.cwd();

  return {
    name: 'skinsuite:theme-assets',
    // 虚拟模块要抢在 Vite 的内置解析之前
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    resolveId(id) {
      return id === moduleId ? virtualId : null;
    },

    load(id) {
      if (id !== virtualId) return null;
      const dir = resolve(root, options.dir);
      // 根目录不存在 = 还没建主题，给**空注册表 + 空清单**而不是让应用起不来
      if (!isDir(dir)) return EMPTY_MODULE;

      const manifestPath = manifestFile ? join(dir, manifestFile) : '';
      const manifestSpec = manifestPath && existsSync(manifestPath)
        ? toSpecifier(manifestPath, root)
        : null;

      return render(scan(dir), root, manifestSpec);
    },

    configureServer(server) {
      const dir = resolve(root, options.dir);
      const onChange = (file: string): void => {
        if (!file.startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(virtualId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      // 只监听**增删**：新增/删除主题目录或清单会改变虚拟模块的导出面；
      // 改已有文件的内容由 HMR 自己处理（那是普通模块，不必重建清单）。
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    }
  };
}
