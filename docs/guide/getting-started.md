# 快速上手

从零把一个 Vue + Vite 应用接上 skinsuite，七步。完整对照物见 [API 参考](/api/kernel)，逐函数链路见 [进阶 · 架构地图](/advanced/structure)。

## 1. 安装

```bash
npm install skinsuite
```

::: warning 0.x 请显式写版本号
`^0.10.1` 与 `~0.10.1` 在 0.x 下都等价于 `>=0.10.1 <0.11.0`（caret 不跨 minor）。本包每发一个 minor 你都要手工跟一次——这是 0.x 允许重命名的固有成本。接入前先 `npm view skinsuite version` 核对 registry 最新版。
:::

## 2. 挂构建插件

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { themeAssets } from 'skinsuite/vite';

export default defineConfig({
  // 零参数：主题根目录缺省 src/theme，用 env VITE_THEME_DIR 改（相对工程根）
  plugins: [themeAssets(), vue()]
});
```

插件在构建期扫主题目录，生成虚拟模块 `virtual:theme`——整个主题体系的唯一数据源。目录不存在退化为空注册表（应用照常起）；写歪的条目被跳过并在 dev 下报 `[theme] 扫描跳过 …` 警告。

## 3. 声明设备清单

设备是**宿主的事实**：有哪些设备、叫什么、顺序如何、容器组件在哪——全部是宿主的决定。判定与容器布线的**机制也在宿主**（见下方分工说明）。本库不硬编码任何设备名、不提供判定/布线工具，只消费两样东西：装配期注入的**词汇**（`DeviceVocab`）与容器里的 `<ThemeView device>` props。

```ts
// src/view/devices.ts —— 设备事实（宿主）：一份声明 = 词汇 + 容器布线 + 模块装配
import type { Component } from 'vue';
import { createDeviceModule, pageContainers } from '@/device';   // ← 宿主自己的设备机制层
import type { HostDeviceInput } from '@/device';

/** 设备清单：一条 = 词汇（id/label/urlKey）+ 该设备的容器布线（序 = 优先级，末条 = 兜底） */
export const DEVICES: readonly HostDeviceInput[] = [
  {
    id: 'mini',
    label: '紧凑版',
    urlKey: 'mini',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Mini/)
  },
  {
    id: 'mobile',
    label: '手机端',
    urlKey: 'mobile',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'standard',
    label: '桌面端',
    urlKey: 'std',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Standard/)
  }
];

/** 设备模块实例（判定接线 + 页面装配）—— 页面分发器经此消费 */
export const device = createDeviceModule({ devices: DEVICES });
```

::: warning 与 skinsuite 的分工（别混进库里）
`pageContainers` / `createDeviceModule` / `HostDeviceInput` 是**宿主自己的设备机制层**（oauth21 的 `src/device/`），**不是 `skinsuite` 的导出**——本库自 0.9 起不持有设备注册表与布线工具。同一份 `DEVICES` 注入主题 store 时，只有词汇三字段被消费（`containers` 是宿主自用的扩展字段，结构兼容 `DeviceVocab` 即可直接传）：

```ts
createThemeState({ devices: DEVICES })   // 词汇注入；容器布线留在宿主分发器
```

容器位置约定：**页面名 = 容器文件的上一级目录名**（`view/web/login/MiniLogin.vue` → 页面 `login`）；web 家族（mini/standard）共用同一份 glob、靠文件名前缀区分；mobile/tablet 各自目录树以 `index.vue` 为入口。详见[设备与容器](/guide/devices)。
:::

## 4. 建主题目录

```
src/theme/                      ← 主题根目录（= VITE_THEME_DIR）
├── theme.config.ts             调试开关（见下）
├── views/                      页面契约（副作用注册）
│   └── login.ts                defineThemePage({ page: 'login' })
└── themes/
    └── default/                ← 一个主题包 = 一种版式
        ├── index.ts            包定义（meta + 可选 views）
        └── mobile/
            └── login/
                ├── index.vue   该（包 × 设备 × 页面）的版式组件
                └── colors/
                    ├── white/  配色定义：tokens + 可选 theme.scss
                    │   ├── index.ts
                    │   └── theme.scss
                    └── black/
                        └── index.ts
```

真实文件内容：

```ts
// themes/default/index.ts —— 包定义（index.js 也接受）
export default {
  meta: { id: 'default', name: '默认包' },
  // 可选：本包配色未自带声明时的版式 id。通常省略 —— view ≡ package，包名即版式 id
  views: undefined
};
```

```ts
// themes/default/mobile/login/colors/white/index.ts —— 配色定义
export default {
  meta: { id: 'white', name: '白' },
  tone: 'light',                    // 'light' | 'dark' —— 必填，驱动明暗联动
  tokens: {
    '--mauth-canvas': '#f7f8fa',    // 扁平 CSS 变量；名字必须 --mauth-<短横线>
    '--mauth-text': '#1f2329',
    '--mauth-primary': '#2e6ef7',
    '--mauth-radius': '8px'
  }
  // views: { login: 'compact' }    // 可选：单配色级版式覆盖
};
```

```scss
/* themes/default/mobile/login/colors/white/theme.scss —— 可选样式表。
   放 token 表达不了的东西：url() 资源、伪元素、keyframes。
   自动带 html[data-mauth-theme='white'] 前缀作用域。 */
