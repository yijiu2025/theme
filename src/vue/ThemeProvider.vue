<script setup lang="ts">
/**
 * `<ThemeProvider page device>` —— 钉死 / 并行主题容器（P1a，2026-10-23）
 *
 * 给一段子树一套**自己的主题**（弹窗 / 通知 / 悬浮窗锁死品牌配色；或暗色控制面板
 * 浮在浅色页面上）：
 *   · 解析走内核纯查询（`resolveScopedRecord`），**不读不写全局 store** ——
 *     全局换肤、路由切换都不影响本容器，反之亦然；
 *   · token 注入到本组件根元素（`useScopedTheme`），沿 DOM 子树继承；
 *   · `.dark` 类与 `data-mauth-theme` 挂本元素。
 *
 * === 什么时候**不该**用它 ===
 * 叠层 UI 跟随当前主题是**默认且免费**的（CSS 变量从 html 根继承，如 oauth21 的
 * MessageToast）—— 只有需要"钉死/并行"时才包本容器。常态是裸用。
 *
 * === 边界（与 useScopedTheme 同源）===
 * 作用域 = **tokens-only**：theme.scss 与基线 `html.dark` 块不进作用域；
 * 作用域暗色依赖该配色**自带完整底色 token**（2026-09-25 定案的既有形态）。
 *
 * @author yijiu2025
 * @since 2026-10-23（计划 §2.2 P1a ②）
 */
import { computed, onUnmounted, ref } from 'vue';
import { resolveScopedRecord, useScopedTheme } from './use-scoped-theme';

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
onUnmounted(disposeScoped);
</script>

<template>
  <!-- 作用域锚点：token / .dark / data-mauth-theme 全挂这里，attrs（class 等）正常透传 -->
  <div ref="rootEl"><slot /></div>
</template>
