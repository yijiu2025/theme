/// <reference path="../env.d.ts" />
/**
 * 主题意图来源同步 —— 拉后端配色 + 父应用主题同步（都读 env，宿主零传参）
 *
 * 后端下发与父应用 postMessage 都是主题意图来源（与 URL / 用户操作 / localStorage
 * 同类），由主题运行时（useThemeRuntime）调用本 composable 接入，落地动作
 * （applyThemeConfig / applyTheme）由调用方注入 —— 库不 import 宿主 store。
 *
 * 读 env：端点（VITE_THEME_ENDPOINT）与父 origin 白名单
 * （VITE_ALLOWED_PARENT_ORIGINS）都是部署事实，宿主配好 env 即生效。
 *
 * 不依赖组件生命周期：store 里没有组件实例，onMounted 会静默失效 —— 所以
 * 「立即注册 + 立即拉取」，返回 cleanup 由 dispose 调用。
 */
import { useParentThemeSync } from './useParentThemeSync';
import { fetchRemoteThemeConfig, isRemoteThemeEnabled } from '../runtime/remote-fetch';
import type { RemoteThemeConfig } from '../../scheme';

export interface ThemeSourcesOptions {
  /** 把外部配置落到宿主 store（含 null = 撤销外部覆写） */
  applyThemeConfig(config: RemoteThemeConfig | null): void;
  /** 把明暗落到宿主 store（父应用旧协议 `isDark`） */
  applyTheme(dark: boolean): void;
  /**
   * 拉远程主题配置时附带的身份参数（client_id / user_id / 接入应用标识等）。
   * provider 形态：发请求前才取值，宿主可从 URL / store / 任意来源计算；
   * 键名与取值全由宿主决定 —— 库不预设业务词汇、不读任何来源。缺省不带参数。
   */
  remoteParams?(): Record<string, string | undefined>;
}

/** 从 env 读父 origin 白名单（逗号分隔）；空 = 无父同步 */
function allowedParentOrigins(): string[] {
  const raw = import.meta.env.VITE_ALLOWED_PARENT_ORIGINS as string | undefined;
  return typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
}

/** 从 env 读后端配色端点；空 = 不拉远程 */
function remoteEndpoint(): string {
  return (import.meta.env.VITE_THEME_ENDPOINT as string | undefined) ?? '';
}

/**
 * 接入两条主题意图来源（父同步 + 后端配色），返回 cleanup
 *
 * 宿主 `useThemeRuntime` 里调一次：`const disposeSources = useThemeSources({ applyThemeConfig, applyTheme })`，
 * 并在 store 的 dispose 里调 cleanup。
 *
 * cleanup 做两件事：摘 postMessage 监听 + **中止在途的后端拉取** —— store 被
 * dispose 后，迟到的响应不许再写已废弃的状态（fetch 走 AbortSignal，
 * 「已 resolve 但尚未 apply」的竞态用 disposed 标志兜住）。
 */
export function useThemeSources(options: ThemeSourcesOptions): () => void {
  const cleanups: Array<() => void> = [];
  const abortFetch = new AbortController();
  let disposed = false;

  // 父主题同步（iframe 嵌入时父切主题子跟着切）
  const allowed = allowedParentOrigins();
  if (allowed.length > 0) {
    cleanups.push(
      useParentThemeSync({
        isAllowedOrigin: origin => allowed.includes(origin),
        apply: config => options.applyThemeConfig(config),
        applyDark: dark => options.applyTheme(dark)
      })
    );
  }

  // 拉后端配色（异步发起，失败静默，不阻塞首屏；dispose 时中止）。
  // 身份参数由宿主经 remoteParams 注入（库不读 URL、不预设键名）。
  const endpoint = remoteEndpoint();
  if (isRemoteThemeEnabled(endpoint)) {
    void (async () => {
      const config = await fetchRemoteThemeConfig({
        endpoint,
        params: options.remoteParams?.(),
        signal: abortFetch.signal
      });
      // disposed 标志兜住「fetch 已完成、apply 尚未执行」的窗口期竞态
      if (config && !disposed) options.applyThemeConfig(config);
    })();
  }

  return () => {
    disposed = true;
    abortFetch.abort();
    cleanups.forEach(fn => fn());
  };
}
