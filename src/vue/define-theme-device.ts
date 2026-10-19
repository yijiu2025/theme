/**
 * 设备声明工厂 —— `defineThemeDevice`（声明式，自动注册进设备域）
 *
 * 宿主只写一条声明（`id` / `label` / `urlKey` / `containers` 三参数 / `routePath` /
 * 声明式 `match`），机制全在库内：`pageContainers` 建容器表、声明式 `match` → 判定函数、
 * 自动注册进设备域。宿主不再写 `createDeviceRegistry` 装配、不再手动组数组、不再转发
 * `asKnownDevice`。
 *
 * === 声明式 match 的优先级规则（库内唯一实现）===
 * 字段间 OR；`explicitMobile` 是**全局最高优先信号** —— 一旦 `ctx.explicitMobile=true`，
 * 带 `from`/`fromLogin`/`pathSegment` 的条目直接跳过，落到 `explicitMobile: true` 的条目
 * （mobile）。宿主不再手写「排除显式手机意图」的 `!explicitMobile`。
 *
 * @author yijiu2025
 * @since 2026-10-18（从 oauth21/src/theme/views/devices.ts 的声明下沉）
 */
import { pickDeviceId as pickDeviceIdOf } from '../views/device';
import type { DeviceDef, DeviceMatchContext } from '../views/device';
import { pageContainers, resolveContainerOf as resolveContainerOfWith } from './device-containers';
import type { DeviceContainerLoader } from './device-containers';

/** 声明式 match：字段间 OR；`fallback` 与其它互斥 */
export interface DeclarativeMatch {
  /** `?isMobile=true` 显式手机意图（全局最高优先信号） */
  explicitMobile?: boolean;
  /** 视口/UA 判为手机 */
  viewportMobile?: boolean;
  /** `?from=` 命中任一值 */
  from?: string[];
  /** `?fromLogin=` 命中任一值 */
  fromLogin?: string[];
  /** 路径含某整段/前缀 */
  pathSegment?: string;
  /** 兜底（无条件命中；必须是清单末条） */
  fallback?: boolean;
}

/** `defineThemeDevice` 的输入（声明式） */
export interface ThemeDeviceOptions {
  /** 设备 id = 主题包内目录名，只允许 `[a-z0-9-]` */
  id: string;
  /** 中文名（调试面板 / 日志用） */
  label: string;
  /** 缩写名（URL 专属参数后缀用） */
  urlKey: string;
  /** 容器三参数：工厂内部自动执行 `pageContainers(glob, fileRe, idRe)` */
  containers: {
    /** `import.meta.glob(...)` 的返回值（必须字面量调用） */
    glob: Record<string, DeviceContainerLoader>;
    /** 文件名匹配正则（哪个文件算容器入口） */
    fileRe: RegExp;
    /** 页面名白名单（统一 `THEME_ID_RE`） */
    idRe: RegExp;
  };
  /** 该设备在路由表占的 path（`{page}` 由页面名替换） */
  routePath(page: string): string;
  /** 声明式 match（不再手写闭包） */
  match: DeclarativeMatch;
}

/** 路径是否含某整段/前缀（`mini` 匹配 `/mini/login` 或旧 `mini-login`） */
function pathHasDeviceSegment(path: string, prefix: string): boolean {
  return path
    .split('/')
    .filter(Boolean)
    .some(seg => seg === prefix || seg.startsWith(`${prefix}-`));
}

/**
 * 声明式 match → 判定函数
 *
 * 字段间 OR；`explicitMobile` 是全局最高优先信号。
 */
function normalizeMatch(m: DeclarativeMatch): (ctx: DeviceMatchContext) => boolean {
  if (m.fallback) return () => true;
  return (ctx: DeviceMatchContext) => {
    // 显式手机意图下，带 from/fromLogin/pathSegment 的条目跳过（落到 explicitMobile 条目）
    if (ctx.explicitMobile && (m.from || m.fromLogin || m.pathSegment)) return false;
    return (
      (m.explicitMobile === true && ctx.explicitMobile) ||
      (m.viewportMobile === true && ctx.viewportIsMobile) ||
      (m.from !== undefined && m.from.includes(ctx.from)) ||
      (m.fromLogin !== undefined && m.fromLogin.includes(ctx.fromLogin)) ||
      (m.pathSegment !== undefined && pathHasDeviceSegment(ctx.path, m.pathSegment))
    );
  };
}

/** 已自动注册的设备清单（顺序 = 优先级，末条必须 fallback 兜底） */
const registeredDefs: DeviceDef<DeviceContainerLoader>[] = [];

/**
 * 声明一台设备并自动注册进设备域
 *
 * 内部做三件事：`pageContainers(glob, fileRe, idRe)` 建容器表、声明式 `match` → 判定函数、
 * 注册进设备域。
 */
export function defineThemeDevice(options: ThemeDeviceOptions): DeviceDef<DeviceContainerLoader> {
  const def: DeviceDef<DeviceContainerLoader> = {
    id: options.id,
    label: options.label,
    urlKey: options.urlKey,
    containers: pageContainers(
      options.containers.glob,
      options.containers.fileRe,
      options.containers.idRe
    ),
    routePath: options.routePath,
    match: normalizeMatch(options.match)
  };
  registeredDefs.push(def);
  return def;
}

/** 已注册的设备清单（设备域运行时 / URL 参数解析用） */
export function registeredDevices(): readonly DeviceDef<DeviceContainerLoader>[] {
  return registeredDefs;
}

/** 外部传入的设备名是否在设备域白名单里（归一化校验用；替代旧 `asThemeDevice` 转发） */
export function isKnownDevice(raw: unknown): raw is string {
  return typeof raw === 'string' && registeredDefs.some(d => d.id === raw);
}

/** 设备 id → 缩写名（urlKey，URL 专属参数后缀用）；未声明缩写时回落 id */
export function urlKeyOf(deviceId: string): string {
  return registeredDefs.find(d => d.id === deviceId)?.urlKey ?? deviceId;
}

/* ---------------------------------------------------------------------------
 * 用设备域单例的查询 / 派生（替代宿主「传 registeredDefs」的转发层）
 * ------------------------------------------------------------------------- */

/** 设备 id 清单（顺序即优先级，从已注册清单派生，不手写字面量） */
export function deviceIds(): string[] {
  return registeredDefs.map(d => d.id);
}

/** 兜底设备 = 末条 fallback 声明的 id（顺序即优先级，末条必须 fallback）；未声明设备时返回空串 */
export function fallbackDevice(): string {
  return registeredDefs[registeredDefs.length - 1]?.id ?? '';
}

/** 从外部输入判定「本次访问属于哪台设备」（用设备域单例 + 兜底设备） */
export function pickDeviceId(ctx: DeviceMatchContext): string {
  return pickDeviceIdOf(registeredDefs, ctx, fallbackDevice());
}

/** 取某设备在某页的容器加载器，**没写时兜底到 standard 设备**（用设备域单例） */
export function resolveContainerOf(id: string, page: string): DeviceContainerLoader {
  return resolveContainerOfWith(registeredDefs, id, page);
}

/** 重置模块级注册表（单测 / HMR 用） */
export function resetDevices(): void {
  registeredDefs.length = 0;
}
