<script setup lang="ts">
/**
 * `<ThemeView>` —— 渲染某个页面「当前生效的版式组件」
 *
 * 把每个业务容器里复制粘贴的 ~40 行「版式加载 + epoch 防抖 + 回退」样板收进库。容器
 * 只剩业务逻辑（表单、校验、ctx 组装），模板里一行 `<ThemeView page="login" device="mobile" :ctx="ctx" />`。
 *
 * 内部自动做四件事（开发者不再手写）：
 *   1. `viewId = page.pick({ url, theme, pkg, device })`（URL > 声明 > env > 包名）
 *   2. `page.views.load(id, pkg, device)` → epoch 防抖 → `markRaw(loaded) ?? builtin`
 *   3. `setActivePageView(page, viewId)`（immediate，配色挂在版式下）
 *   4. `setActiveDevice(device)`（immediate —— **device prop 即告知**：设备身份随容器
 *      渲染自然到达，宿主分发器只负责选容器，不用碰主题 store）
 *
 * === 依赖从哪来（库不 import 宿主 store/router）===
 *   · `page`（`pageOf(page)`）→ 页面域自动注册（`defineThemePage`）
 *   · `themeStore`（`inject`）→ `<ThemeRoot :themeStore>` provide
 *   · `url`（`?th` / `?th_<设备缩写>`）→ **store 版式意图** `deviceViewOf(device)`
 *     （2026-10-20 store 化：URL 一次读入，debug 改写不碰路由；原先每次渲染现读
 *     路由 query）
 *   · `builtin`（首帧零请求回退）→ 版式注册表 `views.builtin(device)`（eager 静态 import）
 *   · `device` prop → 本组件渲染在哪台设备容器里，就是哪台设备（**告知 store**，见上）
 *
 * @author yijiu2025
 * @since 2026-10-18
 */
import { computed, inject, markRaw, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { pageOf } from './view-page';
import { themeStoreKey } from './theme-store';
import type { ThemeStoreLike } from './theme-store';

const props = defineProps<{
  /** 页面名（`'login'`），内部从页面域取 `loginPage`（与主题包搭配） */
  page: string;
  /** 设备名（容器身份 = 文件位置即身份） */
  device: string;
  /** 业务上下文（传进版式组件的 props） */
  ctx: object;
}>();

const store = inject<ThemeStoreLike>(themeStoreKey);
if (!store) {
  throw new Error('[ThemeView] 未注入主题 store —— 请通过 <ThemeRoot :themeStore> 提供');
}

const pageObj = pageOf(props.page);
if (!pageObj) {
  throw new Error(`[ThemeView] 页面「${props.page}」未声明 —— 请先 defineThemePage({ page: '${props.page}', ... })`);
}

/**
 * 用哪套版式：`?th[_<设备缩写>]`（store 版式意图）> 主题包声明（views.<page>）> 当前包名。
 * 做成 computed（而非 setup 取一次）是因为主题**运行时**才定：后端换配色配置可能晚于本页
 * setup 到达，取一次会漏掉「主题包声明了版式」这种情况；依赖 `packageId` 让它在换包时自动重算。
 * url 档读 store 而非路由 query（2026-10-20）：URL 一次读入 `deviceView`/`viewIntent`，
 * debug 改写只写 store ⇒ 换版式零路由变化；`deviceViewOf` 内部读 ref，响应性不变。
 */
const viewId = computed(() =>
  pageObj.pick({
    url: store.deviceViewOf(props.device),
    theme: store.viewFor(props.page, props.device),
    pkg: store.packageId,
    device: props.device
  })
);

/** 告知 store「当前是哪一页、哪套版式」（配色挂在版式下，token 注入依赖它） */
watch(viewId, id => store.setActivePageView(props.page, id), { immediate: true });

/**
 * 告知 store「当前渲染在哪台设备上」—— **device prop 即告知**（2026-10-20）
 *
 * 宿主分发器（如 `login/index.vue`）按自己的口径（视口 / `?device=` 锁定）选设备容器，
 * 容器内的本组件用 `device` prop 把设备身份带进 store —— 分发器**不碰主题**，
 * 「判设备」与「告知主题」也不会分家（同一处 props，同帧生效）。
 * watch 而非 setup 取一次：props.device 理论上可变（同容器复用切换设备），取了就落后。
 */
watch(() => props.device, id => store.setActiveDevice(id), { immediate: true });

/**
 * 当前渲染的版式组件。初始值 = 内置包版式（eager 静态 import，首帧零请求直接正确）；
 * 非内置包版式是动态 chunk，加载完成后接管。`viewEpoch` 丢弃过期结果（A→B→A 连续切换时
 * 先发出的 A 可能后返回）。🔴 必须同时盯住 `packageId`：换了包但解析出的 id 字符串没变
 * （两边都是 `base`）时渲染的组件其实换了一整套。
 */
const builtin = pageObj.views.builtin(props.device);
const activeView = shallowRef<Component | null>(builtin);
let viewEpoch = 0;
watch(
  [viewId, () => store.packageId],
  ([id, pkg]) => {
    const epoch = ++viewEpoch;
    void pageObj.views.load(id, pkg, props.device).then(loaded => {
      if (epoch !== viewEpoch) return;
      // null = 用内置包版式（首屏零请求那条路径）
      activeView.value = loaded ? markRaw(loaded) : builtin;
    });
  },
  { immediate: true }
);
</script>

<template>
  <component :is="activeView" v-if="activeView" :ctx="ctx" />
</template>
