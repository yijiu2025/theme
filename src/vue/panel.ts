/**
 * 面板的**独立入口** —— 供宿主做异步加载用
 *
 * 为什么单独开一条子路径：`skinsuite/vue` 里同时有同步的 composable 与懒加载的组件。
 * 宿主若从同一个入口 `import()` 面板，打包器会把该入口的所有导出视为"已被静态引入"，
 * 动态导入**不会**切出独立 chunk（Vite 报 `INEFFECTIVE_DYNAMIC_IMPORT`），
 * 面板连同它的样式就回到了主包 —— 恰好破坏了"不带调试参数时不下载"的约定。
 *
 * 于是显式分成两条：
 *   `skinsuite/vue`        → 同步（useParentThemeSync 等）
 *   `skinsuite/vue/panel`  → 只导出面板组件，专供 `defineAsyncComponent`
 *
 * @author yijiu2025
 */
export { default as ThemeDebugPanel } from './ThemeDebugPanel.vue';
export { default } from './ThemeDebugPanel.vue';
