/**
 * token 的数据形态与白名单校验 —— 主题变量能不能写进页面的唯一判据
 *
 * 未校验的 setProperty 等于交出两个口子：值里塞 url() 触发外发请求（探测/追踪）、
 * 塞能闭合规则的文本注入任意样式。所以名字与取值都走白名单，不用黑名单。
 * 主题包自己的 theme.scss 不走这条通道 —— 那是构建期受信代码，无运行期注入问题。
 *
 * 本文件零依赖、零副作用（纯函数 + 常量），任何前端可复用。
 * tokens 是一组扁平值、不分明暗档（深浅就是两种颜色配置，各建一个目录）。
 */

/** token 名白名单：只放行 --mauth- 命名空间（避免误伤其它全局 CSS 变量）；后缀限长防超长名 DoS */
const TOKEN_NAME_RE = /^--mauth-[a-z0-9-]{1,64}$/;

/** 单条取值长度上限：超长基本是要撑爆样式表 */
const MAX_VALUE_LENGTH = 120;

/** 字体族 token 单独放宽：字体栈天然含空格、逗号、引号 */
const FONT_FAMILY_TOKEN = '--mauth-font-family';

/**
 * 允许的取值形态（白名单，命中其一即可）
 * 刻意不支持 CSS 颜色名（上百个易漏，放宽成任意字母会放行 expression 这类攻击向量）
 * 和 url()（外发请求的唯一入口 —— 背景图必须走 theme.scss）。
 */
const VALUE_PATTERNS: RegExp[] = [
  /^#[0-9a-fA-F]{3,8}$/, // #fff / #ffffff / #ffffffcc
  /^rgba?\(\s*[\d.,%\s/]+\)$/, // rgb(30 41 59) / rgba(30,41,59,0.12)
  /^hsla?\(\s*[\d.,%\s/]+(deg|rad|turn)?[\d.,%\s/]*\)$/, // hsl(210 40% 96%)
  /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|ch)$/, // 12px / 1.5rem / 100%
  /^var\(--mauth-[a-z0-9-]+\)$/, // 引用另一个主题变量
  /^(transparent|none|auto|inherit|currentcolor|initial|0)$/i // 关键字
];

/** 字体栈：字母数字、空格、逗号、连字符、下划线、引号；不含括号写不出函数 */
const FONT_VALUE_RE = /^[a-zA-Z0-9 ,'"_-]{1,120}$/;

/** 明确拒绝的危险片段（白名单之外的兜底，双保险） */
const FORBIDDEN_RE = /[;{}<>\\]|url\s*\(|expression\s*\(|\/\*|\*\/|@import/i;

/** 校验 token 名：必须是 --mauth- 前缀的小写短横线命名 */
export function isSafeTokenName(name: unknown): name is string {
  return typeof name === 'string' && TOKEN_NAME_RE.test(name);
}

/**
 * 取值公共校验核（名字无关的部分）：类型 / trim / 长度 / 危险片段。
 * 返回 trim 后的值（合法）或 null（非法）。名字相关的白名单（字体栈特例）由调用方补。
 */
function validateValueCore(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_VALUE_LENGTH) return null;
  if (FORBIDDEN_RE.test(v)) return null;
  return v;
}

/**
 * 校验 token 取值：命中白名单且不含危险片段。
 * ⚠️ 只判「值本身」，**不含字体栈特例**（`Inter, sans-serif` 会拒绝）——字体栈需要
 * 名字上下文（是不是 `--mauth-font-family`）才能判断，见 `isSafeTokenEntry`。
 */
export function isSafeTokenValue(value: unknown): value is string {
  const v = validateValueCore(value);
  return v !== null && VALUE_PATTERNS.some(re => re.test(v));
}

/**
 * 校验一条 token 键值对。单独抽出来是因为取值白名单要依赖 token 名
 * （字体族是唯一例外），只看值判不了 `Inter, sans-serif` 是否合法。
 */
export function isSafeTokenEntry(name: unknown, value: unknown): boolean {
  if (!isSafeTokenName(name)) return false;
  const v = validateValueCore(value);
  if (v === null) return false;
  if (name === FONT_FAMILY_TOKEN) return FONT_VALUE_RE.test(v);
  return VALUE_PATTERNS.some(re => re.test(v));
}

/** 一组扁平 token 覆写表（主题包与后端下发共用形态）；不分明暗档 */
export type ThemeTokenOverrides = Record<string, string>;

/** 校验结果：通过的项 + 被拒的项（后者供调用方上报，便于发现配置写错） */
export interface SanitizeResult {
  tokens: Record<string, string>;
  rejected: string[];
}

/** 参与注入的分层：主题包在前，外部覆写在后（后者同名覆盖前者） */
export interface ThemeTokenLayers {
  /** 主题包自带 token（来自 themes/<包>/<设备>/<页面>/colors/<配色>/） */
  theme?: ThemeTokenOverrides | null;
  /** 外部覆写 token（后端下发 / 父应用同步） */
  external?: ThemeTokenOverrides | null;
}

/**
 * 逐条校验覆写表，丢弃不安全的条目。
 * 不采用「一条非法就整体拒绝」：一条写错的色值不该让整站退回默认配色；
 * 被拒条目返回给调用方便于上报告警。
 */
export function sanitizeOverrides(input: ThemeTokenOverrides | null | undefined): SanitizeResult {
  const result: SanitizeResult = { tokens: {}, rejected: [] };
  if (!input || typeof input !== 'object') return result;

  for (const [name, value] of Object.entries(input)) {
    if (!isSafeTokenEntry(name, value)) {
      result.rejected.push(`${name}=${String(value).slice(0, 40)}`);
      continue;
    }
    result.tokens[name] = value.trim();
  }
  return result;
}
