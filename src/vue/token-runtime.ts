/**
 * 主题 token 运行时（**DOM 注入半边**）—— 把分层 token 校验后注入为 CSS 变量（内核版）
 *
 * === 分层与优先级（低 → 高）===
 *   1. SCSS 基线          :root / html.dark / 断点块
 *   2. 主题包 tokens      getThemeRecord(...).tokens
 *   3. 外部覆写 tokens    后端下发 / 父应用同步
 * 第 2、3 层都写在根节点的 inline style 上，层间顺序靠**写入顺序**保证。
 *
 * === 为什么校验（细节见 `skinsuite` 的 `tokens.ts`）===
 * CSS 自定义属性能直接改变渲染，未校验就 `setProperty` 等于把 CSS 注入的口子交给
 * 后端或父页面。所以走白名单（`sanitizeOverrides`，纯函数已在内核 `skinsuite`）。
 *
 * === 为什么本文件在 Vue 绑定层、而非纯内核 ===
 * 它操作 `document.documentElement`（DOM），纯内核 `skinsuite` 刻意零 DOM。
 * 校验函数（`sanitizeOverrides`）已在纯内核，这里只保留「往 DOM 写」这个动作本身。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21/src/theme/runtime.ts 下沉）
 */
import { sanitizeOverrides } from '../tokens';
import type { ThemeTokenLayers, ThemeTokenOverrides } from '../tokens';

/** 上一次注入到 inline style 的变量名，用于下次注入前清理 */
let injectedNames: string[] = [];

/** 清掉上一次注入的所有主题变量 */
export function clearThemeTokens(): void {
  const root = document.documentElement;
  for (const name of injectedNames) root.style.removeProperty(name);
  injectedNames = [];
}

/**
 * 应用分层 token（主题包 + 外部覆写）
 *
 * 每次调用都是「把两层重算一遍，再与上一轮的变量名做差集清理」：
 *   · 换配色时不会残留上一轮的值
 *   · 只动自己写过的变量名，不碰别人留在 html 上的 inline style
 * 层内顺序：先 theme 后 external，同名后者胜（「后端覆写压过主题默认」）。
 */
export function applyThemeLayers(layers: ThemeTokenLayers): string[] {
  const theme = sanitizeOverrides(layers.theme);
  const external = sanitizeOverrides(layers.external);

  const root = document.documentElement;
  const nextNames = new Set([...Object.keys(theme.tokens), ...Object.keys(external.tokens)]);
  for (const name of injectedNames) {
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
  injectedNames = [...applied];

  return [...theme.rejected, ...external.rejected];
}

/** 只应用外部覆写（等价于 applyThemeLayers({ external })） */
export function applyThemeTokens(overrides: ThemeTokenOverrides | null): string[] {
  return applyThemeLayers({ external: overrides });
}

/** 当前已注入的变量名（供验收脚本与单测断言注入是否真的发生） */
export function getInjectedTokenNames(): readonly string[] {
  return injectedNames;
}
