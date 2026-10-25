<script setup lang="ts">
/**
 * `<ThemeScope page device>` —— 轻量作用域锚点（token-only）
 *
 * <ThemeView> 的「token-only」子集：只锚定作用域、不渲染版式组件（无页面注册要求、
 * 无版式加载，主题目录无需 .vue），模板只有一个 <slot />。两类场景：
 *   · 无路由应用：App 层挂一个，token 全站可解析；
 *   · 路由型应用的壳层兜底：<ThemeView> 挂载后覆盖这里的值，卸载时这里重新锚定。
 *
 * 版式档位与 ThemeView 的 pick 同构（URL 意图 → 包/配色声明 → 当前包名），但不查
 * 版式注册表；非法包名由 getThemeRecord 回退链兜底，dev 下另有 URL 参数审计显影。
 */
import { computed, inject, watch } from 'vue';
import { DEFAULT_THEME_PACKAGE } from '../../constants';
import { themeStoreKey } from '../store/theme-store';
import type { ThemeStoreLike } from '../store/theme-store';

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
