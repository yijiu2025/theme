/**
 * `skinsuite/vue` —— Vue 绑定层的唯一公开出口
 *
 * 与纯内核分开成两个入口：只要纯机制的消费者（Node 脚本、别的框架、单测）不该被迫
 * 装 Vue；`.vue` 与 `vue` 运行时只有这一个入口碰，依赖方向一眼可查。
 *
 * 只装机制不装策略：面板长什么样、postMessage 协议怎么解析在这里；路由怎么改、
 * store 怎么实现、哪些 origin 可信是宿主参数。
 *
 * 内部按文件类型分组：components/ composables/ store/ runtime/ registry/ debug/ device/。
 */

// ---- 组件（components/）----
export { default as ThemeDebugPanel } from './components/ThemeDebugPanel.vue';
export { default as ThemePart } from './components/ThemePart.vue';
export { default as ThemeRoot } from './components/ThemeRoot.vue';
export { default as ThemeScope } from './components/ThemeScope.vue';
export { default as ThemeView } from './components/ThemeView.vue';
export { default as ThemeProvider } from './components/ThemeProvider.vue';

// ---- 调试面板类型与适配器（types.ts / composables/）----
export type { ThemeDebugActions, ThemeDebugColor, ThemeDebugModel } from './types';
export { useThemeDebugPanel } from './composables/useThemeDebugPanel';

// ---- 来源同步（composables/）----
export { useThemeSources } from './composables/useThemeSources';
export type { ThemeSourcesOptions } from './composables/useThemeSources';
export { useParentThemeSync } from './composables/useParentThemeSync';
export type { ParentThemeSyncOptions } from './composables/useParentThemeSync';

// ---- 版式机制（registry/：「主题包 ⇄ Vue 组件」的桥接）----
// 公开面只留两个工厂；宿主只需 defineThemePage。
export { createViewRegistry, createViewPicker } from './registry/view-registry';
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
} from './registry/view-registry';
export { defineThemePage, isThemePage, pageOf, registeredPageNames } from './registry/view-page';
export type { ThemePage, ThemePageOptions } from './registry/view-page';
export { installThemeViews, themeViewsFor } from './registry/theme-views';

// ---- 部件层（registry/theme-parts.ts，P1b 2026-10-23：主题化的弹窗/通知/悬浮窗组件本身）----
export { installThemeParts, themePartsFor } from './registry/theme-parts';
export type { PartModuleLoader, PartModuleMap } from './registry/theme-parts';

// ---- 设备域（device/：URL 通道；判定与布线都在宿主，2026-10-24）----
// 🔴 设备**判定**不在库内（2026-10-20）：宿主分发器按自己的口径选设备容器，
//    设备身份由 `<ThemeView page="login" device="mini">` props 告知 store
//    （`setActiveDevice`）。设备清单同样不在库内：`createThemeState({ devices })`
//    装配期注入（词汇 + 顺序 + 兜底 = 宿主事实），库只读取渲染。
export type { DeviceVocab } from '../types';
export { currentQuery, installThemeDomain, replaceQuery } from './device/device-domain';
export type {
  DeviceDomainRouter,
  InstallThemeDomainOptions
} from './device/device-domain';
export { theme } from './plugin';
export type { ThemePluginOptions } from './plugin';

// ---- 主题状态机（store/，2026-10-19 下沉）----
// 🔴 只导出 `createThemeState`（编排入口）—— scope/intent/runtime/persistence 是内部实现，
//    对外只承诺「宿主一行 defineStore 包起来」。pinia **不进库**：编排返回的是纯 Vue 响应式，
//    宿主自己决定是否用 defineStore 包装。
export { createThemeState } from './store/create-theme-state';
export type { ThemeStateOptions } from './store/create-theme-state';

// ---- token 运行时（runtime/，「分层 token → DOM」的注入半边，2026-10-17 下沉）----
// 🔴 P1a（2026-10-23）起 applyThemeLayers 支持注入目标（options.target），缺省仍为
//    html 根（全局，向后兼容）；clearThemeTokens / getInjectedTokenNames 同口径参数化。
export {
  applyThemeLayers,
  applyThemeTokens,
  clearThemeTokens,
  getInjectedTokenNames
} from './runtime/token-runtime';
export type { ApplyThemeLayersOptions } from './runtime/token-runtime';

// ---- 后端主题配置取数（runtime/remote-fetch.ts，「fetch + 超时 + 归一」骨架，2026-10-17 下沉）----
export { fetchRemoteThemeConfig, isRemoteThemeEnabled } from './runtime/remote-fetch';
export type { RemoteThemeFetchOptions } from './runtime/remote-fetch';

// ---- 作用域主题（composables/，P1a 2026-10-23：钉死/并行主题，纯查询不碰 store）----
export { resolveScopedRecord, useScopedTheme } from './composables/use-scoped-theme';
export type { ScopedThemeParams } from './composables/use-scoped-theme';
