/**
 * 调试面板的适配器 —— 把应用状态翻译成面板的 model / actions
 *
 * 面板主体是纯展示；「当前是哪页、有哪些版式、点了之后改什么」这些事实全部从库内
 * 域自动取（无参）：store（ThemeRoot provide）、设备清单（store.devices）、页面域
 * （pageOf）、配色查询（内核注册表单例）、版式意图（store.deviceViewOf / setDeviceView）。
 * 宿主零接线：App.vue 一行 <ThemeDebugPanel />。
 *
 * 可见性判断不在本文件（在门卫 ThemeDebugPanel.vue）；本文件只负责「显示什么」。
 *
 * 「生效配色」走 store.themeRecordFor 而非内核 registry：它的语义包含「URL 设备覆盖 +
 * 用户显式清除覆盖」的运行时状态，实时读 URL 还原不出来；其余清单 / 系别走 registry。
 */
import { computed, inject, ref } from 'vue';
import type { ComputedRef } from 'vue';
import { listColorViews, listColorsOf, toneOfColor } from '../../registry';
import type { ThemeDebugActions, ThemeDebugColor, ThemeDebugModel } from '../types';
import { pageOf } from '../registry/view-page';
import { themeStoreKey } from '../store/theme-store';
import type { ThemeStoreLike } from '../store/theme-store';

