/**
 * 设备清单机制（**纯逻辑半边**）—— 只描述「有哪些设备、占哪条路由、容器在哪」
 *
 * === 🔴 判定不在这里（2026-10-19 收口）===
 * 「当前属于哪台设备」是**宿主的业务判定**，不是通用机制：
 *   · 视口阈值（768 / 1024）、UA 兜底口径 —— 换个产品就变
 *   · 宿主自己的 URL 词汇（`?isMobile` / `?from=mini` / `?device=` 锁定）—— 更是宿主专有
 * 一旦下沉，库就得认识这些词汇，别的宿主复用机制时被迫沿用同一套约定；而本库对外
 * 承诺的只有「设备域」这件机制本身。
 *
 * 所以判定改成**注入点**：宿主给 `app.use(theme, { router, resolveDevice })` 传一个
 * `(ctx) => deviceId | null`，库把 router 的 `query / path / fullPath` **原样**递过去
 * （只递事实，不带任何词汇），由宿主自己决定。库只负责：注册清单、记住当前设备、
 * 通知订阅方、按设备取容器。
 *
 * 由此「加一种设备」= 宿主加一条声明 + 一条判定分支，**库零改动**。
 *
 * === 为什么这里只有「设备」、没有「组件」 ===
 * 本文件是**纯逻辑**（不含 `Component` 类型），能被内核 tsc 独立检查、也能被任何前端
 * 复用。`containers` 用泛型 `T` 表达（宿主的「设备容器加载器」是 `T`），组件加载的
 * **具体机制**（`pageContainers` / `resolveContainerOf`）在 `skinsuite/vue` 的
 * `device-containers`，那里才 import Vue 的 `Component`。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/devices.ts 下沉）
 * @since 2026-10-19（判定层撤出：`match` / `DeviceMatchContext` / `pickDeviceId` /
 *        `deviceContext` 全删，改为宿主注入 `resolveDevice`）
 */

/** 一条设备声明（`containers` 是泛型：纯逻辑侧不关心它到底是什么，只透传） */
export interface DeviceDef<T = unknown> {
  /** 设备 id = 主题包内的目录名，只允许 `[a-z0-9-]` */
  id: string;
  /** 中文名（调试面板 / 日志用） */
  label: string;
  /** 缩写名（URL 专属参数后缀用，如 `?th_<urlKey>` / `?th_color_<urlKey>`）；缺省回落 `id` */
  urlKey?: string;
  /** 该设备在某页的容器（分发器渲染它）；返回 undefined 表示「该设备没有这一页的容器」 */
  containers: ReadonlyMap<string, T>;
  /** 该设备在路由表里占的 path（相对根，`{page}` 由页面名替换） */
  routePath(page: string): string;
}

/** 归一化外部传入的设备名；不认识的取值返回 null（**不是**落默认设备） */
export function asDeviceId<T extends string>(
  known: readonly string[],
  raw: unknown
): T | null {
  return typeof raw === 'string' && (known as readonly string[]).includes(raw)
    ? (raw as T)
    : null;
}

/** 设备 id → 中文名（调试面板用；加设备不必再改面板） */
export function deviceLabel<T>(defs: readonly DeviceDef<T>[], id: string): string {
  return defs.find(def => def.id === id)?.label ?? id;
}

/** 取某设备的容器表；未知设备返回空表（调用方退到兜底设备） */
export function containersOf<T>(
  defs: readonly DeviceDef<T>[],
  id: string
): ReadonlyMap<string, T> {
  return defs.find(def => def.id === id)?.containers ?? new Map();
}
