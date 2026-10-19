/**
 * 主题状态的**持久化与 URL 解析层**（localStorage 安全读写 + 旧数据迁移 + URL 多设备意图）
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
import { getDefaultThemeId, resolveThemeId } from '../registry';
import type { ThemeMode } from '../scheme';
import { deviceIds, fallbackDevice, urlKeyOf } from './define-theme-device';

/** localStorage 键名集合（主题机制约定；与宿主存储冲突时通过 `ThemeStateOptions` 覆盖） */
export interface ThemeStorageKeys {
  /** 明暗意图键（三态 'system' / 'light' / 'dark'） */
  mode: string;
  /** 配色 id 键 */
  theme: string;
  /** 旧版本存配色 id 的键，只读不写（迁移用） */
  legacySkin: string;
  /** 旧版本标记「用户手动选过明暗」的键，只读不写（迁移用） */
  legacyManual: string;
}

/** 默认键名（沿用旧键，让老用户的手动选择可以平滑迁移） */
export const DEFAULT_STORAGE_KEYS: ThemeStorageKeys = {
  mode: 'theme',
  theme: 'theme-id',
  legacySkin: 'theme-skin',
  legacyManual: 'theme-manual'
};

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
 * 初始化明暗模式（含旧数据迁移）
 *
 * 旧版本把明暗写成 'light'/'dark'，另用 `legacyManual` 标记是否手动选过。
 * 迁移规则：
 *   • 存的是三态值 'system' → 直接用
 *   • 存的是 'light'/'dark' 且有 manual 标记（用户真的手动选过）→ 保留其选择
 *   • 存的是 'light'/'dark' 但没有 manual 标记 → 那只是旧版跟随系统的副产物，算 'system'
 */
export function readInitialMode(keys: ThemeStorageKeys = DEFAULT_STORAGE_KEYS): ThemeMode {
  const saved = safeGet(keys.mode);
  if (saved === 'system') return 'system';
  if (saved === 'light' || saved === 'dark') {
    return safeGet(keys.legacyManual) === 'true' ? saved : 'system';
  }
  return 'system';
}

/**
 * 初始化主题：旧键 `legacySkin` 兜底
 *
 * 未登记 / 非法一律回**兜底设备 × 默认页面 × 默认包**里的兜底配色 ——
 * 即 `DEFAULT_THEME_COLOR`（`white`）。这里不按具体设备判：落盘的只是一个
 * "用户/部署方选过的配色"，它在哪端可用由各调用点按自己的设备解析（见 scope）。
 *
 * ⚠️ 最后兜底是 `DEFAULT_THEME_ID`（`'default'`）而**不是**设备名：拿设备名当配色 id
 *    会得到一个永远查不到的 id，排查时极具误导性。
 */
export function readInitialTheme(keys: ThemeStorageKeys = DEFAULT_STORAGE_KEYS): string {
  return (
    resolveThemeId(safeGet(keys.theme) ?? safeGet(keys.legacySkin)) ??
    getDefaultThemeId({ device: fallbackDevice() }) ??
    DEFAULT_THEME_ID
  );
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
