/**
 * `skinsuite/vite` —— 主题库的**构建期适配器**（Vite 插件 + 目录解析）
 *
 * 纯内核（`skinsuite`）与 Vue 绑定（`skinsuite/vue`）都刻意不碰构建器，因为
 * "扫描主题目录"是 Vite 专属的能力（webpack 要写成 `require.context`）。这一半
 * 收在这里，让宿主在 `vite.config.ts` 里三行接完，不必自己抄扫描逻辑：
 *
 * ```ts
 * import { themeAssets } from 'skinsuite/vite';
 * export default defineConfig({
 *   // 目录缺省 = env VITE_THEME_DIR（含 .env.<mode>/.env.local/CLI 层），无 env 则 src/theme
 *   plugins: [themeAssets()]
 * });
 * ```
 *
 * === 这个子路径的解析方式（与 package.json exports 对齐，2026-10-23 校正）===
 * `exports["./vite"]` 是**双轨**：
 *   · `import` → `dist/vite/index.js`（编译产物）—— `vite.config.ts` 由 Vite 用 esbuild
 *     预打包后交给 Node 执行，Node 不转译 TS，运行时必须给 `.js`；
 *   · `types` → `src/vite/index.ts`（源码直供）—— 避免 d.ts 与源码漂移，
 *     宿主的 `allowImportingTsExtensions` / Vite 转译消化类型侧。
 * （历史注记：早期版本运行时也指向过源码 `.ts`，靠"Vite 自己能转译"成立；改为
 * dist 后配置加载不再要求"包必须先构建才能被 publish 消费"，CI `npm ci` 场景更稳。）
 *
 * ⚠️ 本层相对 import 用显式 **`.js` 后缀**（`./plugin.js`）：
 *    本层由 `tsconfig.vite.json` 以 NodeNext 编译到 `dist/vite/`，产物里的相对
 *    说明符原样保留 —— 不带 `.js` 的话 Node 原生 ESM 解析不到。TS 会把 `.js`
 *    映射回 `.ts` 源码做类型检查，与纯内核（`skinsuite`）同一约定。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
/// <reference path="./theme.d.ts" />

export { themeAssets } from './plugin.js';
export type { ThemeAssetsPluginOptions } from './plugin.js';
export {
  DEFAULT_THEME_DIR,
  THEME_DIR_ENV_KEY,
  THEME_PACKAGES_SUBDIR,
  DEFAULT_THEME_MANIFEST,
  resolveThemeDir
} from './dir.js';
