<script setup lang="ts">
/**
 * 主题外壳（**纯外观壳**）—— 只管「长什么样」，不碰「主题从哪来」
 *
 * 职责（两件事）：
 *   1. 挂 `.dark` 类（Tailwind `dark:` 变体与基线 SCSS 的开关）
 *   2. body 容器用 **token** 决定底色与文字色（并平滑过渡）
 *
 * 「主题从哪来」（父应用同步 / 后端配色 / URL / 用户操作）是**主题运行时**的职责
 * （见 `useThemeSources`），不在本组件 —— 外壳只读 `themeStore.isDark` 决定挂不挂 dark。
 * 调试面板已独立为 `<ThemeDebugPanel/>` 组件，由宿主在 App 层单独挂载。
 *
 * === 为什么底色用 token 而不是 Tailwind 色阶 ===
 * 早先这里是 `bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50`，
 * 与 `--mauth-bg` / `--mauth-text` 形成**双重轨道**：选 black 主题时 Tailwind 给出
 * slate-950、token 给出 #000000，结果"选了黑但页面底不是纯黑"。
 * 现在统一到 token：黑/白配色文件里的 `--mauth-bg` / `--mauth-text` 完全决定底色。
 * `html.dark` 类仍保留 —— Tailwind 的 `dark:bg-slate-xxx` 类仍依赖这个开关，不能删。
 *
 * @author yijiu2025
 * @since 2026-10-17（2026-10-18 退化为纯外观壳：删 host / 父同步 / 后端拉取 / 调试面板）
 */
import { computed, provide } from 'vue';
import { themeStoreKey } from './theme-store';
import type { ThemeStoreLike } from './theme-store';

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
