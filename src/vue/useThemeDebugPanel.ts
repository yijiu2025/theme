/**
 * 调试面板的**宿主适配器工厂**（注入式）—— 把应用状态翻译成面板的 `model` / `actions`
 *
 * === 为什么这个文件在内核、却又叫「适配器」 ===
 * 面板本身（`ThemeDebugPanel.vue`）是纯展示：不读路由、不读 store。但「当前是哪一页、
 * 有哪些版式、点了之后改哪个 URL」是**宿主的世界观** —— 所以翻译这一步原本只能留在
 * 宿主，新项目要复用面板就得重抄一百多行。
 *
 * 结论（与 `setupTheme` / `useParentThemeSync` 同一范式）：**翻译逻辑本身是通用的**，
 * 只有「从哪读、写到哪」是宿主的。于是把它收进库，宿主事实全部参数化成一个 `host`
 * 对象 —— 库管「怎么把状态算成 model、怎么把动作落到 URL 和 store」，宿主管「来源 / 目标」。
 * 新项目接入就是「写一个几十行的 host 接线」，而不是「抄一百多行翻译」。
 *
 * === host 里为什么是「窄接口」而不是直接 import 宿主 store / router ===
 * 内核不 import vue-router（应用世界观）、不 import 宿主的 Pinia store（`@/` 别名是
 * 宿主路径）、更不 import 宿主的 `views/` 页面机制。它只认这份结构契约：
 *   · 读侧 —— 当前路由的 path/query、主题 store 的窄 getter、页面版式机制的查询函数；
 *   · 写侧 —— 换版式改 URL（宿主保留 `client_id` 等授权上下文）、换色/换明暗写 store。
 *
 * ⚠️ 版式判定口径与容器（`pick*ViewId`）必须一致：URL 显式值 > 页面声明 > 当前包。
 *   面板**只做展示**，真正的决策仍在容器里；但查找范围必须一致（当前包 × 当前设备），
 *   否则面板会把「生效中的版式」显示错。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';
import { isThemeDebugVisible } from '../manifest';
import type { ResolvedThemeDebug } from '../manifest';
import type { ThemeDebugActions, ThemeDebugColor, ThemeDebugModel } from './types';

/** 页面版式机制的**结构子集**（内核不 import 宿主的 `views/registry.ts`，按需声明） */
export interface ThemePanelViewRegistry {
  /** 外部输入在指定包、指定设备内是否解析得出可用版式 */
  has(raw: unknown, pkg: string, device: string): boolean;
  /** 解析外部输入 → 版式 id（`view ≡ pkg`，非法返回 null） */
  resolve(raw: unknown, pkg: string, device: string): string | null;
  /** 所有包 × 设备在该页的版式总览（面板按「包 + 设备」展示） */
  packages(): Array<{ pkg: string; device: string }>;
}

/** 该页接入了版式机制后的可查询信息（内核只认页面名 + 注册表） */
export interface ThemePanelPageViews {
  page: string;
  registry: ThemePanelViewRegistry;
}

/** 一套配色的元信息（内核只认面板需要展示的那几个字段） */
export interface ThemePanelColorMeta {
  id: string;
  name: string;
  preview?: { primary: string };
}

/**
 * 宿主事实集 —— 「把面板接进这个应用」所需注入的全部外部依赖
 *
 * 全部由宿主在接线文件里提供；内核不 import 任何宿主路径。
 */
export interface ThemeDebugPanelHost {
  /** 当前路由 path（`route.path`） */
  path(): string;
  /** 当前路由 query（`route.query`，值可能是数组） */
  query(): Record<string, unknown>;

  /** 主题 store 的窄接口（读侧） */
  store: {
    /** 当前生效包 id（`packageId`） */
    packageId(): string;
    /** 当前生效页面（`activePage`） */
    activePage(): string;
    /** 当前生效设备（`activeDevice`） */
    activeDevice(): string;
    /** 取某包/设备/页的配色记录（`themeRecordFor`）；内核只要 `meta.id` 与 `tone` */
    themeRecordFor(pkg: string, device: string, page: string): {
      meta: { id: string };
      tone?: string;
    };
    /** 该页该设备声明的版式 id（`viewFor`），未声明返回 undefined */
    viewFor(page: string, device: string): string | undefined;
    /** 用户显式选过的配色 id（`themeId`） */
    themeId(): string;
    /** 明暗意图（`mode`） */
    mode(): string;
  };

