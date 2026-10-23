/**
 * 主题状态的**持久化与 URL 解析层**（localStorage 安全读写 + URL 多设备意图）
 *
 * 从 `oauth21/src/stores/theme-persistence.ts` 下沉（2026-10-19）。
 *
 * === 为什么下沉 ===
 * 这些是「明暗 ≡ 配色系别」状态机的**纯函数半边**：不依赖 store 实例、无闭包、无副作用顺序。
 * 它配合 scope / intent / runtime 一起构成完整状态机，五个前端（oauth21 / retroweb / firewall /
 * admin / posecraft）都应复用同一份，而不是各抄一遍。键名与 URL 参数是**主题机制的约定**，
 * 下沉后作为默认值，允许宿主通过 `ThemeStateOptions.storageKeys` / `colorParam` 覆盖（与自身
 * 存储冲突时）。
 *
 * ⚠️ 这些函数**不自带 DOM 守卫**（如 `typeof window !== 'undefined'`）：SPA 场景下
 *    window 必然存在。下沉不改变这一点。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 oauth21/src/stores/theme-persistence.ts 下沉，参数化键名/参数前缀）
 */
import { DEFAULT_THEME_ID } from '../constants';
import { resolveThemeId } from '../registry';
import type { ThemeMode } from '../scheme';
import { deviceIds, urlKeyOf } from './define-theme-device';

/** localStorage 键名集合（主题机制约定；与宿主存储冲突时通过 `ThemeStateOptions` 覆盖） */
export interface ThemeStorageKeys {
  /** 明暗意图键（三态 'system' / 'light' / 'dark'） */
  mode: string;
  /** 配色 id 键 */
  theme: string;
}

/**
 * 默认键名（2026-10-23 加 `mauth:` 命名空间前缀）
 *
 * 🔴 旧默认是裸键 `'theme'` / `'theme-id'` —— 太通用：本仓就有三个前端
 *    （admin / firewall / phonecopy）各自用裸 `'theme'` 存自己的明暗偏好，
 *    skinsuite 宿主与它们同源部署时会**互相覆盖**。加前缀后各应用天然隔离。
 * 读取侧带**一次性回退迁移**（见 `readWithLegacyFallback`）：新键缺席时读旧键，
 *    存量用户的偏好无声延续；写入只写新键，旧键不动（同源下它可能属于别的应用，删不得）。
 */
export const DEFAULT_STORAGE_KEYS: ThemeStorageKeys = {
  mode: 'mauth:mode',
  theme: 'mauth:theme'
};

/**
 * 旧默认键（0.7.x 及之前）—— 只用于**读回退**，不再写入。
 * 宿主自定义过 `storageKeys` 的部署不受影响（两键都查它自己的键，随后才查旧默认键）。
 */
export const LEGACY_STORAGE_KEYS: ThemeStorageKeys = {
  mode: 'theme',
  theme: 'theme-id'
};

/**
 * 读一个键，缺席时回退读旧默认键（一次性迁移语义）
 *
 * 返回第一个「存在」的值 —— 合法性校验归调用方（与改前一致：非法值照旧走兜底）。
 * 只读不写：不在读路径里产生副作用（写迁移交给用户下一次显式操作，落的是新键）。
 */
function readWithLegacyFallback(key: string, legacyKey: string): string | null {
  return safeGet(key) ?? safeGet(legacyKey);
}

/** URL 配色意图的参数前缀（配合设备 urlKey 组成 `th_color_<urlKey>`） */
export const DEFAULT_COLOR_PARAM = 'th_color';

/** 安全读 localStorage：隐私模式 / 禁用存储时会抛错，不能让它把应用带崩 */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 安全写 localStorage：存不了就算了，本次会话内仍正常工作 */
export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 存不了就算了，本次会话内仍正常工作 */
  }
}

/**
 * 初始化明暗模式
 *
 * 落盘的是三态值（'system' / 'light' / 'dark'）就直接用；其余（非法 / 缺失）一律 'system'。
 * 新键缺席时回退读旧默认键 `'theme'`（0.7.x 存量迁移，见 `DEFAULT_STORAGE_KEYS` 说明）。
 */
export function readInitialMode(keys: ThemeStorageKeys = DEFAULT_STORAGE_KEYS): ThemeMode {
  const saved = readWithLegacyFallback(keys.mode, LEGACY_STORAGE_KEYS.mode);
  return saved === 'system' || saved === 'light' || saved === 'dark' ? saved : 'system';
}

/**
 * 初始化主题
 *
 * 落盘值未登记 / 非法时返回占位 `DEFAULT_THEME_ID`（`'default'`）。这里**不查注册表**：
 * "默认配色"是「包 × 设备 × 页面」作用域里的概念，而初始化时页面上下文还不存在
 * （页面由 `<ThemeView page="…">` 稍后告知）。占位 id 会在运行时由 `getThemeRecord`
 * 的回退链（同系别首套 → 该范围兜底色）落到具体配色，再由意图层首屏对齐校正系别。
 *
 * ⚠️ 最后兜底是 `DEFAULT_THEME_ID`（`'default'`）而**不是**设备名：拿设备名当配色 id
 *    会得到一个永远查不到的 id，排查时极具误导性。
 *
 * 新键缺席时回退读旧默认键 `'theme-id'`（0.7.x 存量迁移，见 `DEFAULT_STORAGE_KEYS` 说明）。
 */
export function readInitialTheme(keys: ThemeStorageKeys = DEFAULT_STORAGE_KEYS): string {
  return resolveThemeId(readWithLegacyFallback(keys.theme, LEGACY_STORAGE_KEYS.theme)) ?? DEFAULT_THEME_ID;
}

/** URL 上按设备解析出的配色意图：只记"这台设备被**显式**指定了哪套色" */
export type DeviceThemeIntent = Partial<Record<string, string>>;

/**
 * 读取 URL 上的主题意图（**含设备维度**）
 *
 * === 每台设备各一条取值链 ===
 *   `?<colorParam>_<urlKey>`  →  `?<colorParam>`  → （缺则不算命中）
 * 即"**设备专属优先，缺了退到通用键**"。缺了这台设备就走落盘偏好 / 该范围默认色。
 *
 * 设备专属键的后缀是**缩写名（urlKey）**（下划线连接）。明暗（`?mode=`）URL 入口已删。
 * 非法值一律折成 null —— 不抛错、不锁项，让后端配置与本地存储照常参与。
 *
 * 🔴 **空串 = 未指定**：`?<colorParam>_<urlKey>=` 不能把 `?<colorParam>=blue` 顶掉。
 */
export function readUrlIntent(
  colorParam: string = DEFAULT_COLOR_PARAM
): { deviceTheme: DeviceThemeIntent } {
  const deviceTheme: DeviceThemeIntent = {};
  try {
    const params = new URLSearchParams(window.location.search);
    /** 空串 / 纯空白视为**未指定** —— 与 `readDeviceParam` 的 `isPresent()` 同一口径 */
    const present = (raw: string | null): string | null =>
      raw && raw.trim() !== '' ? raw : null;
    // 无设备前缀的通用键：三端共用，任一设备没有专属键时用它
    const anyScope = present(params.get(colorParam));
    for (const device of deviceIds()) {
      const scoped = present(params.get(`${colorParam}_${urlKeyOf(device)}`));
      const resolved = resolveThemeId(scoped ?? anyScope);
      if (resolved) deviceTheme[device] = resolved;
    }
    return { deviceTheme };
  } catch {
    return { deviceTheme };
  }
}
