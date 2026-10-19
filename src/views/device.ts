/**
 * 设备清单机制（**纯逻辑半边**）—— 「哪些设备、怎么判定」的唯一实现（内核版）
 *
 * === 设备 = 路由 + 容器 = 版式信息的一部分 ===
 * 「有哪些设备」是宿主的部署事实（每个应用设备不同、容器位置不同），所以**设备清单
 * （`DeviceDef[]`）由宿主声明**；但「怎么从清单判定出当前设备、怎么归一化外部输入、
 * 怎么取容器」是**通用机制**，收在这里 —— 加一种设备时宿主只加一条声明，判定逻辑零改动。
 *
 * === 为什么这里只有「判定」、没有「组件」 ===
 * 本文件是**纯逻辑**（不含 `Component` 类型），能被内核 tsc 独立检查、也能被任何前端复用。
 * `containers` 用泛型 `T` 表达（宿主的「设备容器加载器」是 `T`），组件加载的**具体机制**
 * （`pageContainers` / `resolveContainerOf`）在 `skinsuite/vue` 的 `device-containers`，
 * 那里才 import Vue 的 `Component`。
 *
 * === 判定顺序就是清单顺序（先命中先用），最后一条必须无条件成立 ===
 * 它是兜底设备。宿主关卡会核这一条。
 *
 * === 为什么判定必须收在一处 ===
 * 三个分发器曾经各写一份「mini 来源」判定，口径不一致 → 同一个链接在不同页面落到
 * 不同设备。现在判定只有一份，各页面自然同形。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/devices.ts 下沉）
 */

/** 判定上下文 —— 判定所需的**全部**外部信息（与页面无关的原始事实） */
export interface DeviceMatchContext {
  /** `?isMobile=true` —— 显式意图，优先级最高 */
  explicitMobile: boolean;
  /** 路由 path（不含 query / hash） */
  path: string;
  /** `?from=` 的取值（iframe 来源标记，空串表示没给） */
  from: string;
  /** `?fromLogin=` 的取值（历史键：从 mini 登录页跳来） */
  fromLogin: string;
  /** 视口/UA 判定结果 */
  viewportIsMobile: boolean;
}

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
  /** 本次访问是否属于这台设备（清单顺序 = 优先级，先命中先用） */
  match(ctx: DeviceMatchContext): boolean;
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

/** 从外部输入判定「本次访问属于哪台设备」；清单顺序 = 优先级，返回值永远非空 */
export function pickDeviceId<T>(
  defs: readonly DeviceDef<T>[],
  ctx: DeviceMatchContext,
  defaultDevice: string
): string {
  for (const def of defs) {
    if (def.match(ctx)) return def.id;
  }
  // 清单被改坏（末条不再无条件成立）时的保底
  return defaultDevice;
}

/** 取某设备的容器表；未知设备返回空表（调用方退到兜底设备） */
export function containersOf<T>(
  defs: readonly DeviceDef<T>[],
  id: string
): ReadonlyMap<string, T> {
  return defs.find(def => def.id === id)?.containers ?? new Map();
}

/** 从当前访问信息构造判定上下文 */
export function deviceContext(
  query: Record<string, unknown> | undefined,
  path: string,
  viewportIsMobile: boolean
): DeviceMatchContext {
  const text = (key: string): string =>
    typeof query?.[key] === 'string' ? (query[key] as string) : '';
  return {
    explicitMobile: text('isMobile') === 'true',
    path: path.split(/[?#]/)[0],
    from: text('from'),
    fromLogin: text('fromLogin'),
    viewportIsMobile
  };
}
