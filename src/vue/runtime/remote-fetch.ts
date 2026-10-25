/**
 * 后端主题配置取数 —— fetch + 超时 + 失败静默 + 归一形状的骨架
 *
 * 只有端点 / 超时上限 / cookie 策略是宿主的部署事实，参数化进来；
 * 形状归一在内核 normalizeRemoteThemeConfig（哪些字段算数是契约）。
 * 超时 / 非 200 / 结构不符一律静默返回 null：主题是锦上添花，绝不能挡住登录。
 */
import { normalizeRemoteThemeConfig } from '../../scheme';
import type { RemoteThemeConfig } from '../../scheme';

export interface RemoteThemeFetchOptions {
  /** 端点 URL（宿主 `VITE_THEME_ENDPOINT`）；空串 = 机制关闭，直接返回 null */
  endpoint: string;
  /** 超时上限（毫秒） */
  timeoutMs?: number;
  /** 是否不带 cookie（默认 true，避免把登录态发到第三方域名） */
  omitCredentials?: boolean;
  /**
   * 外部取消信号（store 被 dispose 时中止在途请求）。
   * 与内部超时合并：任一触发即中止 —— fetch 只认一个 signal，这里桥接。
   */
  signal?: AbortSignal;
}

/** 后端换配色是否启用（端点非空） */
export function isRemoteThemeEnabled(endpoint: string | undefined): boolean {
  return typeof endpoint === 'string' && endpoint.trim().length > 0;
}

/**
 * 拉取后端主题配置
 *
 * @param clientId 接入应用的 client_id（决定用哪套品牌配色），可为空
 * @param options  见 `RemoteThemeFetchOptions`
 * @returns 配置对象；未启用 / 失败 / 无有效内容时返回 null
 */
export async function fetchRemoteThemeConfig(
  clientId: string | undefined,
  options: RemoteThemeFetchOptions
): Promise<RemoteThemeConfig | null> {
  const endpoint = options.endpoint;
  if (!isRemoteThemeEnabled(endpoint)) return null;

  let url: URL;
  try {
    url = new URL(endpoint, window.location.origin);
  } catch {
    return null; // endpoint 写了个非法 URL
  }
  if (clientId) url.searchParams.set('client_id', clientId);

  // 超时与外部 signal 桥接到同一个 controller（fetch 只认一个 signal）
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 3000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      credentials: options.omitCredentials === false ? 'include' : 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return normalizeRemoteThemeConfig(await res.json());
  } catch {
    // 网络错误 / 超时 / 外部中止 / JSON 解析失败：一律静默
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
