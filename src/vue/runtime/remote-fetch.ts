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
   * 是否放行私有 / 回环 / 链路本地主机（默认 false）。
   * 默认拒绝是为挡住 SSRF 目标（`http://169.254.169.254`、内网 IP、localhost 等）——
   * endpoint 是宿主构建期 env，属半可信，纵深防御不贵。本地开发连 localhost 后端时
   * 显式传 true。
   */
  allowPrivateHosts?: boolean;
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
 * 判断主机名是否落在私有 / 回环 / 链路本地网段（SSRF 纵深防御）。
 * 覆盖 IPv4（0/10/127/169.254/172.16-31/192.168）与 IPv6（::/::1/fc00::/7/fe80::/10）
 * 及 localhost 家族。只做「网段判断」不做「公网可达性」判断。
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // 去 IPv6 方括号
  if (h === 'localhost' || h === 'localhost.localdomain' || h.endsWith('.localhost')) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (h === '::' || h === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true; // fc00::/7 唯一本地
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true; // fe80::/10 链路本地
  return false;
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
  // 绝对 URL 的 endpoint 才做主机校验：相对路径（`/api/theme`）resolve 到宿主自身
  // origin，属同源，安全；绝对 URL 指向私有/回环网段时默认拒绝（防 SSRF）。
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(endpoint.trim());
  if (isAbsolute && !options.allowPrivateHosts && isPrivateHost(url.hostname)) {
    return null;
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (typeof value === 'string' && value !== '') url.searchParams.set(key, value);
  }

  // 超时与外部 signal 桥接到同一个 controller（fetch 只认一个 signal）
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
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
    // 成对清理：移除外部 signal 的 abort 桥接监听器，避免长寿命 signal 复用累积
    options.signal?.removeEventListener('abort', onAbort);
    window.clearTimeout(timer);
  }
}
