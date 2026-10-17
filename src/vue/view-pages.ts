/**
 * 页面版式总览 —— 「哪些页面接了可换 UI、各自有哪些版式」的可编程查询（内核版）
 *
 * 各页面的注册表文件各自调 `defineThemePage`，彼此独立、互不感知。本模块负责把「一批
 * 页面模块」汇总成一张可查询的表 —— 新增页面不用回来改这里。
 *
 * === 为什么 glob 在宿主、汇总机制在内核 ===
 * `import.meta.glob('./*.ts')` 的模式必须是**字面量**（Vite 编译期静态展开），所以
 * 「扫哪些页面文件」这个动作只能在宿主做（`views/pages.ts` 宿主壳里）。本模块只收
 * 「已经拿到一批模块后怎么汇总、怎么查询」的**机制** —— 模块表作为参数传进来。
 *
 * === 兜底判据为什么是 `Record<keyof ViewRegistry, …>` ===
 * 手抄成员名判据会静默落后于接口（实锤：`ViewRegistry.list()` 删除后判据还留着它，
 * 导致页面汇总恒为空、调试面板版式区永久不渲染、零报错）。换成 `Record<keyof …>` 后
 * 穷尽性由 TS 保证：接口加成员而不在这里分类，直接编译失败。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/pages.ts 下沉）
 */
import type { ViewRegistry } from './view-registry';
import { createViewPicker, type ViewPicker } from './view-picker';
import { isThemePage } from './view-page';

/** 一个页面接入版式机制后的可查询信息 */
export interface PageViews {
  page: string;
  title: string;
  titleOf(device: string): string;
  registry: ViewRegistry;
  pick: ViewPicker['pick'];
  preload: ViewPicker['preload'];
  packages: Array<{ pkg: string; device: string; ids: string[] }>;
}

/**
 * 兜底判据：一个模块直接导出了**裸注册表**（没走页面工厂）时，怎么认出它。
 * 首选判据是页面工厂的运行时标记（`isThemePage`）；这张形态表只服务「没走工厂、
 * 直接导出一个裸注册表」的模块（向后兼容 / 外部页面）。
 */
const VIEW_REGISTRY_SHAPE: Record<keyof ViewRegistry, 'string' | 'function'> = {
  baseId: 'string',
  builtinPackage: 'string',
  packages: 'function',
  has: 'function',
  resolve: 'function',
  load: 'function'
};

/** 键集合来自接口；逐项核形态。一个模块里只要有一个对象满足就认它是注册表实例 */
function isViewRegistryShape(value: unknown): value is ViewRegistry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (Object.keys(VIEW_REGISTRY_SHAPE) as (keyof ViewRegistry)[]).every(
    key => typeof candidate[key] === VIEW_REGISTRY_SHAPE[key]
  );
}

/** 页面名白名单（= 版式目录名 = 路由 path 末段；与主题 id 同规则） */
const PAGE_RE = /^[a-z0-9-]+$/;

/** 设备归一化宿主事实（供「裸注册表」分支构造 picker 时用） */
export interface PageSummaryHost {
  defaultDevice: string;
  asKnownDevice(raw: unknown): string | null;
}

/**
 * 从「一批页面模块」汇总成页面表
 *
 * @param registryModules 宿主的 `import.meta.glob('./*.ts', { eager: true })` 结果
 * @param host            设备归一化（供「裸注册表」分支构造 picker）
 * @param onWarn          告警回调（内核零 console；宿主注入 `console.warn`）
 */
export function buildPages(
  registryModules: Record<string, Record<string, unknown>>,
  host: PageSummaryHost,
  onWarn?: (msg: string) => void
): Map<string, PageViews> {
  const pages = new Map<string, PageViews>();

  for (const [key, mod] of Object.entries(registryModules)) {
    // 从文件名切出页面名：`./register.ts` → `register`。工厂/本文件等不含页面对象的模块
    // 会被下面两道判定自然跳过。
    const filePage = /^\.\/(.+)\.ts$/.exec(key)?.[1];
    if (!filePage || !PAGE_RE.test(filePage)) continue;

    // ① 首选：页面工厂的产物（带运行时标记 —— 判据不会随接口漂移）
    const page = Object.values(mod).find(isThemePage);
    if (page) {
      if (page.page !== filePage) {
        onWarn?.(
          `[view] ${key} 里声明的 page 是「${page.page}」，与文件名「${filePage}」不一致：` +
            '主题目录名 / 页面文件名 / 路由末段三处必须字面一致。'
        );
      }
      pages.set(filePage, {
        page: page.page,
        title: page.title,
        titleOf: page.titleOf,
        registry: page.views,
        pick: page.pick,
        preload: page.preload,
        packages: page.views.packages()
      });
      continue;
    }

    // ② 兼容：模块里直接导出了一个裸注册表（未走工厂的页面）。
    const registry = Object.values(mod).find(isViewRegistryShape);
    if (!registry) continue;
    const picker = createViewPicker({ registry, ...host });
    pages.set(filePage, {
      page: filePage,
      title: filePage,
      titleOf: () => filePage,
      registry,
      pick: picker.pick,
      preload: picker.preload,
      packages: registry.packages()
    });
  }

  return pages;
}

/** 按页面名取；该页面未接入版式机制时返回 undefined */
export function viewsForPageOf(
  pages: Map<string, PageViews>,
  page: string | undefined
): PageViews | undefined {
  return page ? pages.get(page) : undefined;
}

/** 所有接了可换 UI 的页面（按页面名排序，保证面板里的顺序稳定） */
export function listPageViewsOf(pages: Map<string, PageViews>): PageViews[] {
  return [...pages.values()].sort((a, b) => a.page.localeCompare(b.page));
}
