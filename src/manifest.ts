/**
 * 主题域清单（manifest）—— 主题目录里 theme.config.ts 的契约
 *
 * 只回答一个问题：调试面板什么时候出现（debug）。其余全部由机制推导：
 *   · 主题根目录在哪 → .env 的 VITE_THEME_DIR
 *   · 有哪些设备     → 宿主设备清单（createThemeState({ devices }) 注入）
 *   · 有哪些页面     → defineThemePage 声明（页面域）
 *   · 有哪些配色     → 主题包目录结构（扫出来的，不在这里声明）
 *
 * 早先清单里的 routes（路径 → 页面投影）已删：页面身份由 <ThemeView page> 显式传入，
 * 再声明一份映射就是第二个真相，不一致时只剩「面板认不出页面」这种无从归因的症状。
 */

/**
 * 调试面板开关
 *
 *   `off`    永不出现（产物里也不下载面板）
 *   `url`    带触发参数才出现 —— 生产缺省：真机没有 DevTools，线上排查时能切主题看效果
 *   `always` 首次渲染就出现（演示 / 联调环境）
 */
export type ThemeDebugMode = 'off' | 'url' | 'always';

/** 清单的输入形态（`defineThemeManifest` 的参数，字段全可省） */
export interface ThemeManifest {
  debug?: {
    enabled?: ThemeDebugMode;
    /** 触发参数名，缺省 `debug` */
    query?: string;
    /** 触发参数值，缺省 `theme`（即 `?debug=theme`） */
    value?: string;
  };
}

/** 补全默认值后的清单 */
export interface ResolvedThemeManifest {
  debug: { enabled: ThemeDebugMode; query: string; value: string };
}

/** 调试开关的补全值（供 `isThemeDebugVisible` 的参数类型使用） */
export type ResolvedThemeDebug = ResolvedThemeManifest['debug'];

const DEBUG_MODES: readonly ThemeDebugMode[] = ['off', 'url', 'always'];

/**
 * 声明并校验主题清单
 *
 * 与白名单常量同一口径：配置写错是开发者错误，应该在启动时就炸，
 * 而不是等到"面板不出现"这种无从归因的现象。
 */
export function defineThemeManifest(manifest: ThemeManifest = {}): ResolvedThemeManifest {
  const debug = manifest.debug ?? {};
  const enabled = debug.enabled ?? 'url';
  if (!DEBUG_MODES.includes(enabled)) {
    throw new Error(
      `[theme] debug.enabled 只能是 ${DEBUG_MODES.join(' / ')}，收到「${String(enabled)}」。`
    );
  }
  const query = debug.query ?? 'debug';
  const value = debug.value ?? 'theme';
  if (!query.trim() || !value.trim()) {
    throw new Error('[theme] debug.query / debug.value 必须是非空字符串。');
  }

  return { debug: { enabled, query, value } };
}

/**
 * 调试面板此刻是否该出现
 *
 * `url` 档用 `query` 里的 `query` 键比对 `value`（缺省 `?debug=theme`）。
 * 参数表只要求"能按键取值"的形态（vue-router 的 `route.query`、`URLSearchParams`
 * 转出来的普通对象都满足），库不绑定任何一种 —— 它不碰路由。
 *
 * ⚠️ 值可能是数组（`?debug=theme&debug=other`）：任一元素命中即算命中，
 *    与 vue-router 的 `LocationQuery` 形态一致。
 */
export function isThemeDebugVisible(
  debug: ResolvedThemeDebug,
  query: Readonly<Record<string, unknown>>
): boolean {
  if (debug.enabled === 'off') return false;
  if (debug.enabled === 'always') return true;
  const raw = query[debug.query];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some(item => typeof item === 'string' && item === debug.value);
}

/**
 * 解析运行时拿到的清单（构建插件扫出来的 `theme.config.ts`）
 *
 * 目录里没写清单时用机制默认值（面板退回 `url` 档），而不是让页面起不来。
 * 这是「从构建产物到运行时单例」的收口点：清单写错在 `defineThemeManifest` 求值期就炸，
 * 缺失则在这里兜底。
 */
export function resolveThemeManifest(
  manifest: ResolvedThemeManifest | null | undefined
): ResolvedThemeManifest {
  return manifest ?? defineThemeManifest({});
}

/**
 * 模块级清单单例 —— 「清单从哪来」的收口点
 *
 * 与配色注册表（`installThemeRegistry`）同一范式：`virtual:theme` 虚拟模块被 import 的
 * 那一刻（模块求值期副作用）把 resolve 后的清单装进来，之后内核各处（调试面板可见性）
 * 直接读本单例，**无需宿主 import `virtual:theme` 再转发**。
 * 未装入时为机制默认（面板 `url` 档），而不是让应用起不来。
 */
let themeManifestSingleton: ResolvedThemeManifest = defineThemeManifest({});

/** 装入已解析的清单（`virtual:theme` 自动装配时调一次） */
export function installThemeManifest(manifest: ResolvedThemeManifest): void {
  themeManifestSingleton = manifest;
}

/** 当前清单单例（调试面板可见性用） */
export function themeManifest(): ResolvedThemeManifest {
  return themeManifestSingleton;
}
