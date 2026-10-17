/**
 * 后端主题配置取数（**参数化内核版**）—— 拉取后端下发的主题配置并归一形状
 *
 * === 为什么取数也能下沉 ===
 * 「fetch + 超时 + 失败静默 + 归一形状」这个骨架是通用的；只有「端点 / 超时上限 /
 * cookie 策略」是宿主的部署事实。所以把它们参数化，内核提供取数骨架，宿主编好参数即可。
 *
 * === 形状归一见 `skinsuite` 的 `normalizeRemoteThemeConfig` ===
 * 「哪些字段算数、`skin` 是不是旧名字、tokens 为什么必须扁平」是契约，已收进纯内核；
 * 这里只负责「怎么拿到 JSON 再交给它归一」。
 *
 * === 失败策略 ===
 * 超时 / 非 200 / 结构不符 一律静默返回 null（用内置配色继续）。主题是锦上添花，
 * 绝不能因为拉不到配色而挡住登录。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/remote.ts 下沉）
 */
import { normalizeRemoteThemeConfig } from '../remote-config';
import type { RemoteThemeConfig } from '../remote-config';

export interface RemoteThemeFetchOptions {
  /** 端点 URL（宿主 `VITE_THEME_ENDPOINT`）；空串 = 机制关闭，直接返回 null */
  endpoint: string;
  /** 超时上限（毫秒） */
  timeoutMs?: number;
  /** 是否不带 cookie（默认 true，避免把登录态发到第三方域名） */
  omitCredentials?: boolean;
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

  const controller = new AbortController();
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
    // 网络错误 / 超时 / JSON 解析失败：一律静默
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