/** 只把「非空字符串」当有效参数 —— query 值可能是数组 */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function useThemeDebugPanel(): {
  model: ComputedRef<ThemeDebugModel>;
  actions: ThemeDebugActions;
} {
  const store = inject<ThemeStoreLike>(themeStoreKey);
  if (!store) {
    throw new Error('[ThemeDebugPanel] 未注入主题 store —— 请通过 <ThemeRoot :themeStore> 提供');
  }

  /** 面板上手动指定的设备（覆盖页面判定），用于在**同一台电脑**预览另一端的配色 */
  const deviceOverride = ref<string | null>(null);

  /** 可选设备清单 + 显示名（来自 store 的装配期注入清单，库不自持注册表） */
  const devices = store.devices.map(d => d.id);
  const deviceLabels: Record<string, string> = Object.fromEntries(
    store.devices.map(d => [d.id, d.label])
  );

  /** 当前生效设备：面板覆盖优先，否则用分发器告知 store 的（`activeDevice`） */
  const device = computed<string>(() => deviceOverride.value ?? store.activeDevice);

  /** 当前生效页面：由 `<ThemeView>` 的 `setActivePageView` 维护（不再从路径反推） */
  const activePage = computed(() => store.activePage);

  /**
   * 当前生效的**版式 id**
   *
   * 🔴 这个 computed 必须定义在 `viewOptions` 之前：后者求值时读它，顺序颠倒会在
   *    首次求值时踩 TDZ（现象是面板整个不渲染）。fallback 是 `store.packageId`
   *    而不是 `'base'`：新版式架构下 `view ≡ pkg`，`'base'` 已不是合法 view 名。
   */
  const activeViewId = computed(() => {
    const registry = activePage.value ? pageOf(activePage.value)?.views : undefined;
    if (!registry) return store.packageId;
    const pkg = store.packageId;
    const dev = device.value;
    // 版式意图来自 store（2026-10-20 store 化）：设备专属 > 通用，与容器 pick 同一数据源
    const fromUrl = asText(store.deviceViewOf(dev));
    if (fromUrl && fromUrl !== 'base') {
      const inCurrent = registry.resolve(fromUrl, pkg, dev);
      if (inCurrent) return inCurrent;
      if (registry.has(fromUrl, fromUrl, dev)) return fromUrl;
      return pkg;
    }
    const declared = activePage.value ? store.viewFor(activePage.value, dev) : undefined;
    return (declared ? registry.resolve(declared, pkg, dev) : null) ?? pkg;
  });

  /**
   * 当前页的**可选版式**（= 可选主题包）。一个主题包 = 一种版式，所以版式清单
   * 就是主题包清单：枚举注册表里当前设备的每个包，包名即版式 id。
   */
  const viewOptions = computed<string[]>(() => {
    const registry = activePage.value ? pageOf(activePage.value)?.views : undefined;
    if (!registry || !activePage.value) return [];
    const seen = new Set<string>();
    for (const { pkg, device: pkgDevice } of registry.packages()) {
      if (pkgDevice !== device.value) continue;
      seen.add(pkg);
    }
    // 当前生效 view 一定在列（即使该范围内没扫到它，例如外部强制写了未知 id）
    if (!seen.has(activeViewId.value)) seen.add(activeViewId.value);
    return [...seen].sort();
  });

  /** **当前版式**支持的颜色 —— 切版式后这份清单会变，正是"每版式各自选色"的落点 */
  const colors = computed<ThemeDebugColor[]>(() => {
    const active = activePage.value;
    if (!active) return [];
    return listColorsOf(device.value, active, activeViewId.value).map(meta => ({
      id: meta.id,
      name: meta.name,
      tone: toneOfColor(meta.id, device.value, active, activeViewId.value) ?? 'light',
      preview: meta.preview?.primary
    }));
  });

  /** 该页在该设备下挂了配色的版式清单（提示"这页还有哪些版式有颜色"） */
  const viewsWithColors = computed<string[]>(() =>
    activePage.value ? listColorViews(device.value, activePage.value) : []
  );

  /**
   * 当前**生效**的配色 id（含 URL 设备覆盖 + 用户显式清除覆盖的语义）——
   * 🔴 传 `activeViewId` 作为 pkg：view ≡ pkg，否则会把 compact 包点的 blue 又落回 default 包。
   */
  const activeColorId = computed(
    () => store.themeRecordFor(activeViewId.value, device.value, activePage.value).meta.id
  );

  const model = computed<ThemeDebugModel>(() => ({
    page: activePage.value,
    devices,
    deviceLabels,
    device: device.value,
    deviceOverride: deviceOverride.value,
    views: viewOptions.value,
    view: activeViewId.value,
    viewsWithColors: viewsWithColors.value,
    colors: colors.value,
    color: activeColorId.value,
    selectedColor: store.themeId,
    mode: store.mode
  }));

  const actions: ThemeDebugActions = {
    pickDevice(id) {
      // 面板发来的是 `devices` 里的值，这里再收一次口：越界值按"跟随页面"处理。
      deviceOverride.value = id !== null && devices.includes(id) ? id : null;
    },

    /**
     * 切换版式（**只写 store，URL 全程不动** —— 2026-10-20 store 化）
     *
     * 旧实现改 URL 版式键（`replaceQuery`），要先判断"当前设备实际由哪条键决定"
     * （专属键在就改专属键，否则改通用键——改错键会被专属键盖住，"点了没反应"）；
     * store 化后写**该设备的显式意图**（`setDeviceView`），不存在"改错键"问题，
     * 且只影响当前设备（旧实现只有通用键时，改一下会影响所有设备）。
     * 选回当前生效版式 = 清掉该设备意图（`clearDeviceViewOverride`），回到
     * URL/声明档，与旧实现"删参数"净效果一致。
     */
    pickView(id) {
      if (id === activeViewId.value) store.clearDeviceViewOverride(device.value);
      else store.setDeviceView(device.value, id);
    },

    /**
     * 选颜色：**只换色，不碰明暗**（两者正交）。不改 URL：配色是运行时状态
     * （store + localStorage），面板改的是当前会话观感。
     */
    pickColor(id) {
      store.setTheme(id);
    },

    pickMode(mode) {
      store.setMode(mode);
    },

    /** 一键回默认：清掉落盘的明暗偏好 */
    reset() {
      // 🔴 只清明暗意图：setMode('system') 会经 mode watch 触发 syncColorToTone，配色
      //    自动校正到匹配 system 明暗的系别。不要调 setTheme —— setTheme 会按配色的
      //    tone 把 mode 重写回 light/dark（把刚设的 'system' 顶掉），破坏「恢复默认」。
      store.setMode('system');
    }
  };

  return { model, actions };
}
