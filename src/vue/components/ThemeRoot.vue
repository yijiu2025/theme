<script setup lang="ts">
/**
 * 主题外壳（纯外观壳）—— 挂 `.dark` 类 + body 底色用 token 决定
 *
 * 也是 provide 点：把 themeStore provide 给子树（<ThemeView> / <ThemeDebugPanel> inject）。
 * 「主题从哪来」（父应用同步 / 后端配色 / URL / 用户操作）是主题运行时的职责，不在本组件。
 *
 * 底色用 token 而不是 Tailwind 色阶：避免「Tailwind 给一套、token 给一套」的双重轨道
 * （选 black 主题时页面底不是纯黑）。html.dark 类保留 —— dark: 变体依赖这个开关。
 */
import { computed, provide } from 'vue';
import { themeStoreKey } from '../store/theme-store';
import type { ThemeStoreLike } from '../store/theme-store';

const props = defineProps<{
  /** 主题 store（结构类型，宿主 Pinia store 结构兼容即可传；`provide` 给 <ThemeView>/<ThemeDebugPanel>） */
  themeStore: ThemeStoreLike;
}>();

// 提供主题 store 给子树（<ThemeView> / <ThemeDebugPanel> inject）
provide(themeStoreKey, props.themeStore);

/** 当前是否深色（驱动 `html.dark` 类与 body 底色过渡） */
const isDark = computed(() => props.themeStore.isDark);

/**
 * body 容器的内联样式（token 通道）
 *
 * 过渡（0.3s）保留：Tailwind dark 切换的瞬间仍可能抖动，300ms 让它与
 * token 切换同步平滑。
 */
const shellStyle =
  'background-color: var(--mauth-bg); color: var(--mauth-text); ' +
  'transition: background-color 0.3s, color 0.3s;';
</script>

<template>
  <div :class="{ dark: isDark }">
    <!--
      body 容器：底色/文字色由 token 决定，与组件 scoped token 同源。
      min-h-screen + bg-mauth / text-mauth / font-sans 保持既有排版基线。
    -->
    <div class="min-h-screen bg-mauth text-mauth font-sans" :style="shellStyle">
      <slot />
    </div>
  </div>
</template>
