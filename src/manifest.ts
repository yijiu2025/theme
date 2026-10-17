/**
 * 主题域清单（manifest）—— 主题目录里那份 `theme.config.ts` 的契约
 *
 * === 它回答两个问题 ===
 *   1. 调试面板**什么时候出现**（`debug`）
 *   2. 这条路径属于**哪个页面**（`routes`）
 *
 * === 为什么路由是"投影"而不是"路由表" ===
 * 真正的路由（守卫、懒加载、参数校验、设备基线）仍归宿主的 router。主题只关心一件事：
 * **这条路径对应哪个页面** —— 因为配色与版式的查找范围是「包 × 设备 × 页面」。
 * 让主题库接管路由，等于让它懂守卫与 chunk 划分，那是另一个职责。
 *
 * 代价是两边必须一致（清单里有的路径 router 里要有、反之亦然），所以宿主侧要有
 * 一条关卡做机械比对；收益是主题层可以原样搬到另一个前端，只要换一份 routes。
 *
 * 🔴 **清单里刻意没有「设备」**：设备由宿主的路由元信息基线 + 渲染形态分发器决定
 *    （见 oauth21 的 `router/index.ts` 与 `view/web` 分发器）。清单再声明一份就是
 *    第二个真相 —— 两处不一致时没有任何报错，只有"配色找错范围"这种无从归因的症状。
 *
 * === 为什么参数段用 `:name` ===
 * `/m/:page` 命中 `/m/login` → `page='login'`。这与"末段猜页面"的做法等价，
 * 但它是**声明**：哪条路径属于哪个页面写在配置里，新增页面不用改代码。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { THEME_ID_RE } from './constants.js';

/**
 * 调试面板开关
 *
 *   `off`    永不出现（产物里也不下载面板，见宿主的异步加载入口）
 *   `url`    带触发参数才出现 —— **生产缺省**：真机没有 DevTools，
 *            线上排查"这个租户颜色不对"时能直接切主题看效果是刚需
 *   `always` 首次渲染就出现（演示 / 联调环境）
 */
export type ThemeDebugMode = 'off' | 'url' | 'always';

/** 一条路由投影 */
export interface ThemeRouteRule {
  /** 路径；支持 `:name` 参数段（如 `/m/:page`） */
  path: string;
  /** 页面名；可用 `:name` 引用路径里的参数段 */
  page: string;
}

/** 清单的输入形态（`defineThemeManifest` 的参数，字段全可省） */
export interface ThemeManifest {
  debug?: {
    enabled?: ThemeDebugMode;
    /** 触发参数名，缺省 `debug` */
    query?: string;
    /** 触发参数值，缺省 `theme`（即 `?debug=theme`） */
    value?: string;
  };
  routes?: ThemeRouteRule[];
}

/** 补全默认值后的清单 */
export interface ResolvedThemeManifest {
  debug: { enabled: ThemeDebugMode; query: string; value: string };
  routes: ThemeRouteRule[];
}

/** 调试开关的补全值（供 `isThemeDebugVisible` 的参数类型使用） */
export type ResolvedThemeDebug = ResolvedThemeManifest['debug'];

const DEBUG_MODES: readonly ThemeDebugMode[] = ['off', 'url', 'always'];

/**
 * 声明并校验主题清单
 *
 * 与白名单常量同一口径：配置写错是开发者错误，应该在启动时就炸，
 * 而不是等到"面板不出现""切页面颜色不跟着变"这种无从归因的现象。
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

  const routes = manifest.routes ?? [];
  const seen = new Set<string>();
  for (const rule of routes) {
    if (!rule || typeof rule.path !== 'string' || !rule.path.startsWith('/')) {
      throw new Error(`[theme] routes 的 path 必须以 / 开头，收到「${String(rule?.path)}」。`);
    }
    if (typeof rule.page !== 'string' || !rule.page.replace(/^:/, '').trim()) {
      throw new Error(`[theme] routes「${rule.path}」缺少 page。`);
    }
    // 页面名会进目录查找，必须与主题目录名同规则（`:name` 参数段除外）
    const literal = rule.page.replace(/:([A-Za-z0-9_-]+)/g, 'x');
    if (!THEME_ID_RE.test(literal)) {
      throw new Error(
        `[theme] routes「${rule.path}」的 page「${rule.page}」不合法（只允许小写字母、数字、短横线）。`
      );
    }
    // 同一条路径声明两次属于笔误：后一条永远不会被命中（判定取先声明的），
    // 而"改了配置却不生效"是最难查的一类。
    if (seen.has(rule.path)) {
      throw new Error(`[theme] routes 里「${rule.path}」重复声明。`);
    }
    seen.add(rule.path);
  }

  return { debug: { enabled, query, value }, routes: [...routes] };
}

/** 把路径切成非空段（去掉 query / hash / 尾部斜杠） */
function segmentsOf(path: string): string[] {
  return path
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean);
}

/**
 * 一条规则与路径匹配，返回参数表；不匹配返回 null
 *
 * 段数必须相等；`:` 开头的段捕获任意一段，其余按字面比较。
 */
function matchRule(rule: string[], path: string[]): Record<string, string> | null {
  if (rule.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < rule.length; i += 1) {
    const want = rule[i];
    if (want.startsWith(':')) params[want.slice(1)] = path[i];
    else if (want !== path[i]) return null;
  }
  return params;
}

/**
 * 按清单把路径解析成**页面名**
 *
 * 多条规则同时命中时**静态段多的优先**（`/mini-login` 胜过 `/:page`），
 * 同样具体时取**声明顺序靠前**的一条 —— 结果与声明顺序相关是可预期的，
 * 不依赖文件系统或对象键顺序。
 *
 * @returns 未命中返回 null（调用方按"该页未接入主题机制"处理）
 */
export function resolveThemePage(
  routes: readonly ThemeRouteRule[],
  pathname: string
): string | null {
  const path = segmentsOf(pathname);
  if (!path.length) return null;

  let best: { rule: ThemeRouteRule; params: Record<string, string>; score: number } | null = null;
  for (const rule of routes) {
    const ruleSegments = segmentsOf(rule.path);
    const params = matchRule(ruleSegments, path);
    if (!params) continue;
    const score = ruleSegments.filter(segment => !segment.startsWith(':')).length;
    // 严格大于：同分时保留先声明的
    if (!best || score > best.score) best = { rule, params, score };
  }
  if (!best) return null;
  const hit = best;

  // page 里的 `:name` 用捕获值替换（`/m/:page` + page=':page' → 'login'）
  return hit.rule.page.replace(/:([A-Za-z0-9_-]+)/g, (whole, name: string) =>
    hit.params[name] !== undefined ? hit.params[name] : whole
  );
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
 * 目录里没写清单时用机制默认值（面板退回 `url` 档、无路由投影），而不是让页面起不来。
 * 这是「从构建产物到运行时单例」的收口点：清单写错在 `defineThemeManifest` 求值期就炸，
 * 缺失则在这里兜底。
 */
export function resolveThemeManifest(
  manifest: ResolvedThemeManifest | null | undefined
): ResolvedThemeManifest {
  return manifest ?? defineThemeManifest({});
}
