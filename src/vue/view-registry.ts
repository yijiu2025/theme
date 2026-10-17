/**
 * 版式（view）注册表工厂 —— 「业务容器 + 可换 UI」的通用机制（内核版）
 *
 * === 这一层解决什么 ===
 * 页面拆成两半：
 *   • **业务容器** —— 状态、校验、请求、路由跳转，以及所有「点了会发生什么」。只此一份。
 *   • **版式（UI）** —— 只负责「长什么样」，通过 props 拿到容器给的 `ctx` 来渲染与回调。
 * 于是「换一套 UI」= 加一个目录，不用碰业务代码，也不会出现两份校验逻辑各自漂移。
 *
 * === 版式跟随主题包与设备（最关键的一条）===
 * 版式实现住在主题包里、且按设备分区（`themes/<包>/<设备>/<page>/index.vue`），
 * 查找范围就是**当前主题包 × 当前设备**。契约与注册表是**每页一份**的页面文件
 * （`views/<page>.ts`），留在宿主架构层，所有包共用一份 —— 跟着进包就会变成 N 份副本。
 *
 * === 目录与 naming ===
 * ```
 * theme/views/<page>.ts                宿主：某页的契约 + 注册表（每页一份，与包无关）
 * theme/themes/<包>/<设备>/<page>/      主题包内：某设备下的版式实现
 * └── index.vue                        该包在该设备该页的**唯一**版式
 * ```
 * 🔴 **一个主题包 = 一种版式**：`<page>/` 下没有版式层目录，换版式 = 换包。
 *    `?view=compact` 即切到 compact 包；`base` 只是「当前包」的历史别名。
 *
 * === 为什么设备是宽 `string` + 白名单参数 ===
 * 内核不认识宿主的设备词汇表（哪些目录名算合法设备是宿主的部署事实），所以：
 *   · `ViewRegistry` 的 device 参数一律 `string`；
 *   · 设备合法性由**参数注入** `isKnownDevice(raw): boolean` 决定（与配色注册表
 *     `buildThemeRegistry` 的 `isKnownDevice` 同一范式）；
 *   · 默认设备由**参数注入** `defaultDevice: string` 决定（内核不设默认设备）。
 *
 * === 安全边界 ===
 * 版式 id 来自 URL / 主题包 / 环境变量，都属外部输入：这里只做「已登记」白名单匹配，
 * 不拼路径、不模糊匹配 —— 未登记一律返回 null，由调用方回退基础版式。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/registry.ts 下沉）
 */
import type { Component } from 'vue';

/** `import.meta.glob` 的结果形态：路径 → 惰性加载器 */
export type ViewModuleMap = Record<string, () => Promise<{ default: Component }>>;

/** 某个主题包在**某设备**该页登记了哪些版式 */
export interface PackageViews {
  pkg: string;
  device: string;
  /** 该包该设备可选的版式 id —— **恒为 `[包名]`**（一个主题包 = 一种版式） */
  ids: string[];
}

export interface ViewRegistry {
  /** 「基础版式」的历史逻辑 id（默认 `'base'`）；它**不是**合法版式返回值，只让 `resolve` 认得 `?view=base` 这个别名 */
  readonly baseId: string;
  /** 内置包 id（它的版式由容器静态引入，不走惰性加载） */
  readonly builtinPackage: string;
  /** 所有包 × 设备在该页的版式总览（供调试面板按「包 + 设备」展示） */
  packages(): PackageViews[];
  /** 外部输入在**指定包、指定设备内**是否解析得出可用版式 */
  has(raw: unknown, pkg: string, device: string): boolean;
  /** 解析外部输入 → 版式 id（`view ≡ pkg`）；非法 / 未登记返回 null */
  resolve(raw: unknown, pkg: string, device: string): string | null;
  /** 加载版式组件；内置包返回 null（用容器静态引入那份），加载失败返回 null（不抛错） */
  load(id: string | null, pkg: string, device: string): Promise<Component | null>;
}

/** 版式注册表工厂的宿主事实（内核不认识设备词汇表，故参数注入） */
export interface ViewRegistryHost {
  /** 设备名归一化（宿主 `asThemeDevice`；不认识返回 null） */
  asKnownDevice(raw: unknown): string | null;
  /** 兜底设备（宿主 `DEFAULT_THEME_DEVICE`） */
  defaultDevice: string;
}

export interface ViewRegistryOptions extends ViewRegistryHost {
  /** 页面名（与 `views/<page>.ts` 的文件名、包内目录名、路由末段一致） */
  page: string;
  /** 基础版式的逻辑 id，默认 `base` */
  baseId?: string;
  /** 内置包 id，默认 `DEFAULT_THEME_PACKAGE` */
  builtinPackage?: string;
  /** 版式 id / 包名白名单正则，默认小写字母数字短横线 */
  idRe?: RegExp;
}

