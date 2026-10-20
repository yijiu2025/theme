/**
 * 主题状态机装配入口 —— `createThemeState(options)`（宿主一行 `defineStore` 包起来）
 *
 * 从 `oauth21/src/stores/theme.ts` 的编排逻辑下沉（2026-10-19）。
 *
 * === 为什么下沉编排、但**不**下沉 pinia ===
 * 状态机的三块 composable（scope / intent / runtime）+ 持久化层都不依赖 pinia（只用
 * `ref`/`computed`/`watch`），所以「下沉状态机」不需要把 pinia 传给包 —— 只要把**编排**
 * 收成一个纯函数，宿主用一行 `defineStore('theme', () => createThemeState())` 包成 store。
 * pinia 只是把 composable 注册成 store 实例的一层壳，不值得为它给库加 peer 依赖。
 *
 * === 宿主策略怎么收口（`ThemeStateOptions`）===
 * 状态机里唯一可能因宿主而异的，是**持久化契约**：localStorage 键名、URL 配色参数前缀。
 * 这两样下沉后作为默认值（对齐主题机制约定），宿主与之冲突时通过 options 覆盖。
 * 后端配色端点 / 父应用 origin 白名单已通过 env 注入（`useThemeSources` 读
 * `VITE_THEME_ENDPOINT` / `VITE_ALLOWED_PARENT_ORIGINS`），不进 options。
 *
 * === 调试探针 ===
 * dev + `?debug=theme` 时把只读快照挂到 `window.__MAUTH_STORE__`（getter 形态，随 store 实时）。
 * 探针需要访问 scope/intent 的内部 ref，所以随编排一起下沉（而不是留在宿主壳里）。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 oauth21/src/stores/theme.ts 下沉编排，pinia 留在宿主）
 */
import { watch } from 'vue';
import { useThemeScope } from './theme-scope';
import { useThemeIntent } from './theme-intent';
import { useThemeRuntime } from './theme-runtime';
import { currentQuery } from './device-domain';
import { DEFAULT_COLOR_PARAM, DEFAULT_STORAGE_KEYS } from './theme-persistence';
import { DEFAULT_VIEW_PARAM } from '../views/params';
import type { ThemeStorageKeys } from './theme-persistence';

/** 宿主策略收口点（全可选，默认 = 主题机制约定，oauth21 即默认值本身） */
export interface ThemeStateOptions {
  /** localStorage 键名（与宿主已有存储冲突时可覆盖） */
  storageKeys?: Partial<ThemeStorageKeys>;
  /** URL 配色意图参数前缀（配合设备 urlKey 组成 `th_color_<urlKey>`） */
  colorParam?: string;
  /** URL 版式意图参数前缀（配合设备 urlKey 组成 `th_<urlKey>`） */
  viewParam?: string;
}

/**
 * 装配主题状态机，返回与「主题 store」一致的公开面。
 *
 * 用法（宿主就这么多）：
 * ```ts
 * import { defineStore } from 'pinia';
 * import { createThemeState } from 'skinsuite/vue';
 * import 'virtual:theme'; // 副作用：装版式加载表 + 注册表 + 清单 + 拉齐 views/*.ts 声明
 *
 * export const useThemeStore = defineStore('theme', () => createThemeState());
 * ```
 *
 * 返回对象里的 ref 会被 pinia 自动解包（与 `defineStore(() => ({ ...refs }))` 同形）。
 */
