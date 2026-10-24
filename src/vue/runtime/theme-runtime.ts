/**
 * 主题运行时（runtime）—— token 注入 + 附加样式 + 明暗类 + 外部配置
 *
 * 从 `oauth21/src/stores/theme-runtime.ts` 下沉（2026-10-19）。本文件只负责「把生效配色**作用到 DOM/副作用**」：
 *   · token 分层注入（`applyThemeLayers` → html inline 变量）+ `html.dark` 类；
 *   · 附加样式 `theme.scss` 的惰性加载（带 epoch 防串台）；
 *   · `data-mauth-theme` 属性写入；
 *   · 切版式自动重置配色；
 *   · 外部配置（后端 / 父应用）合入。
 *
 * === 依赖方向 ===
 *   runtime 依赖 scope（themeRecordFor / activeDevice / isDark / themeId / deviceTheme）
 *   和 intent（mode 的写入口），不反向 —— 它是编排链的最末端。
 *
 * === 🔴 TDZ 顺序（拆分后仍必须严格保持）===
 *   `styleEpoch` 与 `loadThemeStyle` 必须声明在 `watch([themeId…], {immediate})` **之前**：
 *   immediate watcher 会在 `watch()` 当场同步跑一遍 loadThemeStyle，若 `let styleEpoch`
 *   还未求值就踩 TDZ，抛出的 ReferenceError 被 async 转成 rejected promise 又 `void` 丢掉，
 *   现象是「只有首屏那次附加样式加载不到，之后手动切主题都正常」—— 极难从表象定位。
 *
 * @author yijiu2025
 * @since 2026-10-19（从 oauth21/src/stores/theme-runtime.ts 下沉，签名不变）
 */
import { ref, watch } from 'vue';
import { getDefaultThemeId, getThemeRecord, resolveThemeId, toneOfAnyScope } from '../../registry';
import type { ThemeTokenOverrides } from '../../tokens';
import { applyThemeLayers } from './token-runtime';
import { useThemeSources } from '../composables/useThemeSources';
import type { ThemeScope } from '../store/theme-scope';
import type { ThemeIntent } from '../store/theme-intent';

/** 承载主题附加样式（theme.scss）的 <style> 元素 id，切换主题时整体替换 */
const STYLE_ELEMENT_ID = 'mauth-theme-css';

