/**
 * 页面工厂 —— 「这一页接入可换 UI 机制」的唯一写法
 *
 * 机制（建注册表 + picker）只在这里写一次，页面文件退化为「一份契约类型 + 一次声明」。
 * 版式组件清单由 themeViewsFor(page) 惰性解析（virtual:theme 装单例），注册时零依赖，
 * 不会踩「页面契约 → virtual:theme」的循环。
 *
 * 页面名 = 目录名 = views/<页面>.ts 文件名 = 路由 path 末段，三处字面一致。
 * 本工厂只注册「页面名 → 版式」，不驱动路由、不声明标题（document.title 归路由）。
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
 * 声明一个页面：页面文件里就一行 `defineThemePage({ page: 'login' })`。
 * 版式组件清单由 themeViewsFor(page) 惰性解析；无 device / title / loaders 字段
 * （设备词汇归宿主清单，标题归宿主路由表）。
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
