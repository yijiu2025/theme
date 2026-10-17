/**
 * `skinsuite/vue` —— **Vue 绑定层**的唯一公开出口
 *
 * 与 `skinsuite`（零依赖纯内核）分开成两个入口的理由：
 *   • 只要纯机制的消费者（Node 脚本、另一套框架、单测）**不该被迫装 Vue**；
 *   • `.vue` 与 `vue` 运行时只有这一个入口碰，依赖方向一眼可查。
 *
 * 这里只装「**机制**」，不装「**策略**」：
 *   ✅ 面板长什么样、点一下发什么事件
 *   ✅ postMessage 协议怎么解析
 *   ❌ 路由怎么改、store 怎么实现、哪些 origin 可信 —— 那些是宿主参数
 *
 * @author yijiu2025
 */

export { default as ThemeDebugPanel } from './ThemeDebugPanel.vue';
export { default as ThemeRoot } from './ThemeRoot.vue';
export type { ThemeRootHost } from './ThemeRoot.vue';
export { useParentThemeSync } from './useParentThemeSync';
export type { ParentThemeSyncOptions } from './useParentThemeSync';
export { setupTheme } from './setupTheme';
export type { SetupThemeOptions } from './setupTheme';
export { useThemeDebugPanel } from './useThemeDebugPanel';
export type { ThemeDebugPanelHost } from './useThemeDebugPanel';
export type { ThemeDebugActions, ThemeDebugColor, ThemeDebugModel } from './types';

// ---- 版式机制（「主题包 ⇄ Vue 组件」的桥接，2026-10-17 下沉）----
export { createViewRegistry } from './view-registry';
export type {
  PackageViews,
  ViewModuleMap,
  ViewRegistry,
  ViewRegistryHost,
  ViewRegistryOptions
} from './view-registry';
export { createViewPicker } from './view-picker';
export type { ViewPicker, ViewPickerOptions, ViewPickerSource } from './view-picker';
export { defineThemePage, isThemePage } from './view-page';
export type { ThemePage, ThemePageOptions } from './view-page';
export { buildPages, listPageViewsOf, viewsForPageOf } from './view-pages';
export type { PageSummaryHost, PageViews } from './view-pages';
export { createPageIndex } from './page-index';
export type { PageIndex, PageIndexOptions, PagePathResolver } from './page-index';

// ---- 设备容器机制（「设备 id → 容器组件」的组件半边，2026-10-17 下沉）----
export { containerOf, pageContainers, resolveContainerOf } from './device-containers';
export type { DeviceContainerLoader } from './device-containers';

// ---- token 运行时（「分层 token → DOM」的注入半边，2026-10-17 下沉）----
export {
  applyThemeLayers,
  applyThemeTokens,
  clearThemeTokens,
  getInjectedTokenNames,
  resetThemeRuntime
} from './token-runtime';

// ---- 后端主题配置取数（「fetch + 超时 + 归一」骨架，2026-10-17 下沉）----
export { fetchRemoteThemeConfig, isRemoteThemeEnabled } from './remote-fetch';
export type { RemoteThemeFetchOptions } from './remote-fetch';
