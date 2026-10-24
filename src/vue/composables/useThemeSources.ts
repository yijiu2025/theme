/**
 * 主题意图**来源同步** —— 拉后端配色 + 父应用主题同步（都读 env，宿主零传参）
 *
 * === 为什么归这里（而非 ThemeRoot）===
 * 后端下发与父应用 postMessage 都是**主题意图来源**（与 URL / 用户操作 / localStorage
 * 同类，见 6.2 来源优先级），不是「外观外壳」的职责。ThemeRoot 退化为纯外观壳后，
 * 这两条「来源」由主题运行时（宿主的 `useThemeRuntime`）调用本 composable 接入，
 * 落地动作（`applyThemeConfig` / `applyTheme`）由宿主 store 注入 —— 库不 import 宿主 store。
 *
 * === 为什么读 env ===
 * 端点（`VITE_THEME_ENDPOINT`）与父 origin 白名单（`VITE_ALLOWED_PARENT_ORIGINS`）都是
 * 主题域的部署事实，库直接读这两个约定好的 env 变量 —— 宿主配好 env 即生效，不再传参。
 *
 * === 为什么不依赖组件生命周期 ===
 * 主题运行时（store）没有组件实例，`onMounted`/`onUnmounted` 在那里会失效（静默 bug）。
 * 所以这里「立即注册父同步 + 立即发起后端拉取」，返回 cleanup，由宿主在 store 的
 * dispose 里调用 cleanup（父同步 removeEventListener）。
 *
 * @author yijiu2025
 * @since 2026-10-18
 */
import { useParentThemeSync } from './useParentThemeSync';
import { fetchRemoteThemeConfig, isRemoteThemeEnabled } from '../runtime/remote-fetch';
import type { RemoteThemeConfig } from '../../scheme';

export interface ThemeSourcesOptions {
  /** 把外部配置落到宿主 store（含 null = 撤销外部覆写） */
  applyThemeConfig(config: RemoteThemeConfig | null): void;
  /** 把明暗落到宿主 store（父应用旧协议 `isDark`） */
  applyTheme(dark: boolean): void;
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

  // 拉后端配色（异步发起，失败静默，不阻塞首屏；dispose 时中止）
  const endpoint = remoteEndpoint();
  if (isRemoteThemeEnabled(endpoint)) {
    void (async () => {
      const clientId = new URLSearchParams(window.location.search).get('client_id') || undefined;
      const config = await fetchRemoteThemeConfig(clientId, { endpoint, signal: abortFetch.signal });
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
