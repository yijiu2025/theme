/**
 * 主题意图（intent）—— 明暗意图 + 会话级记忆槽 + 「明暗 ≡ 配色系别」联动
 *
 * 从 `oauth21/src/stores/theme-intent.ts` 下沉（2026-10-19）。本文件只负责「用户**想**要什么明暗」：
 *   · `mode` 三态意图（light / dark / system）；
 *   · 白系 / 黑系两侧的会话级记忆槽（只记「切走前正在用的那套」，不持久化）；
 *   · `syncColorToTone` —— 从意图推导并切到匹配系别的配色（联动）；
 *   · 用户显式操作：`setTheme` / `setMode` / `cycleMode` / `toggleTheme`。
 *
 * === 依赖方向 ===
 *   intent 只依赖 scope（activeDevice/activePage/activeView/themeId + 清 URL 覆盖），
 *   不依赖 runtime —— 它不碰 token 注入、不碰 DOM。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 oauth21/src/stores/theme-intent.ts 下沉，keys 参数化）
 */
import { ref, watch } from 'vue';
import { DEFAULT_THEME_COLOR, DEFAULT_THEME_DARK_COLOR } from '../constants';
import { MODE_CYCLE } from '../scheme';
import type { ThemeMode, ThemeTone } from '../scheme';
import { isKnownTheme, listColorIdsOfTone, resolveThemeId, toneOfAnyScope } from '../registry';
import { readInitialMode, safeSet } from './theme-persistence';
import type { ThemeStorageKeys } from './theme-persistence';
import type { ThemeScope } from './theme-scope';

export function useThemeIntent(scope: ThemeScope, keys: ThemeStorageKeys) {
  const mode = ref<ThemeMode>(readInitialMode(keys));

  /** 系统偏好（始终跟踪，是否采用由 mode 决定） */
  const systemDark = ref(false);
  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  if (mediaQuery) systemDark.value = mediaQuery.matches;

  const onSystemChange = (e: MediaQueryListEvent) => {
    systemDark.value = e.matches;
  };
  mediaQuery?.addEventListener('change', onSystemChange);

  /**
   * 白系 / 黑系两侧的会话级记忆槽：只记「切走前正在用的那套」，不持久化。
   * 点色卡不写槽；只有「明暗切换」这个动作才写。
   */
  const lightColor = ref<string | null>(null);
  const darkColor = ref<string | null>(null);

  /**
   * 把配色切到与目标明暗匹配的系别（**明暗 → 配色**，单向）。
   * 三种情况什么都不做（都刻意）：同系别 / 该版式没有目标系别（绝不跨系别回落）/
   * 目标与当前相同。槽只记「切走前」的会话级值，不落盘。
   */
  function syncColorToTone(dark: boolean): void {
    const target: ThemeTone = dark ? 'dark' : 'light';
    const device = scope.activeDevice.value;
    const page = scope.activePage.value;
    // view ≡ pkg：activeView 的值就是当前包名，配色查找按它（= 包）过滤
    const pkg = scope.activeView.value;

    // ① 已经同系别 —— 按**任意登记处**查系别，不只看当前作用域。
    if (toneOfAnyScope(scope.themeId.value) === target) return;

    // 记住「切走前」当前系别正在用的那套（切回时恢复它）。只有明暗切换才写槽。
    const curTone = toneOfAnyScope(scope.themeId.value);
    if (curTone === 'light') lightColor.value = scope.themeId.value;
    else if (curTone === 'dark') darkColor.value = scope.themeId.value;

    // 优先取该系别槽里那套；它在当前包下不存在时弃用
    const slot = dark ? darkColor.value : lightColor.value;
    const fromSlot = slot && isKnownTheme(slot, device, page, pkg) ? slot : null;
    // 目标系别配色：优先标配白/黑，没有时退回该系别第一套。
    const standard = target === 'dark' ? DEFAULT_THEME_DARK_COLOR : DEFAULT_THEME_COLOR;
    const ids = listColorIdsOfTone(device, page, pkg, target);
    const next = fromSlot ?? (ids.includes(standard) ? standard : ids[0]) ?? null;

    // ② / ③
    if (!next || next === scope.themeId.value) return;

    scope.themeId.value = next;
  }

  /**
   * 首屏对齐：按当前「系别意图」把配色校正到匹配的系别。
   * 该设备被判 URL 锁定时不干预（部署方/用户的明确意图必须压过联动）。
   */
  if (!scope.urlLockedThemeOf(scope.activeDevice.value)) {
    syncColorToTone(mode.value === 'system' ? systemDark.value : mode.value === 'dark');
  }

  /** 明暗意图变化 → 联动切配色（唯一运行时入口）；首屏那一次已由上面的显式调用处理 */
  watch(mode, m => syncColorToTone(m === 'system' ? systemDark.value : m === 'dark'));
  watch(systemDark, dark => {
    if (mode.value === 'system') syncColorToTone(dark);
  });

  /**
   * 设置明暗意图（底层写入口，**不清** URL 覆盖）。
   * 用户的显式操作请走 cycleMode / toggleTheme —— 它们会先清掉当前设备的覆盖。
   */
  function setMode(next: ThemeMode): void {
    mode.value = next;
    safeSet(keys.mode, next);
  }

  /** 循环切换明暗意图（跟随系统 → 明 → 暗 → 跟随系统）；显式操作 → 先清 URL 覆盖 */
  function cycleMode(): void {
    scope.clearDeviceThemeOverride();
    const idx = MODE_CYCLE.indexOf(mode.value);
    setMode(MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]);
  }

  /** 在明/暗之间切换（= 白系 ↔ 黑系）；纯反色，不进 'system' */
  function toggleTheme(): void {
    scope.clearDeviceThemeOverride();
    setMode(scope.isDark.value ? 'light' : 'dark');
  }

  /**
   * 设置配色（开发者/部署方调用 → 落盘）。
   * 会清掉当前设备的 URL 覆盖（点色卡是显式操作，必须能压过部署方链接）。
   * 点色卡同步把 mode 设成该配色的系别，并打断「切走前」记忆链（清空对侧槽）。
   */
  function setTheme(id: string): boolean {
    const resolved = resolveThemeId(id);
    if (!resolved) return false;
    scope.clearDeviceThemeOverride();
    scope.themeId.value = resolved;
    safeSet(keys.theme, resolved);
    const tone = toneOfAnyScope(resolved);
    if (tone === 'dark') lightColor.value = null;
    else if (tone === 'light') darkColor.value = null;
    if (tone) {
      const next: ThemeMode = tone === 'dark' ? 'dark' : 'light';
      if (mode.value !== next) {
        mode.value = next;
        safeSet(keys.mode, next);
      }
    }
    return true;
  }

  /** 应用外部明暗（父应用旧协议兼容） */
  function applyTheme(dark: boolean): void {
    setMode(dark ? 'dark' : 'light');
  }

  /** 清理系统主题监听（HMR / 单测场景） */
  function dispose(): void {
    mediaQuery?.removeEventListener('change', onSystemChange);
  }

  return { mode, systemDark, lightColor, darkColor, setMode, cycleMode, toggleTheme, setTheme, applyTheme, dispose };
}

/** intent 的公开面（供 runtime / store 引用；类型由 `useThemeIntent` 返回处推断） */
export type ThemeIntent = ReturnType<typeof useThemeIntent>;
