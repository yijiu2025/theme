<script setup lang="ts">
/**
 * 主题 / 版式调试面板的**门卫**（对外，宿主 App.vue 里一行 `<ThemeDebugPanel />`）
 *
 * === 职责只有一个：决定「要不要加载面板主体」 ===
 * 本组件是随主包的**轻量门卫**，只算 `visible`（清单 `debug` 开关 + `?debug=theme`），
 * 再用 `defineAsyncComponent(() => import('./ThemeDebugPanelBody.vue'))` 按需加载真正的
 * 面板重 chunk。于是：
 *   · `off` 档            → `visible` 恒 false → `import()` 永不触发 → **chunk 不进产物**
 *   · `url` 档 + 无参数    → `visible` false → 同上，不下载也不执行
 *   · `url` 档 + 有参数 / `always` → `visible` true → 才触发异步加载 + 渲染
 *
 * === 为什么不做成「宿主自己 v-if」===
 * 可见性判断（`isThemeDebugVisible(debug, query)`）是**库的机制**，不该让宿主写；宿主
 * 保持零接线（一行 `<ThemeDebugPanel />`），「什么时候加载」这个决策收在门卫里。
 *
 * @author yijiu2025
 * @since 2026-09-23（2026-10-18 拆「门卫 + 主体」：off 档连 chunk 都不下载）
 */
import { computed, defineAsyncComponent } from 'vue';
import { isThemeDebugVisible, themeManifest } from '../manifest';
import { currentQuery } from './device-domain';

/** 面板此刻是否该显示（清单 debug 开关 + URL 触发参数） */
const visible = computed(() => isThemeDebugVisible(themeManifest().debug, currentQuery()));

/**
 * 面板主体（重 chunk，独立分割）：`v-if="visible"` 保证 false 时 Vue 不挂载本组件，
 * 于是 `import()` 不被触发 → chunk 不下载。真正的面板 UI / 数据 / 动作都在 Body 里。
 */
const PanelBody = defineAsyncComponent(() => import('./ThemeDebugPanelBody.vue'));
</script>

<template>
  <PanelBody v-if="visible" />
</template>
