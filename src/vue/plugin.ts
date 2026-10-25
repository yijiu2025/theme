/**
 * 主题域的 Vue 插件 —— `app.use(theme, { router })` 一行装配
 *
 * install 在 app.mount() 之前同步执行，设备域据此记住 router 引用
 * （currentQuery() 给版式意图同步用）。
 *
 * router 可选：无 vue-router 的应用可以 `app.use(theme)` 无参装配 ——
 * currentQuery() 回退装载时读一次 location.search（无路由应用的 URL 本来不变）；
 * 版式意图的「跨页 th 变化自动同步」不可用（无路由应用没有「跨页」）。
 *
 * 设备判定整条线在宿主侧，库不认视口 / UA / ?device= / ?from=，也没有注入槽。
 */
import type { App, Plugin } from 'vue';
import { installThemeDomain } from './device/device-domain';
import type { DeviceDomainRouter } from './device/device-domain';

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
