<script setup lang="ts">
/**
 * `<ThemeScope page device>` —— 轻量作用域锚点（P0 无路由支持，2026-10-23）
 *
 * `<ThemeView>` 的"token-only"子集：**只锚定作用域，不渲染版式组件**。
 * 没有页面注册要求（`defineThemePage`）、没有版式组件加载（主题目录无需 `.vue`），
 * 模板只有一个 `<slot />`。两类场景：
 *   · 无路由应用（纯 UI 壳 / 工具页 / 嵌入式小组件）：App 层挂一个，token 全站可解析；
 *   · 路由型应用的壳层兜底：`<ThemeView>` 挂载后 `setActivePageView` 覆盖这里的值，
 *     卸载（回到无 ThemeView 的壳层路由）时这里重新锚定。
 *
 * === 与 `<ThemeView>` 的差异（为什么不是加个开关）===
 * ThemeView 的报错语义（页面未注册 / 版式缺失）是**页面链路的防呆**，壳层链路不该被
 * 这些约束卡住——两个组件、两套契约，比一个开关两条路径干净。
 *
 * === 版式档位（与 ThemeView 的 pick 同构，但不查版式注册表）===
 *   URL 意图（store 版式档 `deviceViewOf`）→ 包/配色声明（`viewFor`）→ 当前包名。
 *   值的合法性不做本地校验：非法包名由 `getThemeRecord` 的回退链兜底（静默回落
 *   default 包记录），dev 下另有 URL 参数审计（theme-debug）显影。
 *
 * @author yijiu2025
 * @since 2026-10-23（计划 docs/plans/2026-10-23-theme-routerless-overlay.md §2.1 P0 ②）
 */
import { computed, inject, watch } from 'vue';
import { DEFAULT_THEME_PACKAGE } from '../constants';
import { themeStoreKey } from './theme-store';
import type { ThemeStoreLike } from './theme-store';

const props = defineProps<{
  /** 页面名（主题目录里的普通页面目录，如 `'app'`；配色归属 = 包 × 设备 × 页面） */
  page: string;
  /** 设备名（本作用域按哪台设备解析；宿主分发器判定后的结果） */
  device: string;
}>();

const store = inject<ThemeStoreLike>(themeStoreKey);
if (!store) {
  throw new Error('[ThemeScope] 未注入主题 store —— 请通过 <ThemeRoot :themeStore> 提供');
}

/** 生效版式锚点（= 包名）：URL 意图 > 包/配色声明 > 当前包（与 ThemeView 的 pick 同构） */
const viewId = computed(() => {
  const fromUrl = store.deviceViewOf(props.device);
  if (fromUrl) return fromUrl;
  return store.viewFor(props.page, props.device) ?? DEFAULT_THEME_PACKAGE;
});

/** 告知 store「当前是哪一页、哪套版式」（配色挂在版式下，token 注入依赖它） */
watch(viewId, v => store.setActivePageView(props.page, v), { immediate: true });

/**
 * 告知 store「当前渲染在哪台设备上」—— 与 ThemeView 同一写入口。
 * watch 而非 setup 取一次：props.device 理论上可变（同容器复用切换设备）。
 */
watch(() => props.device, d => store.setActiveDevice(d), { immediate: true });
</script>

<template>
  <slot />
</template>
