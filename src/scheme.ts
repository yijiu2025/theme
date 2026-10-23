/**
 * 配色系别 + 明暗意图（`scheme`）—— 「明暗 ≡ 色系」的完整定义
 *
 * 从 `tone.ts` + `mode.ts` + `remote-config.ts` 合并而来（2026-10-17 内核化简）。
 * 这三者本来就是一体的：tone 是配色自带的底色深浅，mode 是用户的系别意图，
 * 它们通过联动规则（切暗→黑系、切明→白系）互相关联，分三个文件纯属过早拆分。
 *
 * === 联动规则 ===
 * 🔴 明暗 ≡ 色系（用户 2026-09-25 定）：「明暗切换就是切换白色和黑色这个色系」
 *   mode = 系别意图（light→白系 / dark→黑系 / system→跟随系统偏好）
 *   tone = 配色自带的底色（每套配色一个）—— 不是 CSS，只用于联动
 *   点色卡同步 mode（点黑卡→dark、点白卡→light）
 *   切 mode 联动配色（dark→黑系标配、light→白系标配，两侧各自记住上次选择）
 *
 * @author yijiu2025
 */
import type { ThemeTokenOverrides } from './tokens.js';

/* ---------------------------------------------------------------------------
 * tone —— 配色的明暗系别
 * ------------------------------------------------------------------------- */

export type ThemeTone = 'light' | 'dark';

export const THEME_TONES: readonly ThemeTone[] = ['light', 'dark'];

export const TONE_LABELS: Record<ThemeTone, string> = {
  light: '白系',
  dark: '黑系'
};

export function isThemeTone(value: unknown): value is ThemeTone {
  return value === 'light' || value === 'dark';
}

export function normalizeTone(raw: unknown): ThemeTone | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return isThemeTone(v) ? v : null;
}

/* ---------------------------------------------------------------------------
 * mode —— 明暗意图（三态）
 * ------------------------------------------------------------------------- */

export type ThemeMode = 'system' | 'light' | 'dark';

export const MODE_CYCLE: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const MODE_LABELS: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '明',
  dark: '暗'
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function normalizeMode(raw: unknown): ThemeMode | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return isThemeMode(v) ? v : null;
}

/* ---------------------------------------------------------------------------
 * 远程配置归一化 —— 外部下发的主题配置（shape-only，不碰网络）
 * ------------------------------------------------------------------------- */

export interface RemoteThemeConfig {
  theme?: string;
  mode?: ThemeMode;
  tokens?: ThemeTokenOverrides;
}

export function normalizeRemoteThemeConfig(data: unknown): RemoteThemeConfig | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  const out: RemoteThemeConfig = {};

  if (typeof raw.theme === 'string') out.theme = raw.theme;

  const mode = normalizeMode(raw.mode);
  if (mode) out.mode = mode;

  if (raw.tokens && typeof raw.tokens === 'object' && !Array.isArray(raw.tokens)) {
    out.tokens = raw.tokens as ThemeTokenOverrides;
  }

  return out.theme || out.mode || out.tokens ? out : null;
}