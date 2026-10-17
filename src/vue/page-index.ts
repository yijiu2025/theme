/**
 * 页面索引工厂 —— 「一批页面模块 → 可查询的页面表 + 路径投影」的**唯一实现**（内核版）
 *
 * === 为什么要有它 ===
 * 宿主的 `views/pages.ts` 曾经既写 `import.meta.glob`（只能留在宿主：模式必须是字面量），
 * 又要转发 `listPageViews` / `viewsForPage` / `pageFromPath` 三个查询函数。本工厂把
 * 「拿到模块后怎么汇总、怎么按名查询、怎么按路径投影」收成一步：宿主只写一行 glob，
 * 调一次 `createPageIndex(registryModules, host)`，三个查询函数就位。
 *
 * === glob 为什么留在宿主 ===
 * `import.meta.glob('./*.ts')` 的模式必须是**字面量**（Vite 编译期静态展开），所以
 * 「扫哪些页面文件」这个动作只能在宿主做。本工厂只收「已经拿到一批模块后」的机制。
 *
 * === 路径投影为什么参数化 ===
 * `pageFromPath(path)` 靠主题清单的 `routes` 投影把「路径 → 页面名」。清单是宿主的
 * 部署事实（`themeManifest.routes`），内核不 import 虚拟模块，故通过 `routes` 参数注入；
 * `resolvePage` 是「路径 → 页面名」的纯函数，由宿主从 `skinsuite` 取。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/pages.ts 的转发函数收编）
 */
import { buildPages, listPageViewsOf, viewsForPageOf } from './view-pages';
import type { PageSummaryHost, PageViews } from './view-pages';

export type { PageViews } from './view-pages';

/** 「路径 → 页面名」的投影函数（宿主用 `resolveThemePage(manifest.routes, path)` 提供，未命中返回 null） */
export type PagePathResolver = (path: string) => string | null | undefined;

export interface PageIndexOptions extends PageSummaryHost {
  /** 路径投影（`resolveThemePage(manifest.routes, path)`）；缺省则 `pageFromPath` 恒返回 undefined */
  resolvePage?: PagePathResolver;
  /** 告警回调（内核零 console；宿主注入 `console.warn`） */
  onWarn?: (msg: string) => void;
}

/**
 * 一套页面索引 —— 宿主「页面版式总览」的**全部**能力
 *
 * 所有函数都已绑定传入的 glob 结果与 host，调用方不再需要每次传 `pages` 表。
 */
export interface PageIndex {
  /** 汇总后的页面表（内部结构，一般不经此暴露；查询走下面三个函数） */
  readonly pages: Map<string, PageViews>;
  /** 所有接了可换 UI 的页面（按页面名排序，保证面板顺序稳定） */
  listPageViews(): PageViews[];
  /** 按页面名取；该页面未接入版式机制时返回 undefined */
  viewsForPage(page: string | undefined): PageViews | undefined;
  /** 路径 → 页面名（靠 `resolvePage` 投影）；未投影 / 未接入时返回 undefined */
  pageFromPath(path: string): string | undefined;
}

/**
 * 从「一批页面模块」装配出整套页面查询机制
 *
 * @param registryModules 宿主的 `import.meta.glob('./*.ts', { eager: true })` 结果
 * @param options          设备归一化 + 路径投影 + 告警回调
 *
 * @example
 * ```ts
 * const registryModules = import.meta.glob<Record<string, unknown>>('./*.ts', { eager: true });
 * export const pages = createPageIndex(registryModules, {
 *   defaultDevice: DEFAULT_THEME_DEVICE,
 *   asKnownDevice: asThemeDevice,
 *   resolvePage: path => resolveThemePage(themeManifest.routes, path),
 *   onWarn: import.meta.env.DEV ? console.warn : undefined
 * });
 * ```
 */
export function createPageIndex(
  registryModules: Record<string, Record<string, unknown>>,
  options: PageIndexOptions
): PageIndex {
  const { resolvePage, onWarn, ...host } = options;
  const pages = buildPages(registryModules, host, onWarn);

  return {
    pages,
    listPageViews: () => listPageViewsOf(pages),
    viewsForPage: (page: string | undefined) => viewsForPageOf(pages, page),
    pageFromPath: (path: string) => {
      const page = resolvePage?.(path);
      return page && pages.has(page) ? page : undefined;
    }
  };
}
