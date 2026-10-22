/**
 * 让 `tsc` 能检查 Vue 绑定层 —— 它 `export { default as ThemeView } from './ThemeView.vue'`，
 * 而 tsc 本身不认 SFC，没有这份声明就会报 "Cannot find module './ThemeView.vue'"。
 *
 * 🔴 **能力边界（别误读成"vue 层已全量检查"）**：
 * 这份声明把 `.vue` 当成**不透明组件**，所以
 *   · ✅ 能检查 `src/vue/**\/*.ts` 的接线（props 名、事件签名、导出面、跨文件引用）
 *   · ❌ **不检查 SFC 内部**（`<script setup>` 里的类型错误抓不到）
 * SFC 内部仍由宿主的 `vue-tsc -b` 兜底 —— 宿主是源码直供，SFC 走它的编译管线。
 *
 * 为什么不用 vue-tsc：库仓定位是"零运行时依赖的纯内核 + 可选绑定层"，
 * 为 dev 期类型检查再引一条 vue-tsc 工具链（且与 TS 6 的兼容性未验）不划算；
 * 这里要补的是"绑定层完全不在任何检查里"这个**全盲区**，tsc 够用。
 *
 * 这份声明只在 `tsconfig.vue.json` 生效 —— 主 `tsconfig.json` 排除了 `src/vue/**`，
 * 内核检查不会被它的宽松类型污染。
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
