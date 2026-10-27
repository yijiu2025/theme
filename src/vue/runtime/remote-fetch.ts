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
 * 私有 / 回环 IPv4 网段判断（点分十进制的四个字节；私有网段只由前两字节决定，后两字节保留作语义完整）
 */
function isPrivateIpv4(a: number, b: number, _c: number, _d: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * 判断主机名是否落在私有 / 回环 / 链路本地网段（SSRF 纵深防御）。
 *
 * 覆盖（字符串层能可靠判断的全部形态）：
 *   · IPv4 点分十进制（0/10/127/169.254/172.16-31/192.168）
 *   · IPv6 回环/唯一本地/链路本地（::/::1/展开回环/fc00::/7/fe80::/10）
 *   · localhost 家族
 *   · DNS rebinding 服务后缀（nip.io/xip.io/sslip.io/lvh.me/localtest.me —— 把内网 IP
 *     映射成公网域名再解析回内网，字符串上非私有、真实连接目标私有）
 *   · IPv4-mapped IPv6（::ffff:127.0.0.1 → 剥出内嵌 IPv4 重判）
 *   · 整数 / 十六进制 IP 字面量（2130706433 / 0x7f000001 → 归一成点分重判）
 *
 * 浏览器环境拿不到 DNS 解析结果，攻击者自建域名的 DNS rebinding 无法在字符串层识别；
 * 那是「只允许与页面同源」才能根除的残余面，此处做到字符串层最严。
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // 去 IPv6 方括号
  if (h === 'localhost' || h === 'localhost.localdomain' || h.endsWith('.localhost')) return true;

  // DNS rebinding 服务后缀
  if (/\.(nip\.io|xip\.io|sslip\.io|lvh\.me|localtest\.me)$/.test(h)) return true;

  // IPv4-mapped IPv6：::ffff:a.b.c.d 会被 URL 解析器归一成 ::ffff:XXXX:YYYY（十六进制），
  //    两种形态都要剥出内嵌 IPv4 重判（XXXX = a*256+b，YYYY = c*256+d）。
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return isPrivateIpv4((hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff);
  }
  const mappedDotted = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (mappedDotted) return isPrivateIpv4(+mappedDotted[1], +mappedDotted[2], +mappedDotted[3], +mappedDotted[4]);

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) return isPrivateIpv4(+ipv4[1], +ipv4[2], +ipv4[3], +ipv4[4]);

  // 整数（2130706433 = 127.0.0.1）/ 十六进制（0x7f000001）IP 字面量：归一成点分重判
  const intIp = /^0x([0-9a-f]+)$/.exec(h) ?? /^(\d+)$/.exec(h);
  if (intIp) {
    const n = h.startsWith('0x') ? parseInt(intIp[1], 16) : Number(intIp[1]);
    if (Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) {
      return isPrivateIpv4((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    }
  }

  if (h === '::' || h === '::1') return true;
  if (/^0(?::0){6}:1$/.test(h)) return true; // IPv6 回环展开形式 0:0:0:0:0:0:0:1
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
  // 跨源才做主机校验：相对路径（`/api/theme`）与同源 `//host` resolve 到宿主自身 origin，
  // 属同源安全；跨源才默认拒绝私有/回环网段（防 SSRF）。
  // 🔴 不能用「原始 endpoint 带不带 scheme」判绝对 —— `//169.254.169.254/...` 不带 scheme
  //    却解析成跨源 host，用 scheme 正则判会漏判整段跳过校验。以**解析后** url.hostname
  //    是否等于页面 hostname 为准。
  const isCrossOrigin = url.hostname.toLowerCase() !== window.location.hostname.toLowerCase();
  if (isCrossOrigin && !options.allowPrivateHosts && isPrivateHost(url.hostname)) {
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
      headers: { Accept: 'application/json' },
      // 🔴 拒绝重定向：初始 host 通过白名单后 `302 → http://169.254.169.254`，浏览器 fetch
      //    默认自动跟随并发请求（盲 SSRF），主机校验只在初始 URL 做过一次。redirect:'error'
      //    遇重定向即 reject（进 catch 静默 null）——主题配置端点通常不需要重定向。
      redirect: 'error'
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