/** 版式 id / 主题包 id 白名单：与配色 id 同规则（它会出现在 data-* 与日志里） */
const DEFAULT_VIEW_ID_RE = /^[a-z0-9-]+$/;

/** 设备名先归一化：外部传入的任意值都必须落在宿主白名单里 */
function normalizeDevice(raw: string, host: ViewRegistryHost): string {
  return host.asKnownDevice(raw) ?? host.defaultDevice;
}

/**
 * @param loaders `import.meta.glob` 的结果，键形如
 *                `/src/theme/themes/default/mobile/register/index.vue`
 * @param options 见 `ViewRegistryOptions`
 */
export function createViewRegistry(
  loaders: ViewModuleMap,
  options: ViewRegistryOptions
): ViewRegistry {
  const baseId = options.baseId ?? 'base';
  const builtinPackage = options.builtinPackage ?? 'default';
  const idRe = options.idRe ?? DEFAULT_VIEW_ID_RE;
  const { page } = options;
  if (!idRe.test(page)) {
    throw new Error(`[view] page 名「${page}」不合规：只允许小写字母/数字/短横线`);
  }

  /** 各包各设备在该页的版式：`包/设备` → 加载器（一个包一种版式，所以只有一层） */
  const bases = new Map<string, () => Promise<{ default: Component }>>();

  /** 二段键：把「包 + 设备」拼成一个 Map 键，避免嵌套 Map 的取值样板代码 */
  const scopeKey = (pkg: string, device: string): string => `${pkg}/${device}`;

  // 只收一种形态：`themes/<包>/<设备>/<page>/index.vue`。键里不含固定的前缀层数
  // （glob 模式写法不同，`../` 个数会变），所以不锚定开头，只匹配「themes/包/设备/页面」段。
  const baseKeyRe = new RegExp(`(?:^|/)themes/([^/]+)/([^/]+)/${page}/index\\.vue$`);

  for (const [key, loader] of Object.entries(loaders)) {
    const m = baseKeyRe.exec(key);
    const pkg = m?.[1];
    const device = m?.[2];
    if (!pkg || !device) continue;
    if (!idRe.test(pkg)) continue;
    if (normalizeDevice(device, options) !== device) continue;
    bases.set(scopeKey(pkg, device), loader);
  }

  const resolve = (raw: unknown, pkg: string, device: string): string | null => {
    if (typeof raw !== 'string') return null;
    const id = raw.trim().toLowerCase();
    if (!id || !idRe.test(id)) return null;
    // `base` 是「当前包的基础版式」的历史别名 —— 一个主题包 = 一种版式，所以它**就是包名**。
    if (id === baseId) return pkg;
    // 跨包引用：id 也可能是目标包名（`?view=compact` = 切包）。该目标包在当前设备登记了版式 → 命中。
    if (bases.has(scopeKey(id, device))) return id;
    // 当前包自己的名字（`?view=<当前包>`）：等价于「用当前包」
    if (id === pkg && bases.has(scopeKey(pkg, device))) return pkg;
    return null;
  };

  return {
    baseId,
    builtinPackage,
    packages() {
      return [...bases.keys()]
        .map(k => {
          const cut = k.indexOf('/');
          return { pkg: k.slice(0, cut), device: k.slice(cut + 1) };
        })
        .sort((a, b) => `${a.pkg}/${a.device}`.localeCompare(`${b.pkg}/${b.device}`))
        // 一个主题包 = 一种版式 ⇒ 该包该设备可选的版式 id 就是包名本身
        .map(({ pkg, device }) => ({ pkg, device, ids: [pkg] }));
    },
    has: (raw, pkg, device) => resolve(raw, pkg, device) !== null,
    resolve,
    async load(id, pkg, device) {
      if (!id || !idRe.test(pkg)) return null;
      // 目标包：id 不是当前包名时（`?view=<其它包>` 的跨包形态）以该包为目标，否则当前包自己。
      const target = id !== pkg && bases.has(scopeKey(id, device)) ? id : pkg;
      // 内置包 = 容器静态引入的那份 → 直接说「用它」，一个请求都不发。
      if (target === builtinPackage) return null;
      const loader = bases.get(scopeKey(target, device));
      if (!loader) return null;
      try {
        return (await loader()).default ?? null;
      } catch (err) {
        console.warn(`[view] 主题包「${target}」${device} 端的版式加载失败，已回退`, err);
        return null;
      }
    }
  };
}
