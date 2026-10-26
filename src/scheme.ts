/**
 * 配色系别（tone）+ 明暗意图（mode）—— 「明暗 ≡ 色系」的定义
 *
 * mode = 用户意图（light→白系 / dark→黑系 / system→跟随系统）；
 * tone = 每套配色自带的系别（不是 CSS，只用于联动）。
 * 联动是单向的：切 mode 换到对应系别的配色（dark→黑系标配、light→白系标配，
 * 两侧各记一个会话级记忆槽）；点色卡不改 mode。
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
    // 边界逐键过滤：只保留 string 值，产出真正符合 ThemeTokenOverrides（Record<string,string>）
    // 的值。此前 `as ThemeTokenOverrides` 裸断言只验「是对象」，可能让 { primary: 123 } 这类
    // 非 string 值穿过边界（下游 sanitizeOverrides 会兜，但契约应在边界就成立）。
    // 🔴 同时跳过原型链危险键（__proto__/constructor/prototype）：JSON 里出现同名键时，
    //    `tokens['__proto__']=v` 会静默丢键（试图改原型），与 param-audit 同口径收口。
    const tokens: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.tokens)) {
      if (typeof v === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        tokens[k] = v;
      }
    }
    out.tokens = tokens;
  }

  return out.theme || out.mode || out.tokens ? out : null;
}