/**
 * 设备域运行时 —— **只保留「当前路由 query」这一条通道**（设备判定在宿主侧，2026-10-20）
 *
 * === 为什么判定不在这里 ===
 * 「当前渲染视图属于哪台设备」由**宿主的分发器**决定（如 `login/index.vue` 按视口 /
 * `?device=` 锁定选设备容器），设备身份由容器里的 `<ThemeView page="login" device="mini">`
 * props 告知主题 store（`setActiveDevice`）。库因此**不认识**视口阈值、UA、`?isMobile`、
 * `?from=mini`、`?device=` 这些词汇 —— 那些是宿主的产品约定。
 *
 * === 现在还留着什么 ===
 * `installThemeDomain({ router })` 装配后，`currentQuery()` 给版式意图（`th` / `th_<urlKey>`）
 * 的 store 化同步用（`create-theme-state` watch 它）；`replaceQuery` 留给需要改 URL 的场景。
 *
 * @author yijiu2025
 * @since 2026-10-18
 * @since 2026-10-19（`matchMedia` / 视口 / `resolveDeviceOverride` 撤出，改 `resolveDevice` + `refreshDevice`）
 * @since 2026-10-20（判定整条线撤出：`resolveDevice` / `currentDevice` / `refreshDevice` / `currentPath`
 *                     删除，设备由 ThemeView props 告知；本模块只剩 currentQuery / replaceQuery）
 */

/** 路由的最小结构（库不 import vue-router，只认这些字段） */
export interface DeviceDomainRouter {
  currentRoute: {
    value: {
      query: Record<string, unknown>;
      path: string;
      fullPath: string;
    };
  };
  /** 替换当前路由（保留 path，只改 query；需要改 URL 的场景用） */
  replace?(to: { query: Record<string, string | string[] | undefined> }): unknown;
}

export interface InstallThemeDomainOptions {
  router: DeviceDomainRouter;
}

let routerRef: DeviceDomainRouter | null = null;

/**
 * 装配设备域运行时（`app.use(theme, { router })` 时调用一次）
 *
 * 只记 router 引用（`currentQuery()` 用）；不建任何 watch —— 设备判定在宿主分发器，
 * 版式意图同步的 watch 在编排层（`create-theme-state`）。
 */
export function installThemeDomain(options: InstallThemeDomainOptions): void {
  routerRef = options.router;
}

/** 当前路由 query（`<ThemeView>` 读 URL 版式/配色参数、编排层同步版式意图用）；未装配时返回空对象 */
export function currentQuery(): Record<string, unknown> {
  return routerRef?.currentRoute.value.query ?? {};
}

/**
 * 替换当前路由的 query（**保留 `client_id` 等授权上下文**，只增删目标项）
 *
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
