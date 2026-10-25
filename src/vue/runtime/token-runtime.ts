/**
 * token 运行时（DOM 注入半边）—— 把分层 token 校验后注入为 CSS 变量
 *
 * 分层与优先级（低 → 高）：① SCSS 基线；② 主题包 tokens；③ 外部覆写 tokens。
 * ②③ 写在目标元素的 inline style 上，层间顺序靠写入顺序保证。
 *
 * 注入目标可参数化：缺省 document.documentElement（全局）；传 { target: el }
 * 则注入任意元素（作用域主题）。每个目标各自维护注入名单（WeakMap 分账）——
 * 差集清理只动「该目标自己写过的变量名」，多目标互不串台。
 *
 * 校验用内核 sanitizeOverrides（未校验的 setProperty 等于交出 CSS 注入的口子）。
 * 本文件在 Vue 绑定层而非内核：它操作 DOM，纯内核刻意零 DOM。
 */
import { sanitizeOverrides } from '../../tokens';
import type { ThemeTokenLayers, ThemeTokenOverrides } from '../../tokens';

/** 注入目标选项：缺省 = html 根（全局，历史行为） */
export interface ApplyThemeLayersOptions {
  /** 把 token 注入到这个元素（作用域主题）；缺省注入 document.documentElement */
  target?: HTMLElement;
}

/** 各注入目标的"自己写过的变量名"（差集清理的账本；WeakMap → 元素销毁账本随 GC） */
const injectedByTarget = new WeakMap<HTMLElement, string[]>();

/** 目标归一：缺省 = html 根 */
const targetOf = (target?: HTMLElement): HTMLElement =>
  target ?? document.documentElement;

/** 清掉某目标上一次注入的所有主题变量（缺省清全局） */
export function clearThemeTokens(target?: HTMLElement): void {
  const root = targetOf(target);
  const names = injectedByTarget.get(root);
  if (!names) return;
  for (const name of names) root.style.removeProperty(name);
  injectedByTarget.delete(root);
}

/**
 * 应用分层 token（主题包 + 外部覆写）到指定目标（缺省 html 根）
 *
 * 每次调用都是「把两层重算一遍，再与该目标上一轮的变量名做差集清理」：
 *   · 换配色时不会残留上一轮的值
 *   · 只动**该目标**自己写过的变量名，不碰别人留在上面的 inline style，
 *     也不碰其它注入目标的名单（全局与作用域互不干扰）
 * 层内顺序：先 theme 后 external，同名后者胜（「后端覆写压过主题默认」）。
 */
export function applyThemeLayers(
  layers: ThemeTokenLayers,
  options?: ApplyThemeLayersOptions
): string[] {
  const theme = sanitizeOverrides(layers.theme);
  const external = sanitizeOverrides(layers.external);

  const root = targetOf(options?.target);
  const prevNames = injectedByTarget.get(root) ?? [];
  const nextNames = new Set([...Object.keys(theme.tokens), ...Object.keys(external.tokens)]);
  for (const name of prevNames) {
    if (!nextNames.has(name)) root.style.removeProperty(name);
  }

  // 🔴 去重：theme 层与 external 层**同名** token 时（external 压过 theme），
  //    同一变量会被 setProperty 两次（后者胜是设计行为），但注入名单里不该有重复名。
  const applied = new Set<string>();
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(name, value);
    applied.add(name);
  }
  for (const [name, value] of Object.entries(external.tokens)) {
    root.style.setProperty(name, value);
    applied.add(name);
  }
  injectedByTarget.set(root, [...applied]);

  return [...theme.rejected, ...external.rejected];
}

/** 只应用外部覆写到全局（等价于 applyThemeLayers({ external })） */
export function applyThemeTokens(overrides: ThemeTokenOverrides | null): string[] {
  return applyThemeLayers({ external: overrides });
}

/** 某目标当前已注入的变量名（缺省全局；供验收脚本与单测断言注入是否真的发生） */
export function getInjectedTokenNames(target?: HTMLElement): readonly string[] {
  return injectedByTarget.get(targetOf(target)) ?? [];
}
