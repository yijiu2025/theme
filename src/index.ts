/**
 * `skinsuite` 的**唯一公开出口**
 *
 * === 这里装什么 ===
 * 主题机制里**与业务、与框架都无关**的那一半：取值白名单、契约类型、系别/明暗取值、
 * 设备维度参数读取、token 形态与校验。它是纯函数 + 数据，可以在任何前端（Vue / React /
 * 单测 / 将来的 SSR）里被同一套代码驱动。
 *
 * ### 不在这里装什么（重要）
 *   • **DOM 与注入**（`documentElement`、`localStorage`、`matchMedia`）→ 由宿主适配器提供
 *   • **构建器耦合**（`import.meta.glob` / `import.meta.env`）→ 由宿主适配器提供
 *   • **路由**（vue-router）→ 应用自己的世界观
 *   • **业务资产**（`themes/**` 的版式与配色实现）→ 随应用走
 * 见 `docs/standards/theme-package-extraction.md` 的「〇、一条原则」与「五、四个注入点契约」。
 *
 * === 为什么用显式具名导出，而不是 `export *` ===
 * 立项文档 §四 有一张"公开 API 面"的表，本文件就是那张表的**落地**：表里没有的名字
 * 就不该从这里出去（如内部用的正则、解析器）。用 `export *` 会让"包到底承诺了什么"
 * 变成一份隐式清单，加一个内部导出就悄悄扩大了对外承诺。
 * 代价是新增导出要手工补一行 —— 这是刻意的摩擦。
 *
 * ⚠️ 相对 import **必须带 `.js` 后缀**（`from './tone.js'` 而不是 `'./tone'`）：
 *    包以 `moduleResolution: NodeNext` 编译到 `dist/`，TS 会把 `.js` 映射回 `.ts` 源码，
 *    而**产物**里的相对说明符是原样保留的 —— 不带后缀的话浏览器与 Node 的原生 ESM
 *    都解析不到。Vite / webpack 侧的别名消费源码时同样认这条 TS 约定，所以不用改两遍。
 *
 * ⚠️ 公开面一旦发出就是承诺：改名/删名要先想清楚下游（当前只有 `oauth21` 一个消费者，
 *    所以现在改是免费的，见立项文档 §八）。
 *
 * @author yijiu2025
 */

export {
  THEME_ID_RE,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_DARK_COLOR,
  THEME_DIR_LEVELS,
  THEME_COLORS_SEGMENT,
  THEME_COLOR_DEF_FILE,
  THEME_COLOR_STYLE_FILE,
  THEME_PACKAGE_DEF_FILE
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

// URL 主题参数的静默失败审计（纯函数；Vue 绑定层的调试句针消费它，宿主 / CI 也可自用）
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

/**
 * 设备清单机制（只有事实与查询，**判定不在这里**）
 *
 * 「当前属于哪台设备」由宿主注入 `resolveDevice`（`skinsuite/vue`），库不认识
 * 视口阈值 / UA / `?isMobile` / `?from=` 这些词汇。
 */
export { containersOf } from './views/device.js';
export type { DeviceDef, DeviceVocab } from './views/device.js';

/**
 * 外部下发的主题配置：**只归一形状，不碰网络**
 *
 * 取数（超时 / 重试 / cookie 策略）属于宿主，故不在此。
 */
export { normalizeRemoteThemeConfig } from './scheme.js';
export type { RemoteThemeConfig } from './scheme.js';

/**
 * 主题域清单（主题目录里那份 `theme.config.ts` 的契约）：调试开关
 *
 * 它是**主题域自带**的配置（跟主题包一起走）；「主题目录在哪」不在这里 ——
 * 那是宿主的部署事实，由宿主的 env 提供，换目录不必改代码也不必改这个包。
 */
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
