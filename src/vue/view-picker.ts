/**
 * 版式选择器工厂 —— 「这次访问用哪套版式」的**唯一实现**（内核版）
 *
 * === 为什么要有它 ===
 * login / register / forgot-password 三页各有一份页面文件（契约 + 注册表），但
 * 「从外部输入挑出一个版式 id」这件事与页面无关 —— 三页的取值链、回退口径、
 * 非法值规则逐字相同。收口后链只有一份，各页只声明自己的页面名与环境变量。
 *
 * === 选择优先级（高 → 低）===
 *   1. URL `?view=<id>`        —— 本次访问的显式意图
 *   2. 主题包 / 配色记录的声明   —— `views.<page>`（由 store 的 `viewFor(page)` 取出）
 *   3. `VITE_<PAGE>_VIEW`      —— 部署级默认（整站换 UI，不动代码）
 *   4. 当前**包名**             —— 一个主题包 = 一种版式 ⇒ 版式 id ≡ 包名
 *
 * 🔴 **第 1 档命中后不再回退到 2/3 档**：`?view=typo` 落到**当前包**，而不是被声明或
 *    环境变量接管 —— 显式参数写错时静默换用另一套 UI，比看到当前包的版式难排查得多。
 * 🔴 **非法值一律落当前包名，绝不落 `'base'`**：配色注册表里的 view 段恒等于包名。
 *
 * === 设备名是外部输入 ===
 * 内核不认识设备词汇表，`source.device` 是宽 `string`；设备归一化（白名单 + 默认设备）
 * 由**参数注入**（`defaultDevice` + `asKnownDevice`）决定 —— 与配色注册表同范式。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/picker.ts 下沉）
 */
import type { ViewRegistry } from './view-registry';

/** 选择器的输入：四个都是外部值，全部未校验 */
export interface ViewPickerSource {
  /** `?view=`（设备维度解析**之后**）的原始值，可以是数组 / undefined 等任意形态 */
  url?: unknown;
  /** 当前配色记录声明的版式 id（`store.viewFor(page)` 取出），未声明时为 undefined */
  theme?: unknown;
  /** 当前主题包 id —— 查找范围的包那一段 */
  pkg?: unknown;
  /** 当前设备 —— 查找范围的设备那一段 */
  device?: unknown;
}

export interface ViewPicker {
  /** 挑出版式 id —— **永远返回可用 id**，最差是当前包名 */
  pick(source?: ViewPickerSource): string;
  /** 提前把版式 chunk 拉下来（**不 await**）；零请求组合直接短路 */
  preload(source?: ViewPickerSource): void;
}

export interface ViewPickerOptions {
  /** 本页的版式注册表 */
  registry: ViewRegistry;
  /** 部署级默认版式（`import.meta.env.VITE_<PAGE>_VIEW`），未配置时为 undefined */
  envView?: unknown;
  /** 兜底设备（宿主 `DEFAULT_THEME_DEVICE`） */
  defaultDevice: string;
  /** 设备名归一化（宿主 `asThemeDevice`；不认识则落 defaultDevice） */
  asKnownDevice(raw: unknown): string | null;
}

/** 只把「非空字符串」当作有效外部输入（空串 / 非字符串都算「没给」） */
function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function createViewPicker(options: ViewPickerOptions): ViewPicker {
  const { registry, envView, defaultDevice, asKnownDevice } = options;

  /** 取当前主题包；未传则落内置包（与配色注册表的回退口径一致） */
  function asPackage(value: unknown): string {
    return asText(value) ?? registry.builtinPackage;
  }

  /** 取当前设备；未传 / 不认识都落默认设备（白名单只此一处） */
  function asDevice(value: unknown): string {
    return asKnownDevice(value) ?? defaultDevice;
  }

  function pick(source: ViewPickerSource = {}): string {
    const pkg = asPackage(source.pkg);
    const device = asDevice(source.device);
    const url = asText(source.url);
    // 第 1 档：URL 显式意图 —— 非法值也**不回退**到下面的档（见文件头 🔴）
    if (url) return registry.resolve(url, pkg, device) ?? pkg;

    // 第 2/3 档 → 第 4 档：声明 → 部署级默认 → 当前包
    const env = asText(envView);
    return (
      registry.resolve(source.theme, pkg, device) ??
      (env ? registry.resolve(env, pkg, device) : null) ??
      pkg
    );
  }

  function preload(source: ViewPickerSource = {}): void {
    const pkg = asPackage(source.pkg);
    const device = asDevice(source.device);
    // ⚠️ 必须把 source 原样交给 pick：漏掉 `theme`（声明档）会让预取算出与容器不同的 id。
    const id = pick(source);
    // 内置包的版式由容器静态引入 → 零请求，不必预热
    if (id === pkg && pkg === registry.builtinPackage) return;
    void registry.load(id, pkg, device);
  }

  return { pick, preload };
}
