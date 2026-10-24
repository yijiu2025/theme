/**
 * 主题 token 运行时（**DOM 注入半边**）—— 把分层 token 校验后注入为 CSS 变量（内核版）
 *
 * === 分层与优先级（低 → 高）===
 *   1. SCSS 基线          :root / html.dark / 断点块
 *   2. 主题包 tokens      getThemeRecord(...).tokens
 *   3. 外部覆写 tokens    后端下发 / 父应用同步
 * 第 2、3 层写在根节点的 inline style 上，层间顺序靠**写入顺序**保证。
 *
 * === 注入目标（P1a 作用域化，2026-10-23）===
 * 缺省目标仍是 `document.documentElement`（全局，与历史行为逐字一致）；传
 * `{ target: el }` 则注入到**任意元素**（作用域主题：弹窗/悬浮窗钉死自己的配色，
 * 同屏多主题）。每个目标**各自维护**自己的注入名单（WeakMap 按 target 缓存）——
 * 差集清理只动"该目标自己写过的变量名"，多目标互不串台、互不清除。
 *
 * === 为什么校验（细节见 `skinsuite` 的 `tokens.ts`）===
 * CSS 自定义属性能直接改变渲染，未校验就 `setProperty` 等于把 CSS 注入的口子交给
 * 后端或父页面。所以走白名单（`sanitizeOverrides`，纯函数已在内核 `skinsuite`）。
 *
 * === 为什么本文件在 Vue 绑定层、而非纯内核 ===
 * 它操作 DOM（`document.documentElement` / 任意元素），纯内核 `skinsuite` 刻意零 DOM。
 * 校验函数（`sanitizeOverrides`）已在纯内核，这里只保留「往 DOM 写」这个动作本身。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/runtime.ts 下沉）
 * @since 2026-10-23（P1a：注入目标参数化，名单按 target 分账管理）
 */
import { sanitizeOverrides } from '../tokens';
import type { ThemeTokenLayers, ThemeTokenOverrides } from '../tokens';

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