export function useThemeRuntime(scope: ThemeScope, intent: ThemeIntent) {
  /** 主题包自带 token（按当前生效作用域解析；一组扁平值，不分明暗档） */
  const themeTokens = ref<ThemeTokenOverrides | null>(scope.themeRecordFor().tokens ?? null);
  /** 外部覆写 token（后端下发 / 父应用 postMessage）；优先级高于主题包 */
  const externalTokens = ref<ThemeTokenOverrides | null>(null);

  /**
   * 统一注入入口：配色 token、外部覆写、生效范围任一变化都重算。
   * 注入的是 html 上的 inline style（整份文档唯一），所以只用一个设备的 token（activeDevice）。
   * isDark 只负责给 <html> 挂/摘 dark 类（基线 SCSS 用），与注入挂在同一个 watch。
   */
  const stopInject = watch(
    [themeTokens, externalTokens, scope.activeDevice, scope.isDark],
    ([, , , dark]) => {
      document.documentElement.classList.toggle('dark', dark);
      const rejected = applyThemeLayers({
        theme: themeTokens.value,
        external: externalTokens.value
      });
      if (rejected.length > 0) {
        console.warn(`[theme] 忽略了 ${rejected.length} 条不合规的主题变量：${rejected.join('、')}`);
      }
    },
    { immediate: true }
  );

  /**
   * 加载主题附加样式（theme.scss，惰性动态 import），带递增 epoch 防串台。
   * 失败静默：附加样式拿不到只是少个背景图，绝不能挡住登录。
   */
  let styleEpoch = 0;
  async function loadThemeStyle(id: string, pkg: string, device: string, page: string): Promise<void> {
    const epoch = ++styleEpoch;
    const loader = getThemeRecord({ id, device, pkg, page }).loadStyle;

    if (!loader) {
      document.getElementById(STYLE_ELEMENT_ID)?.remove();
      return;
    }
    try {
      const css = await loader();
      if (epoch !== styleEpoch) return; // 期间又切了主题，丢弃本次结果
      let node = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
      if (!node) {
        node = document.createElement('style');
        node.id = STYLE_ELEMENT_ID;
        document.head.appendChild(node);
      }
      node.textContent = css;
    } catch {
      /* 主题附加样式加载失败不影响登录 */
    }
  }

  /**
   * 承载配色标识 + 同步 token / 附加样式。
   * 生效 id 按设备取 URL 覆盖（与 themeRecordFor 同口径）。
   * 仅当"该设备没有这套配色、用了回落档"（record.meta.id !== id）时才 delete 属性。
   */
  const stopRecord = watch(
    [scope.themeId, scope.deviceTheme, scope.activeDevice, scope.activePage, scope.activeView],
    ([, , device, page, view]) => {
      const id = scope.deviceTheme.value[device] ?? scope.themeId.value;
      // view ≡ pkg —— 用 activeView 充当 pkg
      const record = getThemeRecord({ id, device, pkg: view, page });
      const root = document.documentElement;
      if (record.meta.id === id) root.dataset.mauthTheme = id;
      else delete root.dataset.mauthTheme;

      themeTokens.value = record.tokens ?? null;
      void loadThemeStyle(id, view, device, page);
    },
    { immediate: true }
  );

  /**
   * 切版式 → 自动重置配色（让用户立刻感受到新版的视觉特征）。
   * 守门：仅新版式触发、仅 activeView 真的变了、该设备被 URL 锁定时不动、不落盘、不动 mode/槽。
   */
  const stopViewReset = watch(scope.activeView, (newView, oldView) => {
    if (!newView || newView === oldView) return;
    // 用旧 view（= 旧包）查 themeId 当前解析到的包
    const currentPkg = scope.themeRecordFor(oldView, scope.activeDevice.value, scope.activePage.value).pkg;
    if (currentPkg === newView) return;
    if (scope.urlLockedThemeOf(scope.activeDevice.value)) return;
    const fallback = getDefaultThemeId({ device: scope.activeDevice.value, page: scope.activePage.value, pkg: newView });
    if (!fallback || fallback === scope.themeId.value) return;
    scope.themeId.value = fallback;
  });

  /** 应用外部配色配置（后端下发 / 父应用同步）；不写 localStorage（后端默认值不覆盖用户偏好） */
  function applyThemeConfig(config: {
    theme?: string;
    mode?: 'light' | 'dark' | 'system';
    tokens?: ThemeTokenOverrides;
  } | null): void {
    if (!config) {
      externalTokens.value = null;
      return;
    }

    const wanted = config.theme;
    if (wanted !== undefined && !scope.urlLockedThemeOf(scope.activeDevice.value)) {
      const resolved = resolveThemeId(wanted);
      if (resolved) {
        scope.themeId.value = resolved;
        const tone = toneOfAnyScope(resolved);
        if (tone) {
          const next = tone === 'dark' ? 'dark' : 'light';
          if (intent.mode.value !== next) intent.mode.value = next;
        }
      }
    }
    if (config.mode) intent.mode.value = config.mode;
    if (config.tokens) externalTokens.value = config.tokens;
  }

  // 主题意图来源同步：父主题同步 + 拉后端配色（读 env，宿主零传参）
  const disposeSources = useThemeSources({
    applyThemeConfig,
    applyTheme: dark => intent.applyTheme(dark)
  });

  /**
   * 清理本层全部副作用（HMR / 单测反复建 store 场景）：3 个 watcher + 来源同步
   * （postMessage 监听、进行中的远程 fetch）。watch 的 stop 句柄收全，
   * dispose 半途而废比没有 dispose 更误导排查。
   */
  function dispose(): void {
    stopInject();
    stopRecord();
    stopViewReset();
    disposeSources();
  }

  return { themeTokens, externalTokens, applyThemeConfig, dispose };
}

/** runtime 的公开面（类型由 `useThemeRuntime` 返回处推断） */
export type ThemeRuntime = ReturnType<typeof useThemeRuntime>;
