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
export { default as ThemeView } from './ThemeView.vue';
export { themeStoreKey } from './theme-store';
export type { ThemeStoreLike } from './theme-store';
export { useThemeSources } from './useThemeSources';
export type { ThemeSourcesOptions } from './useThemeSources';
export { useParentThemeSync } from './useParentThemeSync';
export type { ParentThemeSyncOptions } from './useParentThemeSync';
export { useThemeDebugPanel } from './useThemeDebugPanel';
export type { ThemeDebugActions, ThemeDebugColor, ThemeDebugModel } from './types';

// ---- 版式机制（「主题包 ⇄ Vue 组件」的桥接，2026-10-17 下沉）----
// 🔴 公开面收敛（2026-10-17 末）：原 view-picker 并入 view-registry、view-pages 并入
//    view-page；对外只留两个工厂。宿主只需 defineThemePage。
export { createViewRegistry, createViewPicker } from './view-registry';
export type {
  PackageViews,
  ViewModuleLoader,
  ViewModuleMap,
  ViewModuleProvider,
  ViewRegistry,
  ViewRegistryOptions,
  ViewPicker,
  ViewPickerOptions,
  ViewPickerSource
} from './view-registry';
export { defineThemePage, isThemePage, pageOf, registeredPageNames } from './view-page';
export type { ThemePage, ThemePageOptions } from './view-page';
export { installThemeViews, themeViewsFor } from './theme-views';

// ---- 设备容器机制（「设备 id → 容器组件」的组件半边，2026-10-17 下沉）----
// 🔴 containerOf / resolveContainerOf 的「传 defs」低层版不对外导出 —— 对外只留
//    pageContainers（建容器表）与设备域单例版（见下），宿主不再写「传 registeredDefs」转发。
export { pageContainers } from './device-containers';
export type { DeviceContainerLoader } from './device-containers';

// ---- 设备域（声明工厂 + 查询派生 + 运行时，2026-10-18 下沉）----
// 🔴 设备**判定**不在库内（2026-10-20）：宿主分发器按自己的口径选设备容器，
//    设备身份由 `<ThemeView page="login" device="mini">` props 告知 store
//    （`setActiveDevice`）；库只保留 `currentQuery` / `replaceQuery` 两条 URL 通道。
export {
  defineThemeDevice,
  deviceIds,
  fallbackDevice,
  registeredDevices,
  resolveContainerOf,
  urlKeyOf
} from './define-theme-device';
export type { ThemeDeviceOptions } from './define-theme-device';
export { currentQuery, installThemeDomain, replaceQuery } from './device-domain';
export type {
  DeviceDomainRouter,
  InstallThemeDomainOptions
} from './device-domain';
export { theme } from './plugin';
export type { ThemePluginOptions } from './plugin';

// ---- 主题状态机（scope/intent/runtime + 持久化，2026-10-19 下沉）----
// 🔴 只导出 `createThemeState`（编排入口）—— scope/intent/runtime/persistence 是内部实现，
//    对外只承诺「宿主一行 defineStore 包起来」。pinia **不进库**：编排返回的是纯 Vue 响应式，
//    宿主自己决定是否用 defineStore 包装。
export { createThemeState } from './create-theme-state';
export type { ThemeStateOptions } from './create-theme-state';

// ---- token 运行时（「分层 token → DOM」的注入半边，2026-10-17 下沉）----
export {
  applyThemeLayers,
  applyThemeTokens,
  clearThemeTokens,
  getInjectedTokenNames
} from './token-runtime';

// ---- 后端主题配置取数（「fetch + 超时 + 归一」骨架，2026-10-17 下沉）----
export { fetchRemoteThemeConfig, isRemoteThemeEnabled } from './remote-fetch';
export type { RemoteThemeFetchOptions } from './remote-fetch';
