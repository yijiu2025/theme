/**
 * 页面工厂 —— 「这一页接入可换 UI 机制」的**唯一写法**（内核版）
 *
 * === 它收掉的是什么 ===
 * 三个页面文件原先各自抄了一遍同样的机制：声明 glob → `createViewRegistry` →
 * `createViewPicker` → 两个转发函数。机制逐字相同，改一条口径要改三处。现在机制只在
 * 这里写一次，页面文件退化成「一份契约 + 一次声明」。
 *
 * === 版式组件从哪来 ===
 * `themeViews` 来自 `virtual:theme` 插件（主题目录 = `VITE_THEME_DIR`，构建期扫
 * `themes/<包>/<设备>/<页面>/index.vue` 按页面分组）。页面文件**不自己 glob、也不 import
 * `virtual:theme`**：`loaders` 在取名（渲染期）由 `themeViewsFor(page)` 惰性解析 ——
 * 注册时零依赖，`virtual:theme` 反过来副作用 import 页面文件时才不会踩循环。
 *
 * === 页面名从哪来 ===
 * 页面名同时是：目录名、`views/<页面>.ts` 的文件名、路由 path 的末段。三处必须字面一致。
 *
 * === 页面身份与路由的关系（2026-10-18 解耦）===
 * 页面清单是**宿主事实**（router 固定声明 `/<page>` 等主路由），本工厂只注册
 * 「页面名 → 版式」，**不驱动路由、不声明标题**（`document.title` 归路由）。容器里
 * `<ThemeView page="...">` 的 `page` 与路由 path 靠字面一致对齐。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/page.ts 下沉；2026-10-18 惰性 loader 解析）
 */
import type { ViewRegistry, ViewPickerSource } from './view-registry';
import { createViewRegistry, createViewPicker } from './view-registry';
import { themeViewsFor } from './theme-views';

/** 页面对象的运行时标记（`Symbol.for` = 跨模块实例也同一个键） */
const PAGE_BRAND = Symbol.for('mauth.themePage');

export interface ThemePageOptions {
  /** 页面名（目录名 / 文件名 / 路由末段三处一致） */
  page: string;
}

/** 一个页面接入版式机制后的全部能力（页面文件的公开面就长这样） */
export interface ThemePage {
  readonly page: string;
  readonly views: ViewRegistry;
  pick(source?: ViewPickerSource): string;
}

/** 已自动注册的页面（页面域；按页面名取 `ThemePage`） */
const registeredPages = new Map<string, ThemePage>();

/**
 * 声明一个页面
 *
 * 用法（页面文件里就这么多）：
 * ```ts
 * defineThemePage({ page: 'login' });
 * ```
 *
 * 无 `device` 字段：设备归一化由设备域自动提供。
 * 无 `envView` 字段：部署级默认版式（`VITE_<PAGE>_VIEW`）机制已取消。
 * 无 `title` 字段：标题（`document.title`）是路由职责，由宿主路由表声明（router 与主题分层）。
 * 无 `loaders` 字段：版式组件清单由 `themeViewsFor(page)` 惰性解析（`virtual:theme` 装单例）。
 */
export function defineThemePage(options: ThemePageOptions): ThemePage {
  const { page } = options;
  const views = createViewRegistry(() => themeViewsFor(page), { page });
  const picker = createViewPicker({ registry: views });

  const result: ThemePage = {
    page,
    views,
    pick: (source: ViewPickerSource = {}) => picker.pick(source)
  };
  // 标记不可枚举：它只是个身份戳，不该出现在日志 / 序列化里
  Object.defineProperty(result, PAGE_BRAND, { value: true, enumerable: false });
  registeredPages.set(page, result);
  return result;
}

/** 这个值是不是 `defineThemePage` 的产物 */
export function isThemePage(value: unknown): value is ThemePage {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<PropertyKey, unknown>)[PAGE_BRAND] === true
  );
}

/** 按页面名取已注册的页面（`<ThemeView>` 内部用）；未注册返回 undefined */
export function pageOf(name: string): ThemePage | undefined {
  return registeredPages.get(name);
}

/** 已注册的页面名清单（调试面板用） */
export function registeredPageNames(): readonly string[] {
  return [...registeredPages.keys()];
}

/** 重置模块级页面域（单测 / HMR 用） */
export function resetPages(): void {
  registeredPages.clear();
}
