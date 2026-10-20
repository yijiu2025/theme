/**
 * 主题域的 Vue 插件 —— `app.use(theme, { router })` 一行装配
 *
 * 与 Pinia / Router / i18n 同一套接入方式。`install` 在 `app.mount()` 之前**同步**执行，
 * 设备域据此记住 router 引用（`currentQuery()` 给版式意图同步用）。
 *
 * === 为什么只传 router（2026-10-20 起）===
 * 设备判定整条线在**宿主侧**：宿主的分发器（如 `login/index.vue`）按自己的口径
 * （视口 / `?device=` 锁定）选设备容器；设备身份由容器里的 `<ThemeView page="login"
 * device="mini">` props 告知 store（`setActiveDevice`）。库不认视口 / UA / `?device=` /
 * `?from=`，也没有任何注入槽 —— 判定策略是宿主的事，库只接收结果。
 *
 * @author yijiu2025
 * @since 2026-10-18
 * @since 2026-10-20（撤 `resolveDevice` 注入：设备由 ThemeView props 告知，库只接收）
 */
import type { App, Plugin } from 'vue';
import { installThemeDomain } from './device-domain';
import type { DeviceDomainRouter } from './device-domain';

export interface ThemePluginOptions {
  /** 宿主路由（库只认 `currentRoute.value.{ query, path, fullPath }` 最小结构） */
  router: DeviceDomainRouter;
}

/** Vue 插件：`app.use(theme, { router })` */
export const theme: Plugin<[ThemePluginOptions]> = {
  install(_app: App, options: ThemePluginOptions) {
    installThemeDomain({ router: options.router });
  }
};
