/**
 * 版式（view）注册表 + 选择器 —— 「业务容器 + 可换 UI」的通用机制
 *
 * 页面拆两半：业务容器（状态 / 校验 / 请求 / 路由，只此一份）+ 版式（只管长什么样，
 * 吃 props 的 ctx 渲染与回调）。换一套 UI = 加一个目录，不碰业务代码。
 *
 * 版式实现住在主题包里、按设备分区（themes/<包>/<设备>/<page>/index.vue），查找范围
 * = 当前包 × 当前设备；契约与注册表是每页一份的页面文件（views/<page>.ts），所有包共用。
 *
 * 选择优先级（高 → 低）：① URL ?th[_<urlKey>] ② 包/配色声明的 views.<page>
 * ③ 当前包名（一个包 = 一种版式 ⇒ 版式 id ≡ 包名）。
 * 🔴 第 1 档命中后不再回退；非法值一律落当前包名。
 */
import type { Component } from 'vue';
import { THEME_ID_RE } from '../../constants';

/**
 * 版式组件加载表形态：键 → 加载器
 *
 * 内置包（`default`）的加载器由 `virtual:theme` 插件**同步**返回（eager 静态 import，
 * 零请求首屏）；非内置包返回 `Promise`（`import()` 惰性 chunk）。`await` 对两者都成立，
 * 但只有同步形态能支撑「首帧同步拿到内置包版式」的 `builtin()` 路径。
 */
export type ViewModuleLoader = () => { default: Component } | Promise<{ default: Component }>;
export type ViewModuleMap = Record<string, ViewModuleLoader>;
/**
 * 版式加载表的**惰性提供者**：`() => ViewModuleMap`。
 *
 * 页面契约文件在注册时（`defineThemePage`）可能早于 `virtual:theme` 把 `themeViews`
 * 装入单例，所以建注册表时**不立即读**加载表，而是传一个 provider，等首次查询
 * （渲染期）再取 —— 既打破「页面契约 → virtual:theme」的循环，又保证取到的是终态。
 */
export type ViewModuleProvider = () => ViewModuleMap;

/** 某个主题包在**某设备**该页登记了哪些版式 */
export interface PackageViews {
  pkg: string;
  device: string;
  ids: string[];
}

export interface ViewRegistry {
  readonly baseId: string;
  readonly builtinPackage: string;
  packages(): PackageViews[];
  has(raw: unknown, pkg: string, device: string): boolean;
  resolve(raw: unknown, pkg: string, device: string): string | null;
  load(id: string | null, pkg: string, device: string): Promise<Component | null>;
  /** 内置包（`default`）在**某设备**该页的版式组件（同步，eager 静态 import；无则 null） */
  builtin(device: string): Component | null;
}

export interface ViewRegistryOptions {
  page: string;
  baseId?: string;
  builtinPackage?: string;
  idRe?: RegExp;
}

/** 选择器的输入：四个都是外部值，全部未校验 */
export interface ViewPickerSource {
  url?: unknown;
  theme?: unknown;
  pkg?: unknown;
  device?: unknown;
}

export interface ViewPicker {
  pick(source?: ViewPickerSource): string;
}

export interface ViewPickerOptions {
  registry: ViewRegistry;
}

const DEFAULT_VIEW_ID_RE = /^[a-z0-9-]+$/;

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * 设备段白名单：内核只认「**合法 id 形态**」（`THEME_ID_RE`）。
 * 设备**词汇表**归宿主的注入清单（2026-10-24 起库不自持注册表）——不认识的
 * 设备名只要形态合法就进表（渲染侧按作用域查，查不到自然不渲染），宿主关卡
 * 负责盯「主题包里的设备目录 ⊆ 宿主设备清单」。
 */
function isKnownDevice(raw: unknown): raw is string {
  return typeof raw === 'string' && THEME_ID_RE.test(raw);
}

/** 归一化设备名：不在白名单返回空串（建表时据此跳过非法设备目录） */
function normalizeDevice(raw: string): string {
  return isKnownDevice(raw) ? raw : '';
}