export function createThemeState(options: ThemeStateOptions = {}) {
  const keys: ThemeStorageKeys = { ...DEFAULT_STORAGE_KEYS, ...options.storageKeys };
  const colorParam = options.colorParam ?? DEFAULT_COLOR_PARAM;
  const viewParam = options.viewParam ?? DEFAULT_VIEW_PARAM;

  // ① 作用域（共享基础：activeDevice / activePage / activeView / themeRecordFor / isDark 等）
  const scope = useThemeScope(keys, colorParam, viewParam);
  // ② 意图（明暗三态 + 记忆槽 + 色系联动 + 用户操作入口）
  const intent = useThemeIntent(scope, keys);
  // ③ 运行时（token 注入 + 附加样式 + 明暗类 + 外部配置）；必须最后创建（内部 watch immediate 依赖前两步）
  const runtime = useThemeRuntime(scope, intent);

  // -------------------------------------------------------------------------
  // URL 上 `th*` 原始值变化 → 同步版式意图进 store（2026-10-20 store 化）
  //
  // 🔴 debug 面板的 `pickView` 只写 store（`setDeviceView`）**不写 URL**，所以此
  //    watch 不会被调试操作误触发；跨页带不同 `th`（/login → /register）仍生效。
  // 🔴 `app.use(theme, { router })` 先于 store 创建（bootstrap 顺序），此处
  //    `currentQuery()` 已是响应式路由 query；未装 router 时返回 `{}`（无依赖，不触发）。
  // 🔴 source 包 getter（而非直接传 `currentQuery()`）：后者未装 router 时是普通对象，
  //    Vue 会 warn "Invalid watch source"；包一层后两种形态都合法。
  // -------------------------------------------------------------------------
  watch(() => currentQuery(), () => scope.syncUrlViewIntent(), { deep: true });

  // -------------------------------------------------------------------------
  // 调试探针（仅 dev + ?debug=theme）：getter 形态随 store 实时取最新值
  // -------------------------------------------------------------------------
  if (import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'theme') {
    (window as unknown as Record<string, unknown>).__MAUTH_STORE__ = {
      get themeId() { return scope.themeId.value; },
      get deviceTheme() { return { ...scope.deviceTheme.value }; },
      get viewIntent() { return scope.viewIntent.value; },
      get deviceView() { return { ...scope.deviceView.value }; },
      get mode() { return intent.mode.value; },
      get packageId() { return scope.packageId.value; },
      get activeDevice() { return scope.activeDevice.value; },
      get activePage() { return scope.activePage.value; },
      get activeView() { return scope.activeView.value; },
      get activeThemeId() { return scope.themeRecordFor().meta.id; },
      get activeTone() { return scope.themeRecordFor().tone; }
    };
  }

  return {
    // ---- 来自 scope ----
    mode: intent.mode,
    isDark: scope.isDark,
    themeId: scope.themeId,
    packageId: scope.packageId,
    device: scope.device,
    activeDevice: scope.activeDevice,
    activePage: scope.activePage,
    activeView: scope.activeView,
    activeTone: scope.activeTone,
    themes: scope.themes,
    systemDark: intent.systemDark,
    themeTokens: runtime.themeTokens,
    externalTokens: runtime.externalTokens,
    lightColor: intent.lightColor,
    darkColor: intent.darkColor,
    themeRecordFor: scope.themeRecordFor,
    setActiveDevice: scope.setActiveDevice,
    setActivePageView: scope.setActivePageView,
    // ---- 版式意图（store 化；与 themeId/deviceTheme 同形）----
    viewIntent: scope.viewIntent,
    deviceViewOf: scope.deviceViewOf,
    setDeviceView: scope.setDeviceView,
    clearDeviceViewOverride: scope.clearDeviceViewOverride,
    // ---- 来自 intent ----
    setMode: intent.setMode,
    cycleMode: intent.cycleMode,
    toggleTheme: intent.toggleTheme,
    setTheme: intent.setTheme,
    viewFor: scope.viewFor,
    // ---- 来自 runtime ----
    applyThemeConfig: runtime.applyThemeConfig,
    applyTheme: intent.applyTheme,
    // 销毁：intent 的系统偏好监听 + runtime 的来源同步（父同步 removeEventListener）
    dispose: () => {
      intent.dispose();
      runtime.disposeSources();
    }
  };
}