  /** 写侧：换版式改 URL（保留 `client_id` 等授权上下文） */
  replaceQuery(patch: Record<string, string | undefined>): void;
  /** 写侧：换配色写 store */
  setTheme(id: string): void;
  /** 写侧：换明暗写 store */
  setMode(mode: string): void;

  /** 设备词汇表（宿主 `THEME_DEVICES`） */
  devices: readonly string[];
  /** 设备中文名（宿主 `deviceLabel`） */
  deviceLabel(id: string): string;

  /** 主题域清单的调试开关（宿主 `themeManifest.debug`） */
  manifest: { debug: ResolvedThemeDebug };

  /** 页面版式机制（宿主 `views/` 链；本次不下沉，作为参数注入） */
  pageFromPath(path: string): string | undefined;
  viewsForPage(page: string | undefined): ThemePanelPageViews | undefined;

  /** 配色查询（内核 registry 已有实现，宿主转发） */
  listColorsOf(device: string, page: string, pkg: string): ThemePanelColorMeta[];
  /** 取某配色的系别；未登记返回 null / undefined（内核用 `?? 'light'` 兜底） */
  toneOfColor(id: string, device: string, page: string, pkg: string): string | null | undefined;
  listColorViews(device: string, page: string): string[];

  /** 设备维度 URL 参数（内核 `readDeviceParam`，宿主转发） */
  readDeviceParam(query: Record<string, unknown>, name: string, device: string): unknown;
}

