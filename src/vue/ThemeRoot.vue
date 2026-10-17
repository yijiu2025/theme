<script setup lang="ts">
/**
 * 主题外壳（**壳组件**）—— App 层里所有与主题有关的接线都收在这里
 *
 * 职责（机制全在库内，宿主只注入「事实」）：
 *   1. 挂 `.dark` 类（Tailwind `dark:` 变体与基线 SCSS 的开关）
 *   2. body 容器用 **token** 决定底色与文字色（并平滑过渡）
 *   3. iframe 嵌入时跟随父应用主题（`useParentThemeSync`）
 *   4. 首屏后拉取后端配色（失败静默，绝不影响登录）
 *   5. 挂调试面板（`?debug=theme`，异步加载，不带参数时不下载）
 *
 * === 为什么底色用 token 而不是 Tailwind 色阶 ===
 * 早先这里是 `bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50`，
 * 与 `--mauth-bg` / `--mauth-text` 形成**双重轨道**：选 black 主题时 Tailwind 给出
 * slate-950、token 给出 #000000，结果"选了黑但页面底不是纯黑"。
 * 现在统一到 token：黑/白配色文件里的 `--mauth-bg` / `--mauth-text` 完全决定底色。
 * `html.dark` 类仍保留 —— Tailwind 的 `dark:bg-slate-xxx` 类仍依赖这个开关，不能删。
 *
 * === 为什么主题请求在 onMounted ===
 * 主题请求是网络 IO，不能挡住首屏渲染。宿主未配置端点时 `fetchRemoteConfig`
 * 直接返回 null、不发请求，所以后端还没提供接口时完全无副作用。
 *
 * === 注入式下沉的边界 ===
 * 库管「什么时候挂 dark、什么时候拉配置、父窗口消息怎么解析、面板长什么样」；
 * 宿主管「当前是不是深色（`isDark`）、去哪拉配置（`fetchRemoteConfig`）、
 * 配置怎么落进 store（`applyRemoteConfig`）、哪些父 origin 可信（`parentSync`）、
 * 面板怎么读路由/store（`debugPanel`）」—— 这五样是宿主事实，库无从知道。
 *
 * @author yijiu2025
 * @since 2026-10-17（从 oauth21 的 `src/theme/ThemeRoot.vue` 下沉）
 */
import { computed, defineAsyncComponent, onMounted } from 'vue';
import type { ComputedRef } from 'vue';
import { useParentThemeSync } from './useParentThemeSync';
import type { ParentThemeSyncOptions } from './useParentThemeSync';
import { useThemeDebugPanel } from './useThemeDebugPanel';
import type { ThemeDebugPanelHost } from './useThemeDebugPanel';
import type { RemoteThemeConfig } from '../remote-config';

/**
 * 宿主注入的主题域事实
 *
 * 每一个字段都是「库不知道、只有宿主知道」的东西。换一个宿主，重写一个
 * `makeThemeRootHost()` 组装它即可，组件与机制零改动。
 */
export interface ThemeRootHost {
  /** 当前是否深色（驱动 `html.dark` 类与 body 底色过渡） */
  isDark: ComputedRef<boolean> | (() => boolean);
  /** 首屏拉取后端配色（未配置端点时返回 null、不发请求）；失败静默返回 null */
  fetchRemoteConfig(clientId?: string): Promise<RemoteThemeConfig | null>;
  /** 把拉到的配色落到宿主 store（含 null = 撤销外部覆写） */
  applyRemoteConfig(config: RemoteThemeConfig | null): void;
  /** iframe 父主题同步的宿主参数（origin 白名单 + 应用入口） */
  parentSync: ParentThemeSyncOptions;
  /** 调试面板的宿主参数（路由/store/页面机制/配色查询） */
  debugPanel: ThemeDebugPanelHost;
}

const props = defineProps<{ host: ThemeRootHost }>();

/** 兼容两种 isDark 形态：ComputedRef（直接 `.value`）或 getter 函数 */
const isDark = computed(() =>
  typeof props.host.isDark === 'function'
    ? (props.host.isDark as () => boolean)()
    : (props.host.isDark as ComputedRef<boolean>).value
);

/**
 * 调试面板：**异步加载**
 *
 * 面板是排查工具，绝大多数访问用不到它。静态引入会把它并进主包；改成异步后，
 * 加载器只在**首次真正渲染**时执行 —— 不带 `?debug=theme` 时既不下载也不执行。
 */
const ThemeDebugPanel = defineAsyncComponent(() =>
  import('./ThemeDebugPanel.vue').then(mod => mod.default)
);
const debug = useThemeDebugPanel(props.host.debugPanel);

// iframe 嵌入时监听父应用主题同步（父切主题子跟着切）
useParentThemeSync(props.host.parentSync);

onMounted(async () => {
  const clientId = new URLSearchParams(window.location.search).get('client_id') || undefined;
  const config = await props.host.fetchRemoteConfig(clientId);
  if (config) props.host.applyRemoteConfig(config);
});

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
    <!--
      与上面的 min-h-screen 容器**平级**：避免被它的布局与层叠上下文影响
      （面板是 fixed 浮层）。放在 App 层而不是某个页面内，是为了任意页面
      （含电脑版）都能用。
    -->
    <ThemeDebugPanel
      v-if="debug.visible.value"
      :model="debug.model.value"
      :actions="debug.actions"
    />
  </div>
</template>
