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
export { default as ThemePart } from './ThemePart.vue';
export { default as ThemeRoot } from './ThemeRoot.vue';
export { default as ThemeScope } from './ThemeScope.vue';
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

// ---- 部件层（P1b，2026-10-23：主题化的弹窗/通知/悬浮窗组件本身，DOM 随包换）----
export { installThemeParts, themePartsFor } from './theme-parts';
export type { PartModuleLoader, PartModuleMap } from './theme-parts';

// ---- 设备容器机制（「设备 id → 容器组件」的组件半边，2026-10-17 下沉）----
// 设备容器是**宿主布线**（2026-10-24 起设备清单整份归宿主，库不自持注册表）：
// 这里只留**纯工具** —— pageContainers（glob 结果 →「页面 → 加载器」表）与
// containerOf / resolveContainerOf（**传 defs** 版，无模块状态）。宿主在自己的
// 设备清单文件里组装 defs 数组，分发器经宿主模块消费。
export { pageContainers, containerOf, resolveContainerOf } from './device-containers';
export type { DeviceContainerLoader } from './device-containers';

// ---- 设备词汇（注入式，2026-10-24：defineThemeDevice 注册表退役）----
// 🔴 设备**判定**不在库内（2026-10-20）：宿主分发器按自己的口径选设备容器，
//    设备身份由 `<ThemeView page="login" device="mini">` props 告知 store
//    （`setActiveDevice`）。设备清单同样不在库内：`createThemeState({ devices })`
//    装配期注入（词汇 + 顺序 + 兜底 = 宿主事实），库只读取渲染。
export type { DeviceVocab } from '../views/device';
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
// 🔴 P1a（2026-10-23）起 applyThemeLayers 支持注入目标（options.target），缺省仍为
//    html 根（全局，向后兼容）；clearThemeTokens / getInjectedTokenNames 同口径参数化。
export {
  applyThemeLayers,
  applyThemeTokens,
  clearThemeTokens,
  getInjectedTokenNames
} from './token-runtime';
export type { ApplyThemeLayersOptions } from './token-runtime';

// ---- 作用域主题（P1a，2026-10-23：钉死/并行主题，纯查询不碰 store）----
export { default as ThemeProvider } from './ThemeProvider.vue';
export { resolveScopedRecord, useScopedTheme } from './use-scoped-theme';
export type { ScopedThemeParams } from './use-scoped-theme';

// ---- 后端主题配置取数（「fetch + 超时 + 归一」骨架，2026-10-17 下沉）----
export { fetchRemoteThemeConfig, isRemoteThemeEnabled } from './remote-fetch';
export type { RemoteThemeFetchOptions } from './remote-fetch';
