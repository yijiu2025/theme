/**
 * 父应用主题同步（iframe 嵌入场景）
 *
 * 父应用切主题时通过 postMessage 通知被嵌在 iframe 里的子应用同步切换。
 *
 * 消息协议：
 *   { type: 'THEME_CHANGE', isDark: boolean }          旧版：只同步明暗
 *   { type: 'THEME_CHANGE', isDark?, theme?, tokens? } 新版：可同时换主题
 * theme 是配色 id；tokens 是扁平 CSS 变量覆写表（旧的 { light, dark } 两档结构不接受）。
 *
 * ⚠️ tokens 的每一项都会过白名单校验：父页面虽是受信来源，postMessage 载荷终究是
 *    外部输入，未校验就写 CSS 变量等于开 CSS 注入的口子。校验在 runtime 层，
 *    本模块只做协议解析与分发。
 *
 * origin 白名单是宿主参数（哪些父应用可信是部署事实），本模块只调用 isAllowedOrigin。
 */
import { normalizeRemoteThemeConfig } from '../../scheme';
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

    // 来源校验：只接受「父窗口」发来的消息。origin 白名单挡不了「同 origin 的
    // 兄弟 iframe / 同源任意窗口」伪造 THEME_CHANGE —— 必须再锁 event.source 是父。
    if (event.source !== window.parent) return;

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
      // 🔴 归一与远程取数路径同源（normalizeRemoteThemeConfig）：跳原型链危险键 + 只收
      //    string 值 + theme 过配色 id 白名单——不裸透传 postMessage 载荷（纵深防御，避免
      //    未来某路径绕过 sanitize 直接消费 tokens 时暴露原型链污染面）。
      const normalized = normalizeRemoteThemeConfig({ theme: wanted, tokens });
      if (normalized) options.apply(normalized);
    }
  }

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}
