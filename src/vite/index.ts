/**
 * `skinsuite/vite` —— 构建期适配器（Vite 插件 + 目录常量）
 *
 * 内核与 Vue 绑定层都刻意不碰构建器（「扫描主题目录」是 Vite 专属能力），这一半收
 * 在这里，宿主 vite.config.ts 一行接入：
 *
 * ```ts
 * import { themeAssets } from 'skinsuite/vite';
 * export default defineConfig({
 *   // 目录缺省 = env VITE_THEME_DIR，无 env 则 src/theme
 *   plugins: [themeAssets()]
 * });
 * ```
 *
 * exports 双轨：import → dist/vite/index.js（编译产物，Node 不转译 TS）；types →
 * 源码直供（避免 d.ts 与源码漂移）。
 *
 * ⚠️ 本层相对 import 用显式 `.js` 后缀：NodeNext 编译产物原样保留说明符，
 *    不带后缀 Node 原生 ESM 解析不到。
 */
/// <reference path="./theme.d.ts" />

export { themeAssets } from './plugin.js';
export type { ThemeAssetsPluginOptions } from './plugin.js';
export {
  DEFAULT_THEME_DIR,
  THEME_DIR_ENV_KEY,
  THEME_PACKAGES_SUBDIR,
  DEFAULT_THEME_MANIFEST
} from './dir.js';
