/**
 * 主题作用域（scope）—— 设备 / 页面 / 版式三个查找维度 + 配色解析入口
 *
 *   · activeDevice：由 <ThemeView> 的 device prop 告知（setActiveDevice 是唯一写入口，
 *     判定在宿主分发器，库不认视口 / UA / ?device= 这些宿主词汇）；
 *   · activePage / activeView：由容器在 setup 里告知（setActivePageView）；
 *   · themeRecordFor：把「配色意图（themeId / deviceTheme）+ 作用域」解析成可渲染配色；
 *   · 派生值：isDark（= 生效配色 tone）、activeTone、packageId、device。
 *
 * 依赖方向：scope ← intent / runtime（它们读 scope），scope 不反向依赖 —— 唯一的共享基础。
 */
import { computed, ref } from 'vue';
import { DEFAULT_THEME_PACKAGE } from '../../constants';
import { getThemeRecord, listThemes } from '../../registry';
import { currentQuery } from '../device/device-domain';
import { readInitialTheme, readUrlIntent } from './theme-persistence';
import type { DeviceThemeIntent, ThemeStorageKeys } from './theme-persistence';
import {
  DEFAULT_VIEW_PARAM,
  readUrlViewIntent,
  sameViewSnapshot,
  viewParamsSnapshot
} from '../../views/params';
import type { DeviceViewIntent } from '../../views/params';
import type { DeviceVocab } from '../../types';

