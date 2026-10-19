/**
 * 设备域运行时 —— 当前生效设备 `activeDevice` + matchMedia 视口判定 + 路由监听 → 判定
 *
 * 与 `define-theme-device`（声明工厂）配对：宿主在 `defineThemeDevice` 里声明设备清单
 * （自动注册），本文件维护「当前属于哪台设备」这一运行时状态，供宿主 store 订阅、供
 * token 注入 / 版式查找取用。
 *
 * === 信号来源 ===
 * 设备判定只有「设备清单 `match`」一个来源，输入是 path / query（从 router 拿）+ 视口
 * （`matchMedia`，阈值可配）。**不再有 `meta.device`** 这个冗余基线。
 *
 * === 为什么库只认 router 的最小结构 ===
 * 库不 import vue-router（应用世界观），只认 `currentRoute.value.{ query, path, fullPath }`
 * 这三个字段 —— 宿主把 router 传进来（`app.use(theme, { router })`）。
 *
 * @author yijiu2025
 * @since 2026-10-18
 */
import { ref, watch } from 'vue';
import { deviceContext, pickDeviceId } from '../views/device';
import { registeredDevices } from './define-theme-device';
import { DESKTOP_MIN_WIDTH, MOBILE_BREAKPOINT, detectMobileUA } from './viewport';

/** 路由的最小结构（库不 import vue-router，只认这些字段） */
export interface DeviceDomainRouter {
  currentRoute: {
    value: {
      query: Record<string, unknown>;
      path: string;
      fullPath: string;
    };
  };
  /** 替换当前路由（保留 path，只改 query；调试面板换版式 / 配色用） */
  replace?(to: { query: Record<string, string | string[] | undefined> }): unknown;
}

export interface InstallThemeDomainOptions {
  router: DeviceDomainRouter;
  /**
   * 宿主注入的「设备覆盖」解析：从当前 query 返回要**锁定**的设备 id，`null` = 不覆盖。
   *
   * 用于宿主自己的 URL 约定（如 `?device=mobile` 锁定手机端）——参数名是宿主词汇，
   * 库不认、也不写死，只提供一个「显式覆盖自动判定」的通用注入点。命中合法设备时
   * 优先于 `?isMobile` / `?from` / 视口；返回 null 或非法 id 则走自动判定。
   */
  resolveDeviceOverride?: (query: Record<string, unknown>) => string | null;
}

/** 当前生效设备（响应式；宿主 store 从这里订阅） */
const activeDevice = ref<string>('');

/** 视口是否判为手机（响应式；「1024 优先 + 768 窄 + UA 兜底」口径，见 viewport.ts） */
const viewportMobile = ref(false);

let routerRef: DeviceDomainRouter | null = null;
let resolveDeviceOverride: InstallThemeDomainOptions['resolveDeviceOverride'] = undefined;

/** 判定一次设备并写入 activeDevice */
function judgeDevice(): void {
  const defs = registeredDevices();
  if (!routerRef || defs.length === 0) return;
  const route = routerRef.currentRoute.value;

  // 宿主注入的设备覆盖（如 ?device=）：命中合法设备直接锁定，压过自动判定
  const override = resolveDeviceOverride?.(route.query) ?? null;
  if (override && defs.some(d => d.id === override)) {
    if (activeDevice.value !== override) activeDevice.value = override;
    return;
  }

  const ctx = deviceContext(route.query, route.path, viewportMobile.value);
  // 兜底 = 末条 fallback 设备的 id（默认设备的指定先不在这里定）
  const fallback = defs[defs.length - 1].id;
  const next = pickDeviceId(defs, ctx, fallback);
  if (activeDevice.value !== next) activeDevice.value = next;
}

/**
 * 装配设备域运行时（`app.use(theme, { router })` 时调用一次）
 *
 * 建立两条响应链：链接变动（`fullPath`）→ 判定；视口变化（两个 matchMedia + UA）→ 判定。
 * 视口口径与宿主 `useDeviceDetect` 一致（宽视口优先 + 窄视口 + UA 兜底），保证设备域
 * 判出的 `currentDevice` 与分发器渲染的形态同源。
 */
export function installThemeDomain(options: InstallThemeDomainOptions): void {
  routerRef = options.router;
  resolveDeviceOverride = options.resolveDeviceOverride;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const desktopMq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const syncViewport = (): void => {
      // 宽视口优先：放得下桌面布局就一律电脑版，UA 说什么都不例外
      if (desktopMq.matches || window.innerWidth >= DESKTOP_MIN_WIDTH) {
        viewportMobile.value = false;
        return;
      }
      // 窄视口直接移动端；中间段（768–1023）交给 UA 兜底（该区间可能是被缩放的桌面浏览器）
      const narrow = mobileMq.matches || window.innerWidth < MOBILE_BREAKPOINT;
      viewportMobile.value = narrow ? true : detectMobileUA();
    };
    syncViewport();
    desktopMq.addEventListener('change', syncViewport);
    mobileMq.addEventListener('change', syncViewport);
  }

  // 🔴 watch fullPath 而非整个路由对象：同路由 query/hash 变化不触发重判
  watch(
    () => options.router.currentRoute.value.fullPath,
    () => judgeDevice(),
    { immediate: true }
  );

  // 视口变化 → 重判
  watch(viewportMobile, () => judgeDevice());
}

/** 当前生效设备（只读响应式，宿主 store 订阅它） */
export function currentDevice(): Readonly<typeof activeDevice> {
  return activeDevice;
}

/** 当前路由 query（`<ThemeView>` 读 URL 版式/配色参数用）；未装配 router 时返回空对象 */
export function currentQuery(): Record<string, unknown> {
  return routerRef?.currentRoute.value.query ?? {};
}

/**
 * 替换当前路由的 query（**保留 `client_id` 等授权上下文**，只增删目标项）
 *
 * 与宿主旧接线壳 `replaceQuery` 同一语义：复制当前 query、应用 patch、`router.replace`。
 * 库不 import vue-router，只认 `router.replace({ query })` 这个最小结构。
 */
export function replaceQuery(patch: Record<string, string | undefined>): void {
  if (!routerRef?.replace) return;
  const current = routerRef.currentRoute.value.query;
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === 'string') query[key] = value;
    else if (Array.isArray(value)) {
      query[key] = value.filter((x): x is string => typeof x === 'string');
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete query[key];
    else query[key] = value;
  }
  void routerRef.replace({ query });
}
