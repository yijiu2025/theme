/**
 * `.vue` 模块的兜底声明（**仅在不走 vue-tsc 的工具链里生效**）
 *
 * === 现状（2026-10-23 起）===
 * `npm run typecheck` 的 vue 半边已改走 **vue-tsc**（`vue-tsc -p tsconfig.vue.json`，
 * include 覆盖 `src/vue` 目录下的全部 `.ts` 与 `.vue`）：SFC 内部（`<script setup>` 的
 * 类型错误）会被真实检查 —— 已用注入探针验证过 TS2322 能在 SFC 内部报出。
 *
 * 本声明仍保留，兜的是**只跑纯 tsc 的场景**（某些 IDE / 单文件检查工具不认 SFC）：
 * 没有它，`export { default as ThemeView } from './ThemeView.vue'` 会报
 * "Cannot find module './ThemeView.vue'"。vue-tsc 下真实文件优先于通配声明，
 * 两者并存互不干扰（已验证）。
 *
 * ⚠️ 能力边界（纯 tsc 场景下别误读成"vue 层已全量检查"）：
 * 这份声明把 `.vue` 当成**不透明组件**，只保接线检查（props 名、导出面），
 * **不检查 SFC 内部** —— 那是 vue-tsc 的活。
 *
 * 这份声明只在 `tsconfig.vue.json` 生效 —— 主 `tsconfig.json` 排除了 `src/vue` 目录，
 * 内核检查不会被它的宽松类型污染。
 *
 * ⚠️ ⚠️ 别在本块注释里写出「星号紧跟斜杠」的字符组合（如 glob 写法）：它会提前
 * 闭合注释、把后续行当代码解析（types.ts 文件头踩过，本文件 2026-10-23 又踩过一次）。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // 刻意不用 `any`：unknown 至少能挡住"把组件当函数调用"这类误用，
  // 同时不假装自己知道 props 的形状（那是 SFC 内部的事）。
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export default component;
}
