/**
 * 设备声明工厂 —— `defineThemeDevice`（声明式，自动注册进设备域）
 *
 * 宿主只写一条声明（`id` / `label` / `urlKey` / `containers` 三参数），
 * 机制全在库内：`pageContainers` 建容器表、按声明顺序注册进设备域。宿主不再写
 * `createDeviceRegistry` 装配、不再手动组数组、不再转发 `asKnownDevice`。
 *
 * === 🔴 这里没有 `match`（2026-10-19 收口）===
 * 早先这里带一个「声明式 match」（`explicitMobile` / `from` / `fromLogin` /
 * `pathSegment` / `viewportMobile` / `fallback`），并由库解释成判定函数 ——
 * 那等于把**宿主的判定词汇**（`?isMobile`、`?from=mini`、视口阈值）写进了库。
 * 现在判定归宿主：宿主分发器（如 `login/index.vue`）按自己的口径（视口 / `?device=`
 * 锁定）选设备容器，设备身份由容器里的 `<ThemeView page="login" device="mini">` props
 * 告知主题 store。声明里只剩「这台设备叫什么、容器在哪」。
 *
 * === 声明顺序 = 优先级，末条是兜底 ===
 * `fallbackDevice()` 取末条、`resolveContainerOf()` 兜底也走末条 —— 库不认识
 * `standard` 这类具体名字，只认顺序。所以**末条必须是兜底设备**（宿主关卡盯着）。
 *
 * @author yijiu2025
 * @since 2026-10-18（从 oauth21/src/theme/views/devices.ts 的声明下沉）
 * @since 2026-10-19（`match` 撤出，判定归宿主）
 */
import type { DeviceDef } from '../views/device';
import { pageContainers, resolveContainerOf as resolveContainerOfWith } from './device-containers';
import type { DeviceContainerLoader } from './device-containers';

/** `defineThemeDevice` 的输入（只描述设备事实，不含任何判定） */
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
}

/** 已自动注册的设备清单（顺序 = 优先级，末条是兜底设备） */
const registeredDefs: DeviceDef<DeviceContainerLoader>[] = [];

/**
 * 声明一台设备并自动注册进设备域
 *
 * 内部只做两件事：`pageContainers(glob, fileRe, idRe)` 建容器表、按声明顺序注册。
 * 「怎么判定当前是哪台设备」不在这里 —— 由宿主 `resolveDevice` 负责。
 *
 * 🔴 **按 id 覆盖而非追加**：声明模块被重复求值（HMR 热替换、单测反复 import）时，
 *    同一设备注册两遍会让 `deviceIds()` 出重复项、清单变长、兜底语义漂移。
 *    覆盖**保持原顺序位置**（声明顺序 = 优先级，重复注册不该改变优先级）——
 *    与页面域 `defineThemePage` 的 Map 按名覆盖同一口径。
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
    )
  };
  const existing = registeredDefs.findIndex(d => d.id === options.id);
  if (existing >= 0) registeredDefs[existing] = def;
  else registeredDefs.push(def);
  return def;
}

/** 已注册的设备清单（设备域运行时 / URL 参数解析用） */
export function registeredDevices(): readonly DeviceDef<DeviceContainerLoader>[] {
  return registeredDefs;
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

/** 兜底设备 = 末条声明的 id（声明顺序即优先级）；未声明设备时返回空串 */
export function fallbackDevice(): string {
  return registeredDefs[registeredDefs.length - 1]?.id ?? '';
}

/** 取某设备在某页的容器加载器，**没写时兜底到末条设备**（用设备域单例） */
export function resolveContainerOf(id: string, page: string): DeviceContainerLoader {
  return resolveContainerOfWith(registeredDefs, id, page);
}
