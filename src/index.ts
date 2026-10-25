/**
 * `skinsuite` 的唯一公开出口 —— 纯内核：白名单、契约类型、mode/tone、token 校验、
 * 设备维度参数读取。纯函数 + 数据，无 DOM、无框架依赖，任何前端可用。
 *
 * 只用显式具名导出（不用 export *）：这里就是「包承诺了什么」的清单，
 * 新增导出要手工补一行 —— 刻意的摩擦。
 *
 * ⚠️ 相对 import 必须带 `.js` 后缀：本包以 NodeNext 编译到 dist/，产物里的
 *    说明符原样保留，不带后缀浏览器与 Node 的原生 ESM 都解析不到。
 */

export {
  THEME_ID_RE,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_DARK_COLOR,
  THEME_DIR_LEVELS,
  THEME_COLORS_SEGMENT,
  THEME_COLOR_STYLE_FILE,
  THEME_DEF_FILE_CANDIDATES
} from './constants.js';

export { THEME_TONES, TONE_LABELS, isThemeTone, normalizeTone } from './scheme.js';
export type { ThemeTone } from './scheme.js';

export { MODE_CYCLE, MODE_LABELS, isThemeMode, normalizeMode } from './scheme.js';
export type { ThemeMode } from './scheme.js';

export {
  isSafeTokenName,
  isSafeTokenValue,
  isSafeTokenEntry,
  sanitizeOverrides
} from './tokens.js';
export type { ThemeTokenOverrides, SanitizeResult, ThemeTokenLayers } from './tokens.js';

export type {
  MauthThemeMeta,
  MauthThemePackage,
  MauthThemeColor,
  MauthThemeRecord
} from './types.js';

export { buildThemeRegistry, installThemeRegistry } from './registry.js';
export type { ThemeAssetModules } from './registry.js';
export {
  listThemes,
  listColorsOf,
  toneOfColor,
  toneOfAnyScope,
  listColorIdsOfTone,
  resolveThemeId,
  getThemeRecord,
  getDefaultThemeId,
  isKnownTheme,
  listColorViews
} from './registry.js';

export {
  DEFAULT_VIEW_PARAM,
  DEVICE_SCOPED_PARAMS,
  readDeviceParam,
  readUrlViewIntent,
  sameViewSnapshot,
  viewParamsSnapshot
} from './views/params.js';
export type { DeviceScopedParam, DeviceViewIntent } from './views/params.js';

// URL 主题参数的静默失败审计（纯函数；调试句柄消费它，宿主 / CI 也可自用）
export {
  collectWarnings,
  effectiveViewRaw,
  parseThemeParams
} from './views/param-audit.js';
export type {
  ParamAuditDevice,
  RepeatedParam,
  ThemeUrlParams,
  WarningContext
} from './views/param-audit.js';

/** 设备词汇（注入式清单的一台设备）：清单由宿主经 createThemeState({ devices }) 注入，库不自持 */
export type { DeviceVocab } from './types.js';

/** 外部下发的主题配置：只归一形状，不碰网络（取数在 skinsuite/vue 的 remote-fetch） */
export { normalizeRemoteThemeConfig } from './scheme.js';
export type { RemoteThemeConfig } from './scheme.js';

/** 主题域清单（theme.config.ts 的契约）：调试开关；目录位置由宿主 env 提供，不在这里 */
export {
  defineThemeManifest,
  isThemeDebugVisible,
  resolveThemeManifest,
  installThemeManifest,
  themeManifest
} from './manifest.js';
export type {
  ResolvedThemeDebug,
  ResolvedThemeManifest,
  ThemeDebugMode,
  ThemeManifest
} from './manifest.js';
