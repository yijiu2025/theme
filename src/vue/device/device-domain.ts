/**
 * 设备域运行时 —— 只保留「当前路由 query」这一条通道
 *
 * 设备判定整条线在宿主侧（分发器按视口 / ?device= 等口径选容器，设备身份由
 * <ThemeView device> props 告知 store），库不认识这些词汇。
 *
 * 这里只剩：installThemeDomain({ router }) 装配后 currentQuery() 给版式意图的
 * store 化同步用（create-theme-state watch 它）；replaceQuery 留给需要改 URL 的场景。
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
/** 无 router 时的 query 快照（首次 currentQuery() 读一次 location.search；无路由应用的 URL 本来不变） */
let routerlessQuery: Record<string, unknown> | null = null;

/**
 * 装配设备域运行时（`app.use(theme, { router })` 时调用一次）
 *
 * 只记 router 引用（`currentQuery()` 用）；不建任何 watch —— 设备判定在宿主分发器，
 * 版式意图同步的 watch 在编排层（`create-theme-state`）。
 */
export function installThemeDomain(options: InstallThemeDomainOptions): void {
  routerRef = options.router;
}

/**
 * 无 router 时的 query：**装载时读一次** `location.search`，转成 vue-router 的
 * `LocationQuery` 形态（重复键折叠为数组）—— 版式侧 `readUrlViewIntent` 的 `present()`
 * 拒绝数组 ⇒ `?th=a&th=b` 按未指定，与路由形态逐字同口径。
 * 只读一次不追变更：无路由应用没有路由器推 history，URL 装载后不会自己变。
 */
function readRouterlessQuery(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      for (const [key, value] of new URLSearchParams(window.location.search)) {
        const prev = out[key];
        if (prev === undefined) out[key] = value;
        else if (Array.isArray(prev)) prev.push(value);
        else out[key] = [prev, value];
      }
    }
  } catch {
    /* SSR / 异常环境 → 空 query */
  }
  return out;
}

/**
 * 当前路由 query（`<ThemeView>` 读 URL 版式/配色参数、编排层同步版式意图用）；
 * 未装配 router 时回退 location.search 一次性快照（无路由应用，见文件头）
 */
export function currentQuery(): Record<string, unknown> {
  if (routerRef) return routerRef.currentRoute.value.query;
  if (!routerlessQuery) routerlessQuery = readRouterlessQuery();
  return routerlessQuery;
}

/**
 * 替换当前路由的 query（保留既有业务参数如授权上下文，只增删目标项）
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
