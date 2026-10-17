/**
 * 虚拟模块 `virtual:theme` 的类型声明（随 `skinsuite/vite` 一起发布，宿主不必自写）
 *
 * 该模块由 `skinsuite/vite` 的 `themeAssets()` 在构建期生成（宿主在 `vite.config.ts`
 * 挂上它即可，不自己写扫描逻辑），扫的是 `.env` 里 `VITE_THEME_DIR` 指向的**主题根目录**
 * （缺省 `src/theme`）—— 所以主题根目录是配置项，不再写死在 `import.meta.glob` 里。
 *
 * 它一次产出两样东西（同一份扫描结果，不会出现"资产在 A、配置在 B"）：
 *   · 资产：`packages` / `colors` / `styles`
 *   · 清单：`manifest`（根目录里的 `theme.config.ts`，契约见 `defineThemeManifest`）
 *
 * 资产键**相对主题包目录 `themes/`**（`./<包>/...`），值保持"模块命名空间"形态，
 * 与原先 `import.meta.glob` 的结果一致。
 *
 * ⚠️ 本文件属于 `skinsuite/vite` 构建器层（内核 tsc 会 exclude 它），由宿主的
 *    vue-tsc / Vite 转译检查 —— 因为 `virtual:theme` 是构建期产物，不在纯内核里。
 */
declare module 'virtual:theme' {
  import type { MauthThemeColor, MauthThemePackage, ResolvedThemeManifest } from 'skinsuite';

  /** 包定义：`./<包>/index.ts` */
  export const packages: Record<string, { default: MauthThemePackage }>;
  /** 配色元信息 + tokens：`./<包>/<设备>/<页面>/colors/<配色>/index.ts` */
  export const colors: Record<string, { default: MauthThemeColor }>;
  /** 附加样式（惰性，取编译后的 CSS 字符串）：`./<包>/<设备>/<页面>/colors/<配色>/theme.scss` */
  export const styles: Record<string, () => Promise<string>>;

  /**
   * 主题域清单
   *
   * 目录里没有 `theme.config.ts` 时为 `null` —— 机制照常工作（有资产、无路由投影、
   * 面板退回默认档），而不是让应用起不来。类型上保留 `null` 是为了让消费方
   * **必须**显式处理这一支，别指望它总是存在。
   */
  export const manifest: ResolvedThemeManifest | null;
}
