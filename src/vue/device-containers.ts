/**
 * 设备容器机制（**组件半边**）—— 「设备 id → 该页容器组件」的加载（内核版）
 *
 * 纯逻辑半边（设备判定 / 归一化 / 取容器表）在 `skinsuite` 的 `views/device.ts`；
 * 本文件补上**组件**相关的一半：从 glob 结果建「页面 → 加载器」表、按设备取容器加载器。
 *
 * 之所以拆成两半：`import type { Component } from 'vue'` 让本文件只能住在 Vue 绑定层
 * （`skinsuite/vue`），而判定逻辑是纯函数、值得被内核 tsc 独立检查、也能被非 Vue 前端复用。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/devices.ts 下沉）
 */
import type { Component } from 'vue';
import type { DeviceDef } from '../views/device';
import { containersOf } from '../views/device';

/** 设备容器的惰性加载器（与 `import.meta.glob` 的取值形态一致） */
export type DeviceContainerLoader = () => Promise<{ default: Component }>;

/**
 * 从「一批容器文件」建「页面 → 加载器」表
 *
 * 位置约定：`<...>/<页面名>/<文件名>.vue` —— **页面名 = 文件所在目录名**。
 * 各设备用自己的 glob + 文件名规则调它，于是「容器放在哪、叫什么」是该设备自己的声明。
 */
export function pageContainers(
  mods: Record<string, DeviceContainerLoader>,
  fileRe: RegExp,
  idRe: RegExp
): ReadonlyMap<string, DeviceContainerLoader> {
  const map = new Map<string, DeviceContainerLoader>();
  for (const [key, loader] of Object.entries(mods)) {
    const parts = key.split('/');
    const file = parts[parts.length - 1];
    // 页面名 = 文件上一级目录名（`/src/view/app/login/index.vue` → `login`）
    const page = parts[parts.length - 2];
    if (!page || !file || !fileRe.test(file)) continue;
    // 页面名同样进 data-* / 路由，走同一份白名单；不合规目录静默跳过
    if (!idRe.test(page)) continue;
    if (!map.has(page)) map.set(page, loader);
  }
  return map;
}

/** 取某设备在某页的容器加载器；该设备没写这一页时返回 undefined */
export function containerOf(
  defs: readonly DeviceDef<DeviceContainerLoader>[],
  id: string,
  page: string
): DeviceContainerLoader | undefined {
  return containersOf(defs, id).get(page);
}

/**
 * 取某设备在某页的容器加载器，**没写时兜底到末条设备**（声明顺序即优先级）
 *
 * 分发器用它做「设备 id → 该页容器」的数据化映射：加一种设备时，只要给它写了容器，
 * 分发器就能渲染；没写则该设备退到兜底设备 —— 不再写死「mobile ? X : mini ? Y : Standard」。
 *
 * 🔴 兜底目标取**末条声明**，不写死 `'standard'`（2026-10-19）：具体设备名是宿主的词汇，
 *    库只认「声明顺序，末条兜底」这条机制。宿主把兜底设备放末条即可。
 */
export function resolveContainerOf(
  defs: readonly DeviceDef<DeviceContainerLoader>[],
  id: string,
  page: string
): DeviceContainerLoader {
  const fallback = defs[defs.length - 1]?.id;
  return (
    containerOf(defs, id, page) ??
    (fallback === undefined ? undefined : containerOf(defs, fallback, page)) ??
    (() =>
      Promise.reject(
        new Error(`[theme] 设备「${id}」在页面「${page}」没有容器，也没有兜底设备`)
      ))
  );
}