export function useThemeScope(
  keys: ThemeStorageKeys,
  colorParam: string,
  viewParam: string = DEFAULT_VIEW_PARAM,
  defaultPage: string = '',
  devices: readonly DeviceVocab[] = []
) {
  /** 兜底设备 = 注入清单末条（顺序即优先级；空清单时空串 —— themeId 走落盘/默认链） */
  const fallbackId = devices[devices.length - 1]?.id ?? '';
  const urlIntent = readUrlIntent(colorParam, devices);
  // 版式意图：URL 一次读入（query 来自设备域 `currentQuery()`，设备清单来自装配期注入）。
  // 与配色侧读 `window.location.search` 同源不同径——版式意图要**跟着路由走**：/login 与
  // /register 可带不同 `th`；store 化后由编排层 watch `currentQuery()` 保持响应。
  const urlViewIntent = readUrlViewIntent(currentQuery(), viewParam, devices);

  /**
   * URL 按设备指定的配色（**响应式**）
   * 做成 ref 而非普通常量，是**用户显式操作会清掉当前设备那一条**（见 `clearDeviceThemeOverride`）。
   */
  const deviceTheme = ref<DeviceThemeIntent>({ ...urlIntent.deviceTheme });

  /**
   * 某设备的配色是否被 URL **显式**指定 → 该设备"锁定"。
   * 锁定只挡**自动**改写，不挡用户显式操作；逐设备判定是必须的。
   */
  function urlLockedThemeOf(device: string): boolean {
    return deviceTheme.value[device] !== undefined;
  }

  /**
   * 清掉某设备被 URL 写下的配色 —— **只该由用户的显式操作调用**。
   */
  function clearDeviceThemeOverride(device: string = activeDevice.value): void {
    if (deviceTheme.value[device] === undefined) return;
    const next = { ...deviceTheme.value };
    delete next[device];
    deviceTheme.value = next;
  }

  /**
   * **全局**配色 —— 只被"URL 没有覆盖这台设备"的那些设备采用。
   * 设备专属 URL 值在 `themeRecordFor` 里优先于它。
   */
  const themeId = ref<string>(urlIntent.deviceTheme[fallbackId] ?? readInitialTheme(keys));

  /** 当前**生效设备** —— 由 `<ThemeView>` 的 device prop 告知（库不自行判定，见文件头） */
  const activeDevice = ref<string>(fallbackId);

  /**
   * 告知「当前渲染视图属于哪台设备」—— **`<ThemeView>` 的职责**（宿主分发器选好设备
   * 容器后，容器内的 ThemeView 用 `device` prop 把身份带进来；主题据此解析配色 / 版式）。
   *
   * 🔴 这是 activeDevice 的**唯一写入口**（单测 / 调试面板同样走它）。判定逻辑
   *    （视口 / UA / `?device=` / `?from=`）是宿主词汇，住在宿主侧 —— 库不认。
   */
  function setActiveDevice(device: string): void {
    if (activeDevice.value !== device) activeDevice.value = device;
  }

  /**
   * 当前生效页面（配色归属 = 包 × 设备 × 页面）
   *
   * 初始值：`defaultPage` 播种（P0 无路由支持，2026-10-23）或空串。空串期间查询走空记录
   * 兜底——对路由型应用无害（`<ThemeView>` 挂载即覆盖）；对无路由 / 纯壳层应用，播种
   * 一个页面名让"还没人调 setActivePageView"时 token 也能解析（否则零注入、全站只剩基线）。
   * 页面仍是宿主词汇：库不设默认页，`defaultPage` 由宿主经 `ThemeStateOptions` 显式给。
   */
  const activePage = ref<string>(defaultPage);
  const activeView = ref<string>(DEFAULT_THEME_PACKAGE);

  function setActivePageView(page: string, view: string): void {
    if (page && activePage.value !== page) activePage.value = page;
    const next = view || DEFAULT_THEME_PACKAGE;
    if (activeView.value !== next) activeView.value = next;
  }

  /* ==========================================================================
     版式意图（2026-10-20 store 化）—— 与配色侧 `deviceTheme` / `themeId` 完全同形
     ========================================================================== */

  /**
   * URL 按设备**显式**指定的版式（**响应式** ref）
   *
   * 只记设备专属键（`?th_<urlKey>`）；通用键（`?th`）在 `viewIntent`。做成 ref 而非
   * 普通常量，是 debug 面板的显式操作会写/清当前设备那条（见 `setDeviceView`）。
   */
  const deviceView = ref<DeviceViewIntent>({ ...urlViewIntent.deviceView });

  /** 全局版式意图 = URL 通用键（`?th`）；debug 显式写它时不落盘、不写 URL */
  const viewIntent = ref<string | null>(urlViewIntent.viewIntent);

  /**
   * 某设备**显式指定**的版式 id（专属键 > 通用键；都没有返回 null）
   * —— `<ThemeView>` 与调试面板的**唯一数据源**（取代原先每次渲染现读 route.query）。
   */
  function deviceViewOf(device: string = activeDevice.value): string | null {
    return deviceView.value[device] ?? viewIntent.value;
  }

  /** 某设备的版式是否被 URL **专属键**显式指定 → 该设备"锁定" */
  function urlLockedViewOf(device: string): boolean {
    return deviceView.value[device] !== undefined;
  }

  /** 清掉某设备被 URL 写下的版式 —— **只该由用户的显式操作调用**（debug 选回生效版式） */
  function clearDeviceViewOverride(device: string = activeDevice.value): void {
    if (deviceView.value[device] === undefined) return;
    const next = { ...deviceView.value };
    delete next[device];
    deviceView.value = next;
  }

  /** 显式设置某设备的版式（debug 面板用；**只写 store**，不写 URL、不落盘） */
  function setDeviceView(device: string, id: string): void {
    const next = { ...deviceView.value };
    next[device] = id;
    deviceView.value = next;
  }

  /**
   * URL 上 `th*` **原始值**变化 → 重新读入 store（编排层 watch `currentQuery()` 调它）
   *
   * 🔴 "仅当原始值变化才同步"靠快照判等：debug 改写只碰 store（不写 URL），快照
   *    不变 ⇒ 不会被误冲；跨页带不同 `th`（/login → /register）⇒ 同步，行为与
   *    store 化前"每次渲染现读 URL"一致。
   */
  let lastViewSnapshot = viewParamsSnapshot(currentQuery(), viewParam, devices);
  function syncUrlViewIntent(): void {
    const next = viewParamsSnapshot(currentQuery(), viewParam, devices);
    if (sameViewSnapshot(lastViewSnapshot, next)) return;
    lastViewSnapshot = next;
    const fresh = readUrlViewIntent(currentQuery(), viewParam, devices);
    deviceView.value = { ...fresh.deviceView };
    viewIntent.value = fresh.viewIntent;
  }

  /**
   * 按设备 + 页面 + 版式解析出**实际生效**的配色记录。
   * 🔴 设备专属 URL 配色优先于全局 themeId：`deviceTheme[device] ?? themeId`。
   * 🔴 接收 pkg 参数：view ≡ pkg，配色查找必须按当前包。
   */
  function themeRecordFor(
    pkg: string = DEFAULT_THEME_PACKAGE,
    device: string = activeDevice.value,
    page: string = activePage.value
  ): ReturnType<typeof getThemeRecord> {
    const id = deviceTheme.value[device] ?? themeId.value;
    return getThemeRecord({ id, device, pkg, page });
  }

  /**
   * 当前生效配色记录（共享解析缓存）
   *
   * isDark / activeTone / packageId 三个派生值共用这一份 computed：一次状态变化
   * 只解析一次，其余派生读缓存。不导出：公开面按 index.ts 的显式清单哲学不扩大。
   *
   * 🔴 用 `activeView` 作为 pkg 解析（view ≡ pkg）：与 runtime 层 `theme-runtime.ts`
   *    的 `pkg: view` 注入口径一致。此前恒按 default 包解析，导致非默认包（如
   *    compact）下 packageId 恒 'default'、isDark 恒按 default 判定（黑系配色不挂
   *    .dark 类）、viewFor 只读 default 包声明 —— 三处连锁错误。
   */
  const activeRecord = computed(() => themeRecordFor(activeView.value));

  /** 最终是否深色 = 当前**生效配色**的系别（明暗 ≡ 色系） */
  const isDark = computed(() => activeRecord.value.tone === 'dark');

  /** 当前生效配色的系别 */
  const activeTone = computed(() => activeRecord.value.tone ?? 'light');

  /** 当前生效主题包（做成 computed 让容器的 watch 能当响应源） */
  const packageId = computed(() => activeRecord.value.pkg);

  /** 当前生效设备（只读别名） */
  const device = computed(() => activeDevice.value);

  /** 可选主题列表（注册表静态，取一次） */
  const themes = listThemes();

  /** 取当前配色为某页面声明的版式 id（只取值不校验） */
  function viewFor(page: string, dev: string = activeDevice.value): string | undefined {
    return themeRecordFor(packageId.value, dev, page).views?.[page];
  }

  return {
    /** 装配期注入的设备词汇清单（调试面板 / URL 参数解析用；库不自持注册表） */
    devices,
    urlIntent,
    urlViewIntent,
    deviceTheme,
    themeId,
    deviceView,
    viewIntent,
    activeDevice,
    activePage,
    activeView,
    isDark,
    activeTone,
    packageId,
    device,
    themes,
    urlLockedThemeOf,
    clearDeviceThemeOverride,
    urlLockedViewOf,
    clearDeviceViewOverride,
    deviceViewOf,
    setDeviceView,
    syncUrlViewIntent,
    setActiveDevice,
    setActivePageView,
    themeRecordFor,
    viewFor
  };
}

/** scope 的公开面（供 intent / runtime 引用；类型由 `useThemeScope` 返回处推断） */
export type ThemeScope = ReturnType<typeof useThemeScope>;
