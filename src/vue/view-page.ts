/**
 * 页面工厂 —— 「这一页接入可换 UI 机制」的**唯一写法**（内核版）
 *
 * === 它收掉的是什么 ===
 * 三个页面文件原先各自抄了一遍同样的机制：声明 glob → `createViewRegistry` →
 * `createViewPicker` → 两个转发函数。机制逐字相同，改一条口径要改三处。现在机制只在
 * 这里写一次，页面文件退化成「一份契约 + 一次声明」。
 *
 * === 为什么 glob 还要写在页面文件里 ===
 * `import.meta.glob` 的入参**必须是字符串字面量**（Vite 编译期静态分析），所以
 * 「主题包目录通配 + 页面名 + index.vue」这个模式没法由工厂拼出来。于是模式随 `loaders`
 * 一起从页面文件传进来 —— 这是框架约束，不是设计妥协。
 *
 * === 页面名从哪来 ===
 * 页面名同时是：目录名、`views/<页面>.ts` 的文件名、路由 path 的末段。三处必须字面一致。
 *
 * === 设备与 envView 为什么是宿主事实 ===
 * 设备归一化（白名单 + 默认设备）与 `import.meta.env.VITE_<PAGE>_VIEW` 都是宿主部署事实，
 * 内核不认识 —— 分别通过 `device` 参数与 `envView` 参数注入。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/views/page.ts 下沉）
 */
import type { ViewModuleMap, ViewRegistry } from './view-registry';
import { createViewRegistry } from './view-registry';
import { createViewPicker, type ViewPickerSource } from './view-picker';

/** 页面对象的运行时标记（`Symbol.for` = 跨模块实例也同一个键） */
const PAGE_BRAND = Symbol.for('mauth.themePage');

export interface ThemePageOptions {
  /** 页面名（目录名 / 文件名 / 路由末段三处一致） */
  page: string;
  /** 默认路由标题（`document.title` 用；设备专属标题在 `titles` 里覆盖） */
  title: string;
  /** 设备专属路由标题（key = 设备 id；缺省回落 `title`） */
  titles?: Partial<Record<string, string>>;
  /** 部署级默认版式（`import.meta.env.VITE_<PAGE>_VIEW`） */
  envView?: unknown;
  /** `import.meta.glob` 的结果（模式必须是字面量，所以只能由页面文件提供） */
  loaders: ViewModuleMap;
  /** 设备归一化宿主事实（白名单 + 默认设备） */
  device: {
    defaultDevice: string;
    asKnownDevice(raw: unknown): string | null;
  };
}

/** 一个页面接入版式机制后的全部能力（页面文件的公开面就长这样） */
export interface ThemePage {
  readonly page: string;
  readonly title: string;
  titleOf(device: string): string;
  readonly views: ViewRegistry;
  pick(source?: ViewPickerSource): string;
  preload(source?: ViewPickerSource): void;
}

/**
 * 声明一个页面
 *
 * 用法（页面文件里就这么多）：
 * ```ts
 * export const loginPage = defineThemePage({
 *   page: 'login',
 *   title: '安全登录',
 *   titles: { mobile: '移动端登录' },
 *   envView: import.meta.env.VITE_LOGIN_VIEW,
 *   loaders: import.meta.glob('/src/theme/themes/【包通配】/【设备通配】/login/index.vue'),
 *   device: { defaultDevice: DEFAULT_THEME_DEVICE, asKnownDevice: asThemeDevice }
 * });
 * ```
 */
export function defineThemePage(options: ThemePageOptions): ThemePage {
  const { page, title, titles, envView, loaders, device } = options;
  const views = createViewRegistry(loaders, {
    page,
    ...device
  });
  const picker = createViewPicker({ registry: views, envView, ...device });

  const result: ThemePage = {
    page,
    title,
    titleOf: (dev: string) => titles?.[dev] ?? title,
    views,
    pick: (source: ViewPickerSource = {}) => picker.pick(source),
    preload: (source: ViewPickerSource = {}) => picker.preload(source)
  };
  // 标记不可枚举：它只是个身份戳，不该出现在日志 / 序列化里
  Object.defineProperty(result, PAGE_BRAND, { value: true, enumerable: false });
  return result;
}

/** 这个值是不是 `defineThemePage` 的产物 */
export function isThemePage(value: unknown): value is ThemePage {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<PropertyKey, unknown>)[PAGE_BRAND] === true
  );
}
