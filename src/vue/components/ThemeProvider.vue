<script setup lang="ts">
/**
 * `<ThemeProvider page device>` —— 钉死 / 并行主题容器
 *
 * 给一段子树一套自己的主题（弹窗锁死品牌色；暗色面板浮在浅色页面上）：
 * 解析走内核纯查询（resolveScopedRecord），不读不写全局 store —— 全局换肤、
 * 路由切换都不影响本容器，反之亦然；token 注入到本组件根元素，沿 DOM 子树继承。
 *
 * 叠层 UI 跟随当前主题是默认且免费的（CSS 变量从 html 根继承）—— 只有需要
 * 「钉死/并行」时才包本容器，常态是裸用。
 *
 * 作用域 = tokens-only：theme.scss 与基线 html.dark 块不进作用域。
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { resolveScopedRecord, useScopedTheme } from '../composables/use-scoped-theme';

const props = defineProps<{
  /** 页面名（作用域配色归属 = 包 × 设备 × 页面） */
  page: string;
  /** 设备名 */
  device: string;
  /** 主题包（缺省 default 包） */
  pkg?: string;
  /**
   * 钉死的配色 id；缺省取该范围兜底色（`getDefaultThemeId`）。
   * 指定了但不存在：dev 警告 + 回落兜底记录（Q2 口径），prod 静默兜底。
   */
  colorId?: string;
}>();

const rootEl = ref<HTMLElement | null>(null);

/** 作用域记录（纯查询；props 变化 → computed 重算 → useScopedTheme 重注入） */
const record = computed(() =>
  resolveScopedRecord({
    page: props.page,
    device: props.device,
    pkg: props.pkg,
    colorId: props.colorId
  })
);

/** 注入 + cleanup（组件卸载时精确摘除自己写过的变量 / 属性 / 类） */
const disposeScoped = useScopedTheme(record, rootEl);
// 🔴 onBeforeUnmount 而非 onUnmounted：onUnmounted 触发时模板 ref 已被 Vue 置 null，
//    cleanup 里的 DOM 清理（clearThemeTokens / 摘类 / 摘属性）会拿到 null 而失效。
onBeforeUnmount(disposeScoped);
</script>

<template>
  <!-- 作用域锚点：token / .dark / data-mauth-theme 全挂这里，attrs（class 等）正常透传 -->
  <div ref="rootEl"><slot /></div>
</template>