/** 只把「非空字符串」当有效参数 —— query 值可能是数组 */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function useThemeDebugPanel(host: ThemeDebugPanelHost): {
  visible: ComputedRef<boolean>;
  model: ComputedRef<ThemeDebugModel>;
  actions: ThemeDebugActions;
} {
  /**
   * 面板上手动指定的设备（覆盖页面判定）
   *
   * 用途：在**同一台电脑上**预览"这套配色在手机端长什么样"。不做这个覆盖的话，
   * 要看手机端配色就必须真的去开移动端路由，联调很低效。
   */
  const deviceOverride = ref<string | null>(null);

  const visible = computed(() => isThemeDebugVisible(host.manifest.debug, host.query()));

  /** 当前路由对应的页面名（该页未接入版式机制时为 undefined） */
  const page = computed(() => host.pageFromPath(host.path()));
  const pageViews = computed(() => host.viewsForPage(page.value));

  /** 当前生效设备：面板覆盖优先，否则用页面判定的（渲染形态决定） */
  const device = computed<string>(() => deviceOverride.value ?? host.store.activeDevice());

  /** 当前生效页面 */
  const activePage = computed(() => page.value ?? host.store.activePage());

  /**
   * 当前生效的**版式 id**
   *
   * 🔴 这个 computed 必须定义在 `views` 之前：后者在求值时读它，
   *    顺序颠倒会在首次求值时踩 TDZ（现象是面板整个不渲染）。
   *
   * fallback 是 `host.store.packageId()` 而不是 `'base'`：新版式架构下 `view ≡ pkg`，
   * `'base'` 已不是合法 view 名。
   */
  const activeViewId = computed(() => {
    const registry = pageViews.value?.registry;
    if (!registry) return host.store.packageId();
    const pkg = host.store.packageId();
    const dev = device.value;
    // 设备维度参数：`view.<设备>` 优先于 `view`（与容器 `pick*ViewId` 同一套读取规则）
    const fromUrl = asText(host.readDeviceParam(host.query(), 'view', dev));
    if (fromUrl && fromUrl !== 'base') {
      // 与 `pickRegisterViewId` 同款：当前包内找 → 把 url 当**包名**试 → 兜底当前包。
      // 最后一步是关键：用户点 `?view=compact` 实际是把视图切到 compact 包，
      // 面板的"当前版式"必须反映这一点，否则出现"视图是 compact、面板说 default"。
      const inCurrent = registry.resolve(fromUrl, pkg, dev);
      if (inCurrent) return inCurrent;
      if (registry.has(fromUrl, fromUrl, dev)) return fromUrl;
      return pkg;
    }
    const declared = page.value ? host.store.viewFor(page.value, dev) : undefined;
    return (declared ? registry.resolve(declared, pkg, dev) : null) ?? pkg;
  });

  /**
   * 当前页的**可选版式**（= 可选主题包）
   *
   * 🔴 一个主题包 = 一种版式（2026-09-26），所以版式清单**就是**主题包清单：
   *    枚举 `registry.packages()` 里当前设备的每个包，包名即版式 id。
   */
  const viewOptions = computed<string[]>(() => {
    const registry = pageViews.value?.registry;
    if (!registry || !page.value) return [];
    const seen = new Set<string>();
    for (const { pkg, device: pkgDevice } of registry.packages()) {
      if (pkgDevice !== device.value) continue;
      seen.add(pkg);
    }
    // 当前生效 view 一定在列（即使该范围内没扫到它，例如外部强制写了未知 id）
    if (!seen.has(activeViewId.value)) seen.add(activeViewId.value);
    return [...seen].sort();
  });

  /** **当前版式**支持的颜色 —— 切版式后这份清单会变，这正是"每版式各自选色"的落点 */
  const colors = computed<ThemeDebugColor[]>(() => {
    const active = activePage.value;
    if (!active) return [];
    return host.listColorsOf(device.value, active, activeViewId.value).map(meta => ({
      id: meta.id,
      name: meta.name,
      tone: (host.toneOfColor(meta.id, device.value, active, activeViewId.value) ??
        'light') as ThemeDebugColor['tone'],
      preview: meta.preview?.primary
    }));
  });

  /** 该页在该设备下挂了配色的版式清单（提示"这页还有哪些版式有颜色"） */
  const viewsWithColors = computed<string[]>(() =>
    activePage.value ? host.listColorViews(device.value, activePage.value) : []
  );

  /**
   * 当前**生效**的配色 id
   *
   * 🔴 传 `activeViewId` 作为 pkg：view ≡ pkg，这样 `findRecord` 按**当前包**查 ——
   *    否则会把 compact 包点的 blue 又落回 default 包。
   */
  const activeColorId = computed(
    () => host.store.themeRecordFor(activeViewId.value, device.value, activePage.value).meta.id
  );

  const model = computed<ThemeDebugModel>(() => ({
    page: page.value,
    devices: host.devices,
    deviceLabels: Object.fromEntries(host.devices.map(id => [id, host.deviceLabel(id)])),
    device: device.value,
    deviceOverride: deviceOverride.value,
    views: viewOptions.value,
    view: activeViewId.value,
    viewsWithColors: viewsWithColors.value,
    colors: colors.value,
    color: activeColorId.value,
    selectedColor: host.store.themeId(),
    mode: host.store.mode() as ThemeDebugModel['mode']
  }));

  const actions: ThemeDebugActions = {
    pickDevice(id) {
      // 面板发来的是 `model.devices` 里的值（= THEME_DEVICES），这里再收一次口：
      // 契约是宽类型 `string`，越界值一律按"跟随页面"处理，不让它污染 store。
      deviceOverride.value =
        id !== null && (host.devices as readonly string[]).includes(id) ? id : null;
    },

    /**
     * 切换版式（**只改 URL 的版式键，path 不动**）
     *
     * 🔴 设备维度参数：版式键可能是 `view` 也可能是 `view.<设备>`（设备专属优先）。
     *    必须改**当前设备实际由哪条键决定**的那一条，否则带 `?view.standard=compact`
     *    时点面板会写 `view=xxx` 而被设备专属键盖住 —— 表现是"点了没反应"。
     *
     * 选回当前生效的版式时把参数**删掉**而不是写成 `view=<id>`：URL 干净，
     * 也与容器「无参数即默认 view」的判定一致。
     */
    pickView(id) {
      const scopedKey = `view.${device.value}`;
      const key = scopedKey in host.query() ? scopedKey : 'view';
      if (id === activeViewId.value) host.replaceQuery({ [key]: undefined });
      else host.replaceQuery({ [key]: id });
    },

    /**
     * 选颜色：**只换色，不碰明暗**（两者正交，见 stores/theme.ts 头注释）
     *
     * 不改 URL：配色是运行时状态（store + localStorage），与 `?theme=` 是两套入口，
     * 面板改的是当前会话的观感，不该往 URL 上写。
     */
    pickColor(id) {
      host.setTheme(id);
    },

    pickMode(mode) {
      host.setMode(mode);
    },

    /** 一键回默认：清掉落盘的配色与明暗偏好 */
    reset() {
      host.setMode('system');
      const first = colors.value[0];
      if (first) host.setTheme(first.id);
    }
  };

  return { visible, model, actions };
}
