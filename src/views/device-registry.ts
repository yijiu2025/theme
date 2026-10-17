/**
 * 设备注册表工厂 —— 「一份设备清单 → 全套判定机制」的**唯一实现**（内核版）
 *
 * === 为什么要有它 ===
 * 宿主（oauth21 等）曾经在 `views/devices.ts` 里既要写清单（`DeviceDef[]`），又要逐个
 * re-export 内核的判定函数（`deviceLabel` / `pickDeviceId` / `containersOf` / …），
 * 每个新项目都要把这一串转发函数抄一遍 —— 那是纯样板。本工厂把「清单 → 机制」收成
 * 一步：宿主只写一份 `DeviceDef[]`，调一次 `createDeviceRegistry(defs)`，全套判定函数
 * 就位，且都绑定了这份清单、参数顺序按宿主直觉收敛（不再要求每个调用点传 defs）。
 *
 * === 与 `views/device.ts` 的关系 ===
 * `device.ts` 是**无状态纯函数**（`pickDeviceId(defs, ctx, …)` 每次传清单），供内核
 * 内部与「清单还没装进注册表」的场景用；本文件是它的**装配层**——把清单闭包进去，
 * 产出「已绑定清单」的面向宿主的 API。组件半边（`containerOf` / `resolveContainerOf`）
 * 住在 `skinsuite/vue` 的 `device-containers.ts`，本文件的工厂也收那一半。
 *
 * === 为什么设备是宽 `string` + 白名单参数 ===
 * 内核不认识宿主的设备词汇表（哪些目录名算合法设备是宿主的部署事实），所以：
 *   · 判定函数对外都收 `string`、返回 `string`；
 *   · 「合法取值集合」由清单派生（`DeviceRegistry.devices`）；
 *   · 「归一化外部输入」用清单派生的白名单（`asKnownDevice`）——不再要求宿主另传。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/devices.ts 的转发函数收编）
 */
import { containersOf } from './device.js';
import type { DeviceDef, DeviceMatchContext } from './device.js';
import { asDeviceId, deviceContext, deviceLabel, pickDeviceId } from './device.js';

export type { DeviceDef, DeviceMatchContext } from './device.js';

/**
 * 一套设备注册表 —— 宿主「设备这件事」的**全部**能力
 *
 * 所有函数都已绑定传入的清单，调用方不再需要每次传 `defs`。
 * `T` 是容器加载器的类型（纯逻辑侧透传、不关心它到底是什么）。
 */
export interface DeviceRegistry<T = unknown> {
  /** 设备 id 清单（顺序即优先级）—— 词汇表的**唯一来源** */
  readonly defs: readonly DeviceDef<T>[];
  /** 设备 id 数组（顺序即优先级） */
  readonly devices: readonly string[];
  /** 兜底设备 id */
  readonly defaultDevice: string;
  /** 设备 id → 中文名（调试面板 / 日志用；未知 id 原样返回） */
  deviceLabel(id: string): string;
  /** 归一化外部传入的设备名；不认识的取值返回 null（**不是**落默认设备） */
  asKnownDevice(raw: unknown): string | null;
  /** 从外部输入判定「本次访问属于哪台设备」；返回值永远非空（落 defaultDevice） */
  pickDeviceId(ctx: DeviceMatchContext): string;
  /** 取某设备的容器表（`containers` 是泛型 T，原样透传） */
  containersOf(id: string): ReadonlyMap<string, T>;
  /** 从当前访问信息构造判定上下文 */
  deviceContext(
    query: Record<string, unknown> | undefined,
    path: string,
    viewportIsMobile: boolean
  ): DeviceMatchContext;
}

export interface DeviceRegistryOptions {
  /** 兜底设备 id（判定全 miss 时返回）；缺省取清单最后一条的 id */
  defaultDevice?: string;
}

/**
 * 从一份设备清单装配出整套设备机制
 *
 * @param defs 设备清单（顺序即优先级，末条建议无条件命中作兜底）
 * @param options 兜底设备等可选项
 *
 * @example
 * ```ts
 * const registry = createDeviceRegistry(THEME_DEVICE_DEFS, { defaultDevice: 'mobile' });
 * registry.pickDeviceId(registry.deviceContext(query, path, isMobile));
 * registry.asKnownDevice('mini'); // → 'mini' | null
 * ```
 */
export function createDeviceRegistry<T>(
  defs: readonly DeviceDef<T>[],
  options: DeviceRegistryOptions = {}
): DeviceRegistry<T> {
  const defaultDevice = options.defaultDevice ?? defs[defs.length - 1]?.id ?? '';
  const devices = defs.map(def => def.id);

  return {
    defs,
    devices,
    defaultDevice,
    deviceLabel: (id: string) => deviceLabel(defs, id),
    asKnownDevice: (raw: unknown) => asDeviceId(devices, raw),
    pickDeviceId: (ctx: DeviceMatchContext) => pickDeviceId(defs, ctx, defaultDevice),
    containersOf: (id: string) => containersOf(defs, id),
    deviceContext
  };
}
