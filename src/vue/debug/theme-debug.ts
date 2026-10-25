/**
 * 主题调试句柄（dev-only）—— window.__MAUTH_STORE__ 探针 + 右下角角标 + URL 参数审计
 *
 * 三个职责：
 *   1. installThemeDebug(scope, intent)：store 六值 + URL 变化即刷新，把问题打 console
 *      （无门控 —— 静默失败不靠「记得开开关」防）；
 *   2. 探针 __MAUTH_STORE__：11 个 store getter + url / effectiveView / warnings
 *      三个链路键（地址栏原始值 → store 意图 → 生效结果）；
 *   3. 右下角角标：设备 / 页 / 版式 / 包 + 警告计数（红 = 当前有问题）。
 *
 * 探针与角标的可见性 = 清单 debug 开关 + 路由 query（与 <ThemeDebugPanel> 同一判据）；
 * 警告不受门控（dev 恒开）。prod 早退：import.meta.env.DEV 静态替换后函数体整体消失。
 */
import { watch } from 'vue';
import { collectWarnings, effectiveViewRaw, parseThemeParams } from '../../views/param-audit';
import type { ThemeUrlParams, WarningContext } from '../../views/param-audit';
import { isThemeDebugVisible, themeManifest } from '../../manifest';
import { currentQuery } from '../device/device-domain';
import type { ThemeIntent } from '../store/theme-intent';
import type { ThemeScope } from '../store/theme-scope';
import { pageOf } from '../registry/view-page';

/**
 * `?debug=theme` 门控 —— 与 `<ThemeDebugPanel>` **同一判据**：读清单单例
 * （`theme.config.ts` 可自定义 query / value）+ 路由 query（`currentQuery()`），
 * 而不是硬编码 `?debug=theme` —— 宿主自定义触发键后，面板与探针必须一起生效。
 */
function debugGateOn(): boolean {
  return isThemeDebugVisible(themeManifest().debug, currentQuery());
}

/**
 * 挂载主题调试句柄（`createThemeState` 装配末尾调一次；返回 dispose 供测试 / HMR）
 *
 * ⚠️ prod 早退：`import.meta.env.DEV` 被静态替换为 false，函数体整体消失 ——
 *    产物字节与 store 行为都不变（`__MAUTH_STORE__` 本就只存在于 dev）。
 */