```

```ts
// views/login.ts —— 页面契约（注册页面；这里只能有声明，不能有逻辑）
import { defineThemePage } from 'skinsuite/vue';

defineThemePage({ page: 'login' });
```

```ts
// theme.config.ts —— 主题域清单（调试开关）
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  // 'off' | 'url' | 'always'；'url' = 仅当下面的 query 匹配时出现面板
  //（缺省门控），query/value 可自定义
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
```

配色 id 的唯一性作用域是**包 × 设备 × 页面**——`white` 可以在每个作用域各有一份。包定义与配色定义接受 `index.ts` 或 `index.js`（并存时 `.ts` 优先），纯 JS 项目无需引入 TypeScript 工具链。

## 5. 装 store

```ts
// src/stores/theme.ts
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import 'virtual:theme';   // 副作用：装注册表 + 版式表 + 清单

export const useThemeStore = defineStore('theme', () =>
  createThemeState({
    devices: DEVICES          // 词汇注入；库不自持设备注册表
    // storageKeys / colorParam / viewParam / defaultPage / remoteParams —— 见下节
  })
);
```

```ts
// src/bootstrap.ts（路由应用）
import { theme } from 'skinsuite/vue';
app.use(theme, { router });   // 0.9 起 router 可选（无路由应用见下）
```

## 6. App 层挂 ThemeRoot（provide 点）

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { ThemeRoot, ThemeDebugPanel } from 'skinsuite/vue';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <!-- 🔴 :themeStore 必传：它是 provide 点，ThemeView / 调试面板靠 inject 取
       store，不传直接抛错。库不 import 宿主 Pinia（零 pinia 依赖），只约定
       ThemeStoreLike 结构 —— 传「字段兼容的对象」即可，不必真是那个 store。 -->
  <ThemeRoot :themeStore="themeStore">
    <router-view />
  </ThemeRoot>
  <ThemeDebugPanel />
</template>
```

## 7. 渲染页面 + 选设备（分发器）

```vue
<!-- src/view/app/login/index.vue —— 设备容器（你的代码、你的业务逻辑） -->
<script setup lang="ts">
import { ThemeView } from 'skinsuite/vue';
const ctx = { /* 版式需要的任何上下文 */ };
</script>

<template>
  <!-- 容器持有业务，版式组件持有呈现 -->
  <ThemeView page="login" device="mobile" :ctx="ctx" />
</template>
```

「当前是哪台设备」**库不判定**——视口阈值、UA、`?device=` 锁定都是宿主口径。分发器只负责**选容器**（经宿主设备模块实例或清单查询），不碰主题：

```ts
// src/view/web/login/index.vue（路由组件 = 分发器）
import { computed, defineAsyncComponent } from 'vue';
import { DEVICES } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';   // 你的判定

const device = useRenderDevice();   // 例：视口 + ?device= + iframe 来源规则 → 设备 id
const deviceComponents = new Map(
  DEVICES.map(d => [d.id, defineAsyncComponent(d.containers().get('login')!)])
);
const activeComponent = computed(
  () => deviceComponents.get(device.value)
    ?? deviceComponents.get(DEVICES[DEVICES.length - 1]!.id)!
);
```

设备身份**只**经 `<ThemeView device="…">` props 进 store——判定在宿主，库只读取渲染。

`ThemeView` 按「当前包 × 设备 × 页面」解析版式（注册表回退链兜底）：内置包 eager 加载（首屏零请求），其余包惰性 chunk；随后把配色的 tokens + `.dark` 类 + `data-mauth-theme` 属性注入作用域。

## 验证

| 动作 | 期望 |
| --- | --- |
| `?debug=theme` | 调试面板出现，可切配色 / 版式 |
| `?th=<包名>` | 版式切换 |
| dev 下拼错值（如 `?th=compat`） | console 出 `[theme]` 警告（无门控，静默失败显影） |
| `vue-tsc -b` + `vite build` | 0 error（`virtual:theme` 有类型、公开面完整） |

::: warning tsconfig 必做一行
`skinsuite/vite` 自带 `virtual:theme` 的类型声明，但类型声明只有在被纳入 TS 程序时才有意义。在项目的 `src/vite-env.d.ts` 里加 `import "skinsuite/vite";`（**不要**写 `/// <reference types="skinsuite/vite" />`——`reference types` 解析不到包的子路径入口，会报 TS2882）。
:::
