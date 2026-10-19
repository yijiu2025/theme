/**
 * 主题域的 Vue 插件 —— `app.use(theme, { router })` 一行启动设备域
 *
 * 与 Pinia / Router / i18n 同一套接入方式。`install` 在 `app.mount()` 之前**同步**执行，
 * 设备域据此建立「链接变动 + 视口（matchMedia）→ 判定设备 → `activeDevice`」两条响应链，
 * 首帧即终态（不闪基线色）。
 *
 * === 为什么只传 router ===
 * 设备来源（path / query）从 router 拿、视口用库默认 `matchMedia`、判定结果存在设备域
 * （宿主 store 订阅）——三件事都收进库，宿主只传一个 router，不写 `deviceSource`、不标
 * `meta.device`、不手动 `setActiveDevice`。
 *
 * @author yijiu2025
 * @since 2026-10-18
 */
import type { App, Plugin } from 'vue';
import { installThemeDomain } from './device-domain';
import type { DeviceDomainRouter, InstallThemeDomainOptions } from './device-domain';

export interface ThemePluginOptions {
  /** 宿主路由（库只认 `currentRoute.value.{ query, path, fullPath }` 最小结构） */
  router: DeviceDomainRouter;
  /** 宿主注入的设备覆盖解析（`?device=` 等宿主 URL 词汇），透传给设备域 */
  resolveDeviceOverride?: InstallThemeDomainOptions['resolveDeviceOverride'];
}

/** Vue 插件：`app.use(theme, { router, resolveDeviceOverride? })` */
export const theme: Plugin<[ThemePluginOptions]> = {
  install(_app: App, options: ThemePluginOptions) {
    installThemeDomain({
      router: options.router,
      resolveDeviceOverride: options.resolveDeviceOverride
    });
  }
};
