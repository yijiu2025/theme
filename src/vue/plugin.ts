/**
 * 主题域的 Vue 插件 —— `app.use(theme, { router })` 一行装配
 *
 * 与 Pinia / Router / i18n 同一套接入方式。`install` 在 `app.mount()` 之前**同步**执行，
 * 设备域据此记住 router 引用（`currentQuery()` 给版式意图同步用）。
 *
 * === router 可选（2026-10-23，P0 无路由支持）===
 * 无 vue-router 的应用（工具页、嵌入式小组件、纯 UI 壳）可以 `app.use(theme)` 无参装配：
 *   · `currentQuery()` 未装 router 时回退**装载时读一次** `location.search`
 *     （见 device-domain.ts——无路由应用的 URL 本来不变，一次性读取是正确语义）；
 *   · 配色意图（`?th_color`）本就读 `location.search`，不受影响；
 *   · 版式/配色意图的**路由响应性**（跨页 `th` 变化自动同步）不可用——那是路由器的职责，
 *     无路由应用没有"跨页"，也就没有这个需求。
 *
 * === 为什么只认 router（有它时）===
 * 设备判定整条线在**宿主侧**：宿主的分发器（如 `login/index.vue`）按自己的口径
 * （视口 / `?device=` 锁定）选设备容器；设备身份由容器里的 `<ThemeView page="login"
 * device="mini">` props 告知 store（`setActiveDevice`）。库不认视口 / UA / `?device=` /
 * `?from=`，也没有任何注入槽 —— 判定策略是宿主的事，库只接收结果。
 *
 * @author yijiu2025
 * @since 2026-10-18
 * @since 2026-10-20（撤 `resolveDevice` 注入：设备由 ThemeView props 告知，库只接收）
 * @since 2026-10-23（router 改可选：`app.use(theme)` 无参支持无路由应用）
 */
import type { App, Plugin } from 'vue';
import { installThemeDomain } from './device-domain';
import type { DeviceDomainRouter } from './device-domain';

export interface ThemePluginOptions {
  /**
   * 宿主路由（可选）。库只认 `currentRoute.value.{ query, path, fullPath }` 最小结构。
   * 未提供时 URL 意图走 location.search 一次性读取（无路由响应性，见文件头）。
   */
  router?: DeviceDomainRouter;
}

/** Vue 插件：`app.use(theme, { router })`；无路由应用 `app.use(theme)` */
export const theme: Plugin<[ThemePluginOptions?]> = {
  install(_app: App, options: ThemePluginOptions = {}) {
    if (options.router) installThemeDomain({ router: options.router });
  }
};
