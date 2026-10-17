/**
 * 外部（后端 / 父窗口）下发的主题配置 —— **只做形状归一，不碰网络**
 *
 * === 为什么归一化属于内核，取数不属于 ===
 * 「响应里哪些字段算数、`skin` 是不是 `theme` 的旧名字、tokens 为什么必须是扁平结构」
 * 这些是**契约**，与宿主用什么方式拿到 JSON 无关；而超时、重试、带不带 cookie、
 * 失败了要不要报错，是**部署方策略**，每个宿主都不一样。所以内核只收契约这一半，
 * 取数留在宿主（见 `oauth21/src/theme/remote.ts`）。
 *
 * === 为什么显式挑选字段，而不是透传 ===
 * 响应结构由后端决定，多一个字段、少一个类型都可能让下游出错。这里逐字段挑选，
 * 顺带挡住数组 / 字符串之类的意外结构。
 *
 * ⚠️ 这里**不做 id 合法性校验**（是否登记过由渲染方用 `resolveThemeId` 判断）：
 * 校验要读注册表，放在一处才不会出现两套标准。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21 的 `theme/remote.ts` 拆出）
 */
import { normalizeMode } from './mode.js';
import type { ThemeMode } from './mode.js';
import type { ThemeTokenOverrides } from './tokens.js';

/** 外部下发的主题配置 */
export interface RemoteThemeConfig {
  /** 配色 id（须已在主题目录里登记） */
  theme?: string;
  /** 明暗三态 */
  mode?: ThemeMode;
  /** @deprecated 旧字段名，等价于 `theme`；保留以兼容已上线的后端实现 */
  skin?: string;
  /**
   * 一组**扁平**的 token 覆写（`{ '--mauth-primary': '#0e7490' }`）
   *
   * ⚠️ 旧的 `{ light, dark }` 两档结构不再接受：配色自带完整底色，明暗档已于
   * 2026-09-25 取消。若这里还认它，等于让删掉的语义从后门回来。
   */
  tokens?: ThemeTokenOverrides;
}

/**
 * 把不可信的响应体归一成 `RemoteThemeConfig`
 *
 * @returns 一个有效字段都没有时返回 `null`（调用方按"没配"处理）
 */
export function normalizeRemoteThemeConfig(data: unknown): RemoteThemeConfig | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  const out: RemoteThemeConfig = {};

  if (typeof raw.theme === 'string') out.theme = raw.theme;
  else if (typeof raw.skin === 'string') out.skin = raw.skin;

  const mode = normalizeMode(raw.mode);
  if (mode) out.mode = mode;

  if (raw.tokens && typeof raw.tokens === 'object' && !Array.isArray(raw.tokens)) {
    out.tokens = raw.tokens as ThemeTokenOverrides;
  }

  return out.theme || out.skin || out.mode || out.tokens ? out : null;
}
