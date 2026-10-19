/**
 * 设备域运行时 —— 维护「当前生效设备」这一状态，判定交给宿主
 *
 * 与 `define-theme-device`（声明工厂）配对：宿主声明设备清单（自动注册），本文件维护
 * 「当前属于哪台设备」，供宿主 store 订阅、供 token 注入 / 版式查找取用。
 *
 * === 🔴 判定归宿主（2026-10-19 收口）===
 * 本文件**不认识**视口阈值、UA、`?isMobile`、`?from=mini`、`?device=` 这些词汇 ——
 * 它们都是宿主的产品约定。库只把 router 上的事实（`query / path / fullPath`）原样
 * 交给宿主注入的 `resolveDevice`，拿回一个设备 id；不合法/返回 null 就落到兜底设备
 * （清单末条）。
 *
 * 宿主自己知道「什么时候该重判」（视口变了、UA 变了、自己的开关变了），所以本文件
 * 额外暴露 `refreshDevice()` 让宿主主动触发 —— 库**不订阅** `matchMedia`，也就不会
 * 和宿主的响应式口径打架。
 *
 * === 为什么库只认 router 的最小结构 ===
 * 库不 import vue-router（应用世界观），只认 `currentRoute.value.{ query, path, fullPath }`
 * 这三个字段 —— 宿主把 router 传进来（`app.use(theme, { router, resolveDevice })`）。
 *
 * @author yijiu2025
 * @since 2026-10-18
 * @since 2026-10-19（`matchMedia` / 视口 / `resolveDeviceOverride` 撤出，改 `resolveDevice` + `refreshDevice`）
 */
import { ref, watch } from 'vue';
import { registeredDevices } from './define-theme-device';

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

/**
 * 交给宿主的**判定输入** —— 只有事实，没有任何词汇
 *
 * 宿主在这里自己决定：视口宽窄、UA、`?isMobile`、`?from=mini`、`?device=` 锁定……
 * 都是宿主的事；库不参与、也不缓存这些概念。
 */
export interface DeviceDomainContext {
  /** 当前路由 query */
  query: Record<string, unknown>;
  /** 路由 path（不含 query / hash） */
  path: string;
  /** 完整路径（宿主可用于自己的来源判断） */
  fullPath: string;
}

export interface InstallThemeDomainOptions {
  router: DeviceDomainRouter;
  /**
   * 宿主判定「本次访问属于哪台设备」：返回设备 id，`null` = 交给兜底设备。
   *
   * 返回未知 id 时按 `null` 处理（不信任宿主手滑写错的名字）。
   * 🔴 这是**唯一的判定入口** —— 库内没有任何默认判定实现。
   */
  resolveDevice?: (ctx: DeviceDomainContext) => string | null;
}

/** 当前生效设备（响应式；宿主 store 从这里订阅） */
const activeDevice = ref<string>('');

let routerRef: DeviceDomainRouter | null = null;
let resolveDevice: InstallThemeDomainOptions['resolveDevice'];

/**
 * 判定一次设备并写入 `activeDevice`
 *
 * 优先宿主 `resolveDevice` 的结果；返回 null / 未知 id → 清单末条（兜底设备）。
 */
function judgeDevice(): void {
  const defs = registeredDevices();
  if (!routerRef || defs.length === 0) return;
  const route = routerRef.currentRoute.value;

  const picked = resolveDevice?.({ query: route.query, path: route.path, fullPath: route.fullPath });
  const known = picked !== null && picked !== undefined && defs.some(d => d.id === picked);
  const next = known ? (picked as string) : defs[defs.length - 1].id;
  if (activeDevice.value !== next) activeDevice.value = next;
}

/**
 * 装配设备域运行时（`app.use(theme, { router, resolveDevice })` 时调用一次）
 *
 * 只建一条响应链：路由 `fullPath` 变动 → 判定。
 * 视口 / UA / 宿主其它信号变化时，宿主自己调 `refreshDevice()`。
 */
export function installThemeDomain(options: InstallThemeDomainOptions): void {
  routerRef = options.router;
  resolveDevice = options.resolveDevice;

  // 🔴 watch fullPath 而非整个路由对象：同路由 query/hash 变化不触发重判
  watch(
    () => options.router.currentRoute.value.fullPath,
    () => judgeDevice(),
    { immediate: true }
  );
}

/**
 * 让宿主在**自己的信号变化时**主动重判（视口、UA、自己存的开关……）
 *
 * 幂等、廉价；未装配 router 时是空操作。
 */
export function refreshDevice(): void {
  judgeDevice();
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