export function installThemeDebug(scope: ThemeScope, intent: ThemeIntent): () => void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => {};

  /** 已喊过的唯一消息（console 去重；页面生命周期内同一问题只喊一次） */
  const warned = new Set<string>();
  /** 当前存在的问题（每次刷新重算 —— 探针 warnings 与角标反映实时状态） */
  let current: string[] = [];
  let probeMounted = false;
  let badge: HTMLDivElement | null = null;

  function auditContext(): WarningContext {
    const registry = scope.activePage.value ? pageOf(scope.activePage.value)?.views : undefined;
    return {
      activeDevice: scope.activeDevice.value,
      activePage: scope.activePage.value,
      packageId: scope.packageId.value,
      pageRegistered: !!registry,
      devices: scope.devices.map(d => ({ id: d.id, urlKey: d.urlKey })),
      hasView: (raw, pkg, device) => (registry ? registry.has(raw, pkg, device) : false),
      listViews: (device) =>
        registry
          ? [...new Set(registry.packages().filter(p => p.device === device).map(p => p.pkg))].sort()
          : []
    };
  }

  /** 当前设备生效的 URL 版式原始值 + 判定（探针的「输入 / 结果并排」） */
  function effectiveViewInfo(): { raw: string | null; legal: boolean | null } {
    const params = parseThemeParams(currentQuery());
    const ctx = auditContext();
    const activeUrlKey =
      ctx.devices.find(d => d.id === ctx.activeDevice)?.urlKey ?? ctx.activeDevice;
    const raw = effectiveViewRaw(params, activeUrlKey);
    return {
      raw,
      legal:
        raw === null || !ctx.pageRegistered
          ? null
          : ctx.hasView(raw, ctx.packageId, ctx.activeDevice)
    };
  }

  function mountProbe(): void {
    probeMounted = true;
    (window as unknown as Record<string, unknown>).__MAUTH_STORE__ = {
      // ---- store 内部状态（2026-10-19 起在 create-theme-state；#5 收拢到本模块单点维护）----
      get themeId() { return scope.themeId.value; },
      get deviceTheme() { return { ...scope.deviceTheme.value }; },
      get viewIntent() { return scope.viewIntent.value; },
      get deviceView() { return { ...scope.deviceView.value }; },
      get mode() { return intent.mode.value; },
      get packageId() { return scope.packageId.value; },
      get activeDevice() { return scope.activeDevice.value; },
      get activePage() { return scope.activePage.value; },
      get activeView() { return scope.activeView.value; },
      get activeThemeId() { return scope.themeRecordFor().meta.id; },
      get activeTone() { return scope.themeRecordFor().tone; },
      // ---- #5 新增：链路显影（地址栏原始值 → store 意图 → 生效结果）----
      /** 地址栏主题参数原始值（store 同源：路由 query，非 location.search 字符串） */
      get url(): ThemeUrlParams { return parseThemeParams(currentQuery()); },
      /** 当前设备生效版式的「输入 + 判定」（legal = null 表示无 URL 值或页未注册） */
      get effectiveView() { return effectiveViewInfo(); },
      /** 当前存在的问题（每次刷新重算） */
      get warnings() { return current; }
    };
    // 右下角角标：调试期一眼看到 设备/页/版式/包 + 警告计数（红 = 当前有问题）
    badge = document.createElement('div');
    badge.dataset.themeDebugBadge = '';
    badge.title = '主题调试角标（dev + ?debug=theme）—— 点击打印 window.__MAUTH_STORE__';
    Object.assign(badge.style, {
      position: 'fixed',
      right: '8px',
      bottom: '8px',
      zIndex: '2147483647',
      padding: '2px 8px',
      borderRadius: '4px',
      background: 'rgba(17, 24, 39, 0.82)',
      color: '#34d399',
      font: '11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'pre'
    } satisfies Partial<CSSStyleDeclaration>);
    badge.addEventListener('click', () => {
      console.log('%c[theme] __MAUTH_STORE__ snapshot', 'color:#34d399', snapshot());
    });
    document.body.appendChild(badge);
    console.info(
      '[theme] 调试句柄已挂载：window.__MAUTH_STORE__（含 url / effectiveView / warnings）' +
        ' + 右下角角标。URL 主题参数说明见 README「URL 参数手册」。'
    );
  }

  function snapshot(): Record<string, unknown> {
    const w = window as unknown as Record<string, unknown>;
    return (w.__MAUTH_STORE__ ?? {}) as Record<string, unknown>;
  }

  function updateBadge(): void {
    if (!badge) return;
    const warn = current.length > 0 ? ` ⚠${current.length}` : '';
    badge.textContent =
      `theme-debug ▸ device=${scope.activeDevice.value} page=${scope.activePage.value} ` +
      `view=${scope.activeView.value} pkg=${scope.packageId.value}${warn}`;
    badge.style.color = current.length > 0 ? '#f87171' : '#34d399';
  }

  function refresh(): void {
    const problems = collectWarnings(parseThemeParams(currentQuery()), auditContext());
    current = problems;
    for (const problem of problems) {
      if (warned.has(problem)) continue;
      warned.add(problem);
      console.warn(`[theme] ${problem}`);
    }
    if (debugGateOn() && !probeMounted) mountProbe();
    if (badge) updateBadge();
  }

  // store 六值变化即刷（响应式）；URL 变化走 currentQuery 深 watch（与编排层意图同步同源）
  const stopStore = watch(
    () => [
      scope.activeDevice.value,
      scope.activePage.value,
      scope.packageId.value,
      scope.activeView.value,
      scope.themeId.value,
      intent.mode.value
    ],
    refresh
  );
  const stopQuery = watch(() => currentQuery(), refresh, { deep: true });
  refresh(); // 装载时 URL 就带着错值的场景：立即判，不等第一次变化

  return () => {
    stopStore();
    stopQuery();
    badge?.remove();
    badge = null;
    probeMounted = false;
    delete (window as unknown as Record<string, unknown>).__MAUTH_STORE__;
  };
}
