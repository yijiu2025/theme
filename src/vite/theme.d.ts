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

  // 🔴 版式/部件组件类型用 unknown 而非 `import type { Component } from 'vue'`：
  //    vue 是 optional peer，非 Vue 宿主（themeAssets({ vue:false })）消费 skinsuite/vite
  //    的类型时会因缺 vue 类型报 TS 错误 —— 与「内核零框架耦合」硬约束冲突。这里只声明
  //    虚拟模块的形状，具体组件类型由 vue 层（ThemeView/ThemePart）在使用处自行收窄。
  /** 包定义：`./<包>/index.ts` */
  export const packages: Record<string, { default: MauthThemePackage }>;
  /** 配色元信息 + tokens：`./<包>/<设备>/<页面>/colors/<配色>/index.ts` */
  export const colors: Record<string, { default: MauthThemeColor }>;
  /** 附加样式（惰性，取编译后的 CSS 字符串）：`./<包>/<设备>/<页面>/colors/<配色>/theme.scss` */
  export const styles: Record<string, () => Promise<string>>;
  /**
   * 版式组件（按页面分组）：`themeViews.<页面>` = 该页各「包 × 设备」的版式组件加载器
   *
   * 键相对主题包目录：`./<包>/<设备>/<页面>/index.vue`。内置包（default）eager（零请求，
   * 加载器**同步返回**模块命名空间）、非内置包惰性（返回 Promise）。与原先
   * `import.meta.glob` 的惰性加载器形态一致。
   */
  export const themeViews: Record<
    string,
    Record<string, () => { default: unknown } | Promise<{ default: unknown }>>
  >;

  /**
   * 部件组件（按部件 id 分组，P1b 部件层）：`themeParts.<部件id>` = 该部件各
   * 「包 × 设备」的版式组件加载器。
   *
   * 键相对主题包目录：`./<包>/<设备>/parts/<部件id>/index.vue`。default 包 eager
   * （加载器**同步返回**模块命名空间）、非 default 包惰性（返回 Promise）。
   */
  export const themeParts: Record<
    string,
    Record<string, () => { default: unknown } | Promise<{ default: unknown }>>
  >;

  /**
   * 主题域清单（**已 resolve**，非 null）
   *
   * 目录里没有 `theme.config.ts` 时回落到机制默认值（`resolveThemeManifest` 兜底），
   * 所以这里恒非 null —— 机制照常工作（有资产、面板退回默认档），
   * 而不是让应用起不来。本模块被 import 时同时完成「版式加载表安装 + 注册表装配 +
   * 清单解析 + 声明目录（views/*.ts）副作用拉齐」。
   */
  export const themeManifest: ResolvedThemeManifest;
}
