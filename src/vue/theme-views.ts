/**
 * 版式加载表（`themeViews`）的**运行时单例** —— 构建产物 → 运行时的手递手收口点
 *
 * === 它解决什么 ===
 * 页面契约文件（`views/<page>.ts`）需要「本页有哪些版式组件」才能建注册表，而这份清单
 * 来自构建期插件扫出的虚拟模块 `virtual:theme` 的 `themeViews`。若页面文件直接
 * `import { themeViews } from 'virtual:theme'`，则「页面契约 → virtual:theme」这一条依赖
 * 会在 `virtual:theme` 反过来副作用 import 页面契约时形成循环（页面文件在 `themeViews`
 * 求值前读到 undefined）。
 *
 * 所以这里采用与配色注册表（`installThemeRegistry`）、清单（`installThemeManifest`）同一
 * 范式：`virtual:theme` 模块体把 `themeViews` **装入本单例**，`defineThemePage` 只在**取名
 * 的那一刻**（渲染期）从这里取 loader —— 注册时零依赖、永不踩循环。
 *
 * === 为什么不在纯内核 `skinsuite`，而在 `skinsuite/vue` ===
 * `themeViews` 的装载器返回 Vue `Component`，纯内核零 Vue 依赖，装不下这份类型。
 *
 * @author yijiu2025
 * @since 2026-10-18
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
