/**
 * 版式加载表（themeViews）的运行时单例 —— 构建产物 → 运行时的手递手收口点
 *
 * 页面契约文件需要「本页有哪些版式组件」，而这份清单来自 virtual:theme 的
 * themeViews。若页面文件直接 import virtual:theme，会在它反过来副作用 import 页面
 * 契约时形成循环。所以同一范式（installThemeRegistry / installThemeManifest）：
 * virtual:theme 模块体把 themeViews 装入本单例，defineThemePage 只在渲染期才取
 * loader —— 注册时零依赖、永不踩循环。
 *
 * 放在 skinsuite/vue 而非纯内核：装载器返回 Vue Component，纯内核零 Vue 依赖。
 */
import type { ViewModuleMap } from './view-registry';

/** 模块级版式加载表单例（`virtual:theme` 装入；未装入时为空表，查询走空兜底） */
let themeViewsSingleton: Record<string, ViewModuleMap> = {};

/** 装入版式加载表（`virtual:theme` 自动装配时调一次） */
export function installThemeViews(views: Record<string, ViewModuleMap>): void {
  themeViewsSingleton = views;
}

/** 按页面名取该页的版式加载表；未装入 / 未登记返回空表（建空注册表，不抛错） */
export function themeViewsFor(page: string): ViewModuleMap {
  return themeViewsSingleton[page] ?? {};
}