export function createViewRegistry(
  loaders: ViewModuleMap | ViewModuleProvider,
  options: ViewRegistryOptions
): ViewRegistry {
  const baseId = options.baseId ?? 'base';
  const builtinPackage = options.builtinPackage ?? 'default';
  const idRe = options.idRe ?? DEFAULT_VIEW_ID_RE;
  const { page } = options;
  if (!idRe.test(page)) {
    throw new Error(`[view] page 名「${page}」不合规：只允许小写字母/数字/短横线`);
  }

  // 惰性提供者：注册时可能还拿不到 `themeViews`（`virtual:theme` 还没装单例），
  // 所以这里只记「怎么取」，首次查询（渲染期）才真正建 `bases` 表。
  const resolveLoaders = typeof loaders === 'function' ? loaders : () => loaders;
  const scopeKey = (pkg: string, device: string): string => `${pkg}/${device}`;

  // 🔴 键形与 `virtual:theme` 的 `themeViews` 一致：`./<包>/<设备>/<页面>/index.vue`
  //    （相对 `themes/` 目录，`./` 开头）—— 不再是 `import.meta.glob('/src/theme/themes/...')`
  //    那种 `/src/...` 根绝对路径键。改键形（2026-10-18）后这里必须同步，否则建空表。
  const baseKeyRe = new RegExp(`^\\./([^/]+)/([^/]+)/${page}/index\\.vue$`);

  let bases: Map<string, ViewModuleLoader> | null = null;
  const ensure = (): Map<string, ViewModuleLoader> => {
    if (bases) return bases;
    bases = new Map();
    for (const [key, loader] of Object.entries(resolveLoaders())) {
      const m = baseKeyRe.exec(key);
      const pkg = m?.[1];
      const device = m?.[2];
      if (!pkg || !device) continue;
      if (!idRe.test(pkg)) continue;
      if (normalizeDevice(device) !== device) continue;
      bases.set(scopeKey(pkg, device), loader);
    }
    return bases;
  };

  const resolve = (raw: unknown, pkg: string, device: string): string | null => {
    if (typeof raw !== 'string') return null;
    const id = raw.trim().toLowerCase();
    if (!id || !idRe.test(id)) return null;
    if (id === baseId) return pkg;
    const b = ensure();
    if (b.has(scopeKey(id, device))) return id;
    if (id === pkg && b.has(scopeKey(pkg, device))) return pkg;
    return null;
  };

  return {
    baseId,
    builtinPackage,
    packages() {
      const b = ensure();
      return [...b.keys()]
        .map(k => {
          const cut = k.indexOf('/');
          return { pkg: k.slice(0, cut), device: k.slice(cut + 1) };
        })
        .sort((a, b2) => `${a.pkg}/${a.device}`.localeCompare(`${b2.pkg}/${b2.device}`))
        .map(({ pkg, device }) => ({ pkg, device, ids: [pkg] }));
    },
    has: (raw, pkg, device) => resolve(raw, pkg, device) !== null,
    resolve,
    async load(id, pkg, device) {
      if (!id || !idRe.test(pkg)) return null;
      const b = ensure();
      const target = id !== pkg && b.has(scopeKey(id, device)) ? id : pkg;
      const loader = b.get(scopeKey(target, device));
      if (!loader) return null;
      try {
        return (await loader()).default ?? null;
      } catch (err) {
        console.warn(`[view] 主题包「${target}」${device} 端的版式加载失败，已回退`, err);
        return null;
      }
    },
    builtin(device) {
      const loader = ensure().get(scopeKey(builtinPackage, device));
      if (!loader) return null;
      const mod = loader();
      // 内置包是 eager 静态 import → 同步返回模块命名空间；非内置包才是 Promise
      return mod instanceof Promise ? null : (mod.default ?? null);
    }
  };
}

/** 选择器工厂：从外部输入挑出版式 id（永远返回可用 id，最差是当前包名） */
export function createViewPicker(options: ViewPickerOptions): ViewPicker {
  const { registry } = options;

  function asPackage(value: unknown): string {
    return asText(value) ?? registry.builtinPackage;
  }

  function asDevice(value: unknown): string {
    // 设备词汇归宿主清单（2026-10-24）：这里只做**形态**归一 —— 合法 id 原样透传，
    // 查不到版式由 registry.resolve 的既有回退链兜底（落当前包内置版式）；
    // 形态非法落空串。不再「未知设备顶替末条设备」（那是注册表时代的兜底，
    // 注册表退役后 picker 在声明期创建、拿不到宿主清单，语义随之收口为信任调用方）。
    return isKnownDevice(value) ? value : '';
  }

  function pick(source: ViewPickerSource = {}): string {
    const pkg = asPackage(source.pkg);
    const device = asDevice(source.device);
    const url = asText(source.url);
    // 第 1 档：URL 显式意图 —— 非法值也**不回退**到下面的档
    if (url) return registry.resolve(url, pkg, device) ?? pkg;

    // 第 2 档 → 第 3 档：主题包/配色声明 → 当前包（一个主题包 = 一种版式）
    return registry.resolve(source.theme, pkg, device) ?? pkg;
  }

  return { pick };
}
