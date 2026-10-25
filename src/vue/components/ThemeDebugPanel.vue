<script setup lang="ts">
/**
 * 调试面板的门卫 —— 只决定「要不要加载面板主体」
 *
 * 本组件是随主包的轻量门卫，只算 visible（清单 debug 开关 + ?debug=theme），再按需
 * 异步加载真正的面板重 chunk：
 *   · off 档 → import() 永不触发 → chunk 不进产物；
 *   · url 档无参数 → 不下载也不执行；
 *   · url 档有参数 / always → 才加载 + 渲染。
 *
 * 可见性判断是库的机制（isThemeDebugVisible），不该让宿主写 —— 宿主保持零接线。
 */
import { computed, defineAsyncComponent } from 'vue';
import { isThemeDebugVisible, themeManifest } from '../../manifest';
import { currentQuery } from '../device/device-domain';

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
