<script setup lang="ts">
/**
 * `<ThemePart id>` —— 渲染某个**部件**（弹窗/通知/悬浮窗）「当前生效的实现」（P1b，2026-10-23）
 *
 * 部件 = 可复用 UI 零件，DOM 实现住在主题包里、按 (包 × 设备) 各写各的
 * （`themes/<包>/<设备>/parts/<部件id>/index.vue`）—— 换版式 = 换主题包，
 * 与页面版式同一条法则（版式 ≡ 包）。
 *
 * === 与 `<ThemeView>` 的三点本质差异 ===
 *   1. 解析键是 (pkg × device × partId)，**不查页面注册表**（`pageOf`），不要求
 *      `defineThemePage`——部件不是导航表面；
 *   2. 🔴 **绝不调 setActivePageView / setActiveDevice** —— 全局作用域纹丝不动。
 *      用 `<ThemeView page="modal-x">` 渲染弹窗会把背景页面的配色域劫持到弹窗页
 *      （弹窗一开背景换肤闪变），本组件就是为此存在（计划 §一「陷阱」）；
 *   3. 颜色默认**继承全局 token**（零成本，与 MessageToast 同理）；显式给
 *      `color-id` 时把部件自己的配色注入到本组件根元素（`useScopedTheme` 纯查询，
 *      不碰 store）—— 钉死配色的悬浮窗。
 *
 * === 版式选择链（与 ThemeView 的 pick 同构）===
 *   当前包（store.packageId，**只读**）有该部件 → 用它；否则回落 default 包实现
 *   （default 是 eager + 兜底包，`builtin()` 同步可得）。当前包与 default 都没有：
 *   渲染缺省 + dev 警告（部件缺失是显式失败，不静默白屏也不劫持作用域）。
 *
 * === 行为放哪（计划 §2.3 ④ 容器/呈现分离）===
 *   弹窗的开关状态 / Teleport / z-index / 焦点圈 / 动画归**宿主的行为容器**
 *   （唯一一份）；本组件渲染的部件实现只吃 `ctx`、只调 `ctx.actions`。
 *
 * @author yijiu2025
 * @since 2026-10-23（计划 §2.3 P1b ②）
 */
import { computed, inject, markRaw, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { DEFAULT_THEME_PACKAGE } from '../constants';
import { themePartsFor } from './theme-parts';
import { resolveScopedRecord, useScopedTheme } from './use-scoped-theme';
import { themeStoreKey } from './theme-store';
import type { ThemeStoreLike } from './theme-store';

const props = defineProps<{
  /** 部件 id（= `parts/` 下的目录名，`[a-z0-9-]`；调用侧展示变体走 ctx 字段，不是 id 维度） */
  id: string;
  /** 业务上下文（传给部件实现的 props；契约类型住宿主 `theme/parts/<id>.ts`） */
  ctx?: object;
  /** 设备名；缺省用 store 当前生效设备（activeDevice，只读） */
  device?: string;
  /**
   * 主题包；缺省用 store 当前生效包（packageId，只读——🔴 不写 store）。
   * 显式指定即"钉死某包的部件实现"（跨包复用，如浮动面板永远用 default 的实现）。
   */
  pkg?: string;
  /**
   * 钉死部件配色（可选）：给本组件根元素注入该配色的 token（作用域注入，不碰全局）。
   * 缺省继承全局 token（跟随当前主题，零成本）。
   */
  colorId?: string;
}>();

const store = inject<ThemeStoreLike>(themeStoreKey);
if (!store) {
  throw new Error('[ThemePart] 未注入主题 store —— 请通过 <ThemeRoot :themeStore> 提供');
}

/** 解析三要素：包（只读 store）× 设备（只读 store 或显式）× 部件 id */
const pkg = computed(() => props.pkg ?? store.packageId);
const device = computed(() => props.device ?? store.activeDevice);

/** 部件加载表（按 id）；键形 `./<包>/<设备>/parts/<部件id>/index.vue` */
const partKeyOf = (p: string, d: string): string => `./${p}/${d}/parts/${props.id}/index.vue`;

/**
 * 当前渲染的部件实现。初始值 = default 包实现（eager，首帧同步）；
 * 当前包有专属实现时异步接管。epoch 丢弃过期结果（A→B→A 连续切换）。
 */
const loaders = computed(() => themePartsFor(props.id));
const builtin = computed<Component | null>(() => {
  const loader = loaders.value[partKeyOf(DEFAULT_THEME_PACKAGE, device.value)];
  if (!loader) return null;
  const mod = loader();
  return mod instanceof Promise ? null : (mod.default ?? null); // default 包 eager 同步形态
});
const activePart = shallowRef<Component | null>(builtin.value);
let partEpoch = 0;

watch(
  [pkg, device, () => props.id],
  ([p, d]) => {
    const epoch = ++partEpoch;
    // 当前包有专属实现 → 加载它；否则用 default 兜底（builtin）
    const loader = loaders.value[partKeyOf(p, d)];
    const load = loader ? Promise.resolve(loader()).catch(err => {
      console.warn(`[ThemePart] 部件「${props.id}」在包「${p}」${d} 端加载失败，已回退 default 实现`, err);
      return null;
    }) : Promise.resolve(null);
    void load.then(mod => {
      if (epoch !== partEpoch) return;
      activePart.value = mod?.default ? markRaw(mod.default) : builtin.value;
    });
  },
  { immediate: true }
);

// 缺件告警（dev）：当前包与 default 包都没有这个部件 —— 显式失败，不静默白屏
if (import.meta.env.DEV) {
  watch(
    [pkg, device, () => props.id],
    ([p, d]) => {
      if (!themePartsFor(props.id)[partKeyOf(p, d)] && !themePartsFor(props.id)[partKeyOf(DEFAULT_THEME_PACKAGE, d)]) {
        console.warn(
          `[ThemePart] 部件「${props.id}」在 包「${p}」与 default 包的「${d}」端都没有实现` +
            '（themes/<包>/<设备>/parts/ 下未登记）—— 渲染为空。排查目录名（[a-z0-9-]）与设备段。'
        );
      }
    },
    { immediate: true }
  );
}

/** 钉死配色（可选）：作用域注入到本组件根元素，不碰全局 */
const rootEl = ref<HTMLElement | null>(null);
const scopedRecord = computed(() =>
  props.colorId
    ? resolveScopedRecord({
        page: `part:${props.id}`,
        device: device.value,
        pkg: pkg.value,
        colorId: props.colorId
      })
    : null
);
// 未钉死（record = null）时 watch 走"清理并继承全局 token"档（useScopedTheme 的 null 分支）
const disposeScoped = useScopedTheme(scopedRecord, rootEl);
onUnmounted(disposeScoped);
</script>

<template>
  <!--
    作用域锚点：color-id 钉死时 token / .dark / data-mauth-theme 挂这里；
    未钉死时就是普通容器（token 继承 html 根）。attrs（class 等）正常透传。
  -->
  <div ref="rootEl">
    <component :is="activePart" v-if="activePart" :ctx="ctx" />
  </div>
</template>
