/**
 * `.vue` 模块的兜底声明（仅在不走 vue-tsc 的工具链里生效）
 *
 * typecheck 的 vue 半边走 vue-tsc（SFC 内部被真实检查）；本声明兜的是只跑纯 tsc 的
 * 场景（部分 IDE / 单文件检查工具不认 SFC）—— 没有它，import './X.vue' 会报
 * Cannot find module。vue-tsc 下真实文件优先于通配声明，两者并存互不干扰。
 *
 * 能力边界：本声明把 .vue 当不透明组件，只保接线检查（props 名、导出面），
 * 不检查 SFC 内部。只在 tsconfig.vue.json 生效，主 tsconfig 排除了 src/vue。
 *
 * ⚠️ 别在本块注释里写出「星号紧跟斜杠」的字符组合（如 glob 写法）：它会提前
 *    闭合注释、把后续行当代码解析（本文件与 types.ts 都踩过）。
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
