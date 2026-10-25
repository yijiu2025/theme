/**
 * 部件加载表（themeParts）的运行时单例 —— 与 theme-views.ts 同一范式
 *
 * virtual:theme 模块体把 themeParts 装入本单例，<ThemePart> 渲染期按 (包 × 设备 ×
 * 部件 id) 从这里取 loader；未装入时为空表（渲染缺省 + dev 警告，不抛错）。
 * 键形：./<包>/<设备>/parts/<部件id>/index.vue（相对 themes/，./ 开头）。
 */
import type { Component } from 'vue';

/** 部件加载器形态（与版式同构：default 包 eager 同步、其余惰性 Promise） */
export type PartModuleLoader = () => { default: Component } | Promise<{ default: Component }>;

/** 按部件 id 分组的加载表：`themeParts.<部件id>` = 该部件各「包 × 设备」的加载器 */
export type PartModuleMap = Record<string, PartModuleLoader>;

/** 模块级部件加载表单例（`virtual:theme` 装入；未装入时为空表） */
let themePartsSingleton: Record<string, PartModuleMap> = {};

/** 装入部件加载表（`virtual:theme` 自动装配时调一次） */
export function installThemeParts(parts: Record<string, PartModuleMap>): void {
  themePartsSingleton = parts;
}

/** 按部件 id 取该部件的加载表；未装入 / 未登记返回空表（不抛错） */
export function themePartsFor(partId: string): PartModuleMap {
  return themePartsSingleton[partId] ?? {};
}
