/**
 * `skinsuite/vite` —— 主题库的**构建期适配器**（Vite 插件 + 目录解析）
 *
 * 纯内核（`skinsuite`）与 Vue 绑定（`skinsuite/vue`）都刻意不碰构建器，因为
 * "扫描主题目录"是 Vite 专属的能力（webpack 要写成 `require.context`）。这一半
 * 收在这里，让宿主在 `vite.config.ts` 里三行接完，不必自己抄扫描逻辑：
 *
 * ```ts
 * import { themeAssets, resolveThemeDir } from 'skinsuite/vite';
 * export default defineConfig(({ mode }) => ({
 *   plugins: [themeAssets({ dir: resolveThemeDir(mode) })]
 * }));
 * ```
 *
 * === 为什么这个子路径指向源码 `.ts` 而不是 `dist/` ===
 * `vite.config.ts` 由 Vite 用 esbuild 预打包后执行，裸包说明符会被当外部依赖交给
 * Node `import()`。若指向 `dist/`，就要求"包必须先构建" —— CI 里 `npm ci` 不会
 * 构建工作区包，配置会直接起不来。Vite 自己能转译 TS，源码直供就绕开这个前提，
 * 与 `skinsuite/vue` 同一手法。
 *
 * ⚠️ 本层相对 import **必须用显式 `.ts` 后缀**（`./plugin.ts` 而非 `./plugin` 或
 *    `./plugin.js`）：
 *    这个入口是**唯一在 vite.config / vitest.config 里被 import 的子路径**，config
 *    被 Node 直接执行（Vite 的 config 加载器只 bundle config 自身），Node 既不自动补
 *    无后缀、也不把 `.js` 映射到 `.ts` 源码。而纯内核（`./tone.js`）走 NodeNext 编译、
 *    `skinsuite/vue` 走应用代码的 Vite 转译，两者都用不上这个入口的约束，所以这里
 *    自成一套后缀规则。`.ts` 后缀由宿主的 `allowImportingTsExtensions` + Vite 转译共同消化。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
/// <reference path="./theme.d.ts" />

export { themeAssets } from './plugin.js';
export type { ThemeAssetsPluginOptions } from './plugin.js';
export {
  DEFAULT_THEME_DIR,
  THEME_PACKAGES_SUBDIR,
  DEFAULT_THEME_MANIFEST,
  resolveThemeDir
} from './dir.js';
