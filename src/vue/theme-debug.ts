/**
 * 主题调试句柄（dev-only）—— URL 参数静默失败警告 + `__MAUTH_STORE__` 探针
 *
 * === 为什么落库不落宿主（2026-10-21 定论）===
 * 第一版放在 oauth21 宿主（`src/utils/theme-debug.ts`），评审时被纠正，理由：
 *   · 判定用的知识全是**库的**：版式合法性 = `pageOf(page).views.has()`（库机制）、
 *     设备白名单 = `registeredDevices()`（库域）、参数键形由 `views/params.ts` 定义；
 *   · 被诊断的静默失败是**库的行为**：`pick()` 的 `resolve(url,…) ?? pkg` 回落、
 *     未知设备落兜底 —— 坑是库静默吞的，警告却要每个宿主各写一遍，正是
 *     「抄 N 份必然漂移」（params.ts / view-picker / registry 都因此沉过内核）；
 *   · 复用同一机制的前端（firewall / posecraft …）落库即免费获得，宿主零接线。
 * 纯判定在内核 `views/param-audit.ts`（零 import，可单测 / 可被 CI 直接调用做
 * 链接体检）；本文件只做 Vue 绑定层的接线（watch + DOM + 探针）。
 *
 * === 它做什么 ===
 *   1. **dev 无条件**（不需要 `?debug=theme`）把 URL 主题参数的静默失败喊进
 *      console：非法版式值 / 未知设备锁定 / 重复键 —— 静默失败不靠「记得开开关」防；
 *   2. `?debug=theme` 时挂 `window.__MAUTH_STORE__`（store 内部 11 个 getter
 *      **原样保留** + `url` / `effectiveView` / `warnings` 三个链路键）与右下角角标；
 *   3. 响应式刷新：watch store 六值 + `watch(currentQuery, {deep})`（与编排层的
 *      版式意图同步同源）—— 不轮询。
 *
 * === 边界（知悉即可）===
 *   · 配色合法性不检（生效配色是 URL 覆盖 + 持久化 + 用户操作的合成，见 param-audit 头注）；
 *   · 通用键 `?th` 只对**当前设备**判定（部署方常有意只保一端；原始值在快照里看得到）。
 *
 * @author yijiu2025
 * @since 2026-10-21（第二批 #5；从 oauth21 宿主下沉）
 */
import { watch } from 'vue';
import { collectWarnings, effectiveViewRaw, parseThemeParams } from '../views/param-audit';
import type { ThemeUrlParams, WarningContext } from '../views/param-audit';
import { registeredDevices } from './define-theme-device';
import { currentQuery } from './device-domain';
import type { ThemeIntent } from './theme-intent';
import type { ThemeScope } from './theme-scope';
import { pageOf } from './view-page';

/** `?debug=theme` 门控（与库探针既有口径逐字一致：读地址栏，装载即判） */
function debugGateOn(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'theme';
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
      devices: registeredDevices().map(d => ({ id: d.id, urlKey: d.urlKey })),
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
        ' + 右下角角标。URL 主题参数契约（白名单六键）见 docs/login-theme-routing.md §2.5。'
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
