/**
 * 父应用主题同步（iframe 嵌入场景）
 *
 * 父应用（posecraft / firewall）切主题时，通过 `postMessage` 通知子应用
 * （被嵌在 iframe 里的登录页）同步切换，解决 iframe 隔离导致的父子主题不同步。
 *
 * === 消息协议 ===
 * ```
 * { type: 'THEME_CHANGE', isDark: boolean }                        // 旧版：只同步明暗
 * { type: 'THEME_CHANGE', isDark?, theme?, tokens? }               // 新版：可同时换主题
 * ```
 * `theme` 是配色 id。
 * `tokens` 是一组**扁平**的 CSS 变量覆写表，实现「父应用给子页面定制每个组件」。
 * 旧的 `{ light, dark }` 两档结构不再接受 —— 配色自带完整底色，明暗档已取消。
 *
 * ⚠️ `tokens` 的每一项都会过白名单校验（token 名 + 取值形态），不合规的丢弃并告警。
 *    父页面虽然是受信来源，但 postMessage 的载荷在浏览器里终究是外部输入，
 *    未校验就写进 CSS 变量等于开了 CSS 注入的口子（`url()` 一律被拒）。
 *    校验发生在宿主的 store / runtime 层，本模块只做**协议解析与分发**。
 *
 * === 为什么 origin 白名单是宿主的参数 ===
 * 「哪些父应用可信」是部署事实（域名、端口、是否 https），库无从知道。
 * 所以这里只调用宿主给的 `isAllowedOrigin`；库负责的是「什么时候问、问什么」。
 *
 * @example
 * ```ts
 * useParentThemeSync({
 *   isAllowedOrigin: isAllowedParentOrigin,
 *   apply: config => themeStore.applyThemeConfig(config),
 *   applyDark: dark => themeStore.applyTheme(dark)
 * });
 * ```
 *
 * @author yijiu2025
 * @since 2026-08-30
 */
import type { RemoteThemeConfig } from '../../scheme';

/** 宿主适配器 */
export interface ParentThemeSyncOptions {
  /** 该 origin 是否可信（宿主维护白名单） */
  isAllowedOrigin(origin: string): boolean;
  /** 收到配色 / tokens 变更 */
  apply(config: RemoteThemeConfig): void;
  /**
   * 收到明暗变更（旧协议兼容）
   *
   * 不传则忽略旧协议的 `isDark` 字段 —— 宿主若已把明暗纳入 `apply({mode})`，
   * 可以只实现一个入口。
   */
  applyDark?(dark: boolean): void;
}

/**
 * 监听父应用的主题同步消息（**立即注册**，返回 cleanup）
 *
 * 仅在 iframe 嵌入时生效（`handleMessage` 内判断顶层窗口无父则忽略）。
 * 不依赖组件生命周期（`onMounted`/`onUnmounted`）：来源同步已归主题运行时
 * （宿主 store 的 runtime），那里没有组件实例，改用「立即 addEventListener +
 * 返回 cleanup」，由宿主在 store 的 dispose 里调 cleanup。
 */
export function useParentThemeSync(options: ParentThemeSyncOptions): () => void {
  function handleMessage(event: MessageEvent): void {
    // 顶层窗口无父，忽略（非 iframe 场景）
    if (!(window.parent && window.parent !== window)) return;

    // origin 校验：只接受白名单父应用的消息（防恶意嵌入伪造主题切换）
    if (!options.isAllowedOrigin(event.origin)) return;

    const { type, isDark, theme, tokens } = (event.data ?? {}) as {
      type?: unknown;
      isDark?: unknown;
      theme?: unknown;
      tokens?: unknown;
    };
    if (type !== 'THEME_CHANGE') return;

    // 明暗：新旧协议都支持
    if (typeof isDark === 'boolean' && options.applyDark) {
      options.applyDark(isDark);
    }

    // 主题与组件级覆写（新协议）
    const wanted = typeof theme === 'string' ? theme : undefined;
    if (wanted !== undefined || (tokens && typeof tokens === 'object')) {
      options.apply({
        theme: wanted,
        tokens:
          tokens && typeof tokens === 'object'
            ? (tokens as RemoteThemeConfig['tokens'])
            : undefined
      });
    }
  }

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}
