/**
 * 视口 / UA 设备形态判定（**纯浏览器判定**，SSR 安全）
 *
 * 从 `oauth21/src/utils/device.ts` 下沉（2026-10-19）。判定口径只有这一份：
 * 设备域（`device-domain`）用它的响应式版判「当前设备」，宿主守卫 / 请求拦截等
 * 用它的纯函数版判「跳哪个登录页」—— 两边同源，不再漂移。
 *
 * === 判定口径（三级，宽视口优先于 UA）===
 *   1. 视口 ≥ 1024px（DESKTOP_MIN_WIDTH）→ 电脑版（UA 说什么都不例外）
 *   2. 视口 < 768px（MOBILE_BREAKPOINT）→ 移动端
 *   3. 中间段（768–1023）→ UA 命中真机才算移动端（该区间可能是被缩放的桌面浏览器）
 *
 * === 为什么宽视口优先于 UA（2026-09-21 线上问题）===
 * 平板横屏 / 折叠屏展开 / 手机开「桌面版网站」时 UA 仍报手机、视口却有 1024px+，
 * 恒定按 UA 判移动端会把移动端版式铺满整屏。宽度比 UA 更贴近「这块屏放不放得下
 * 桌面布局」这个真问题。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 oauth21/src/utils/device.ts 下沉，供设备域与宿主共用）
 */

/** 移动端判定阈值（px）：窄于它说明视口放不下桌面双栏布局 */
export const MOBILE_BREAKPOINT = 768;

/** 桌面端判定阈值（px）：宽于等于它说明屏幕放得下完整桌面布局（对齐 Tailwind lg 断点） */
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * UA 兜底检测：视口宽度会被窗口缩放 / 分屏 / DevTools 模拟影响，
 * UA 能识别「真手机/平板」（新版 iPad UA 已不含 iPad，走 maxTouchPoints 兜底）。
 */
export function detectMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua);
  const iPadLike =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  return uaMobile || iPadLike;
}

/** 视口是否已宽到该用电脑版（只看宽度，不看 UA） */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= DESKTOP_MIN_WIDTH;
}

/** 当前是否应按移动端处理（一次性判定；SSR / 无 window 环境返回 false = 桌面默认） */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDesktopViewport()) return false;
  if (detectMobileUA()) return true;
  return window.innerWidth < MOBILE_BREAKPOINT;
}
