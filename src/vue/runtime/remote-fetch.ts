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
  /**
   * 附到请求 URL 的身份参数（client_id / user_id / 接入应用标识等）。
   * 键名与取值全由调用方决定 —— 库不预设任何业务词汇、不读任何来源；
   * 值为空串 / undefined 的项不发送。
   */
  params?: Record<string, string | undefined>;
}

/** 后端换配色是否启用（端点非空） */
export function isRemoteThemeEnabled(endpoint: string | undefined): boolean {
  return typeof endpoint === 'string' && endpoint.trim().length > 0;
}

/**
 * 拉取后端主题配置
 *
 * @param options 见 `RemoteThemeFetchOptions`
 * @returns 配置对象；未启用 / 失败 / 无有效内容时返回 null
 */
export async function fetchRemoteThemeConfig(
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
  // 只放行 http/https：阻止 javascript:/data:/file: 等危险协议被当「取数端点」执行。
  // （endpoint 来自宿主构建期 env，半可信，但纵深防御不贵——一行拦截危险协议面。）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (typeof value === 'string' && value !== '') url.searchParams.set(key, value);
  }

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
