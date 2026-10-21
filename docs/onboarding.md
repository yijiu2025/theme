# 接入指南（Onboarding）

> 面向：要给一个**新的 Vue + Vite 前端**接上 `skinsuite` 的多主题 / 多版式机制。
> 本文只讲「接入」，不讲「为什么这么设计」——原理见包根 `README.md` 与仓库里的
> `theme-package-extraction.md` / `theme-replacement.md` / `theme-view-component-design.md`。
>
> 全程以 `oauth21`（登录页）为已落地参照，但**不假设你的业务与它相同**：每一步都标注
> 哪些是「库的固定 API（照抄）」，哪些是「宿主的业务事实（你自己定）」。

---

## 〇、先想清楚你要用到哪几层

接入前花一分钟确认要哪几层，避免把不需要的也搬进来：

| 能力 | 入口 | 你需要的场景 |
|---|---|---|
| 多配色（明暗 + 色系，换 CSS 变量） | `skinsuite` + `skinsuite/vue` | 必选 |
| 多版式（同一页换 DOM / 交互组织） | `skinsuite/vue` | 可选（只有一个版式就只建一个主题包） |
| 多设备（手机 / 桌面 / 平板各自布局） | `skinsuite/vue` | 可选（单端就只声明一台设备） |
| 调试面板 | `skinsuite/vue` | 可选（`theme.config.ts` 里 `debug: { enabled: 'url' }`） |

**最小接入 = 多配色**：只建一个主题包、一个设备、一个页面，也能完整跑起来。

---

## 一、安装与依赖

```bash
npm install skinsuite
```

库是**零运行时依赖**的纯内核，`vue` / `vite` 都是 `optional` peer dependency——你项目里
本就有它们，无需额外安装。

三个入口（包名 → 用途）：

| 入口 | 作用 | 谁用 |
|---|---|---|
| `skinsuite` | 纯内核：常量、类型、token 校验、设备/配色取值 | 任何地方（含 Node 脚本、单测） |
| `skinsuite/vue` | Vue 绑定：`<ThemeView>` / `<ThemeRoot>` / 状态机 / 设备域 | Vue 组件与 store |
| `skinsuite/vite` | 构建期插件：`themeAssets` 扫主题目录生成 `virtual:theme` | `vite.config.ts` |

---

## 二、目录约定（固定，不配置）

库要求主题域是一个**自足的目录**，内部三个名字是固定约定：

```
<主题根目录>/                     ← 由 env `VITE_THEME_DIR` 指定（缺省 src/theme）
├── theme.config.ts              清单：调试开关（defineThemeManifest）
├── themes/                      主题包目录（一个包 = 一整套设计）
│   └── default/                 ← 内置包（default 是保留名，eager 首屏零请求）
│       ├── index.ts             包定义（MauthThemePackage）
│       └── <设备>/<页面>/        版式组件 + 配色
│           ├── index.vue        该设备该页的版式组件
│           └── colors/<配色>/
│               ├── index.ts     配色元信息 + tokens
│               └── theme.scss   附加样式（可选）
└── views/                       声明目录（设备 + 页面契约）
    ├── devices.ts               defineThemeDevice 声明设备
    └── <page>.ts                defineThemePage 声明页面
```

`themes` 和 `views` 这两个子目录名是**固定的**（插件按名字扫描），只有主题根目录位置可配。

---

## 三、写主题资产（theme 根目录）

### 3.1 包定义 `themes/default/index.ts`

```ts
import type { MauthThemePackage } from 'skinsuite';

const pkg: MauthThemePackage = {
  id: 'default',
  name: '默认版式',
  views: {}   // 可选：本包声明各页默认用哪个配色 / 版式
};

export default pkg;
```

> `MauthThemePackage` 的完整字段以 `skinsuite` 的 `types.ts` 为准；最小可只给 `id` + `name`。

### 3.2 配色 `themes/default/<设备>/<页面>/colors/<配色>/index.ts`

```ts
import type { MauthThemeColor } from 'skinsuite';

const color: MauthThemeColor = {
  id: 'light',
  tone: 'light',          // 'light' | 'dark' —— 明暗系别，与 mode 联动的关键
  tokens: {
    '--mauth-bg': '#ffffff',
    '--mauth-text': '#1f2937'
    // ... 你的设计 token
  }
};

export default color;
```

### 3.3 版式组件 `themes/default/<设备>/<页面>/index.vue`

```vue
<script setup lang="ts">
import type { LoginViewProps } from '@/theme/views/login';

// 版式只渲染 ctx、只调 ctx.actions，禁止写业务（请求 / 校验 / store / 路由）
defineProps<LoginViewProps>();
</script>

<template>
  <div class="login-layout">
    <!-- 用 ctx.fields.email.value / ctx.actions.submit() 等 -->
  </div>
</template>
```

---

## 四、写声明文件（views 目录）

### 4.1 设备声明 `views/devices.ts`

```ts
import type { Component } from 'vue';
import { THEME_ID_RE } from 'skinsuite';
import { defineThemeDevice } from 'skinsuite/vue';

// 声明顺序 = 优先级；**最后一条是兜底设备**（库只认顺序，不认设备名）
defineThemeDevice({
  id: 'mobile',
  label: '手机端',
  urlKey: 'mobile',                       // URL 参数里用的缩写（?th_mobile=...）
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
    fileRe: /^index\.vue$/,
    idRe: THEME_ID_RE
  }
});

defineThemeDevice({
  id: 'standard',
  label: '桌面端',
  urlKey: 'std',
  containers: {
    glob: import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'),
    fileRe: /^Standard/,
    idRe: THEME_ID_RE
  }
});
```

`defineThemeDevice` 只登记**事实**（id / label / urlKey / 容器在哪），自动建容器表、
自动注册进设备域，**不要再手动写任何转发函数**。

🔴 **这里没有 `match`** —— 判定不归库，见 §4.1b。

### 4.1b 🔴 设备判定写在哪：宿主（不是库）

「当前属于哪台设备」是**业务口径**：视口阈值取 768 还是别的、UA 命中算不算、
`?isMobile=true` / `?from=mini` / `?device=` 这些 URL 词汇，换个产品就变。
所以库**零判定**：判定是宿主自己的一个模块（utils 层），页面分发器消费它选容器，
设备身份再由被选中容器里的 `<ThemeView page="login" device="mini">` props 告知主题 store。

```ts
// src/utils/device-resolve.ts（宿主侧，**纯函数**：query/path/视口显式入参，零 import）
//
// 🔴 别把这段放进 `src/theme/views/`：那是主题域的**纯声明目录**
//    （defineThemePage / defineThemeDevice），会被 virtual:theme 当声明副作用 import，
//    判定代码会跟着主题域一起进包；而且「theme/ 整包搬到另一个前端」就不成立了。
//    theme/views/devices.ts 只留设备声明（有哪些设备、容器在哪）。
export function resolveRenderDevice(
  query: Record<string, unknown>,
  path: string,
  mobile: boolean
): string | null {
  if (query.device) return query.device as string;  // ?device= 一次性锁定
  if (query.isMobile === 'true') return 'mobile';   // 显式意图
  if (query.from === 'mini') return 'mini';         // 来源标记
  if (mobile) return 'mobile';                      // 视口 + UA（调用方喂信号）
  return null;                                      // null = 落兜底设备（末条）
}
```

纯函数的输入全是**事实**（query / path / 视口是否移动），没有任何库的类型；返回值
`null` = 「没有显式倾向」，由分发器落设备清单末条。

**视口变化怎么办**：库不订阅 `matchMedia`（「什么算变了」也是宿主口径）。宿主把视口做成
**响应式信号**（`mobileViewport()`），用一个薄 composable 把它和路由事实接进判定函数：

```ts
// src/composables/useRenderDevice.ts（宿主侧薄封装）
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { mobileViewport } from '@/utils/device';
import { resolveRenderDevice } from '@/utils/device-resolve';

export function useRenderDevice(): Readonly<Ref<string | null>> {
  const route = useRoute();
  // route.query / mobileViewport 被 computed 自动收集 → 跨断点翻转 / 换路由即重判
  return computed(() => resolveRenderDevice(route.query, route.path, mobileViewport().value));
}
```

页面分发器据此**选容器**（不碰主题）：

```ts
// view/web/<page>/index.vue（页面分发器）
import { computed, defineAsyncComponent } from 'vue';
import { deviceIds, fallbackDevice, resolveContainerOf } from 'skinsuite/vue';
import { useRenderDevice } from '@/composables/useRenderDevice';

const device = useRenderDevice();
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'login'))])
);
const activeComponent = computed(() => {
  const fallback = fallbackDevice();
  return deviceComponents.get(device.value ?? fallback) ?? deviceComponents.get(fallback)!;
});
```

**设备身份怎么进主题**：不靠分发器接线，靠被选中容器里的 `<ThemeView>` —— 它的
`device` prop 就是「本容器渲染在哪台设备上」，setup 里 `watch(immediate)` 调
`store.setActiveDevice(device)`，与 `setActivePageView` 同帧完成。于是「选哪个容器」
与「主题按哪台设备渲染」永远是同一处事实，不会分家：

```ts
// 容器内（如 MiniLogin.vue）—— 一行 props 同时定了页面、设备与 ctx
<ThemeView page="login" device="mini" :ctx="ctx" />
```

**加一种设备**要动的三处：`theme/views/devices.ts` 一条 `defineThemeDevice` 声明 /
`utils/device-resolve.ts` 一条判定分支（如需）+ 容器组件 / 主题包里加设备目录。库零改动。

⚠️ 判定查「已注册的设备清单」（分发器的 `fallbackDevice()`），所以 `bootstrap.ts` 要在
`app.use(theme)` **之前** import 一次声明模块（`import './theme/views/devices'`）——
通常 `virtual:theme` 会拉齐，但显式 import 能让顺序确定，不依赖插件产物。

### 4.2 页面契约 `views/<page>.ts`

```ts
import { defineThemePage } from 'skinsuite/vue';

// —— 版式契约类型（纯类型，无运行时）：容器传给版式的 ctx ——
export interface LoginViewContext {
  t: (key: string, params?: Record<string, unknown> | string) => string;
  fields: Record<'email' | 'password', { value: string; attrs: Record<string, unknown>; invalid: boolean; error?: string }>;
  submitting: boolean;
  actions: {
    submit(): void;
    switchMode(mode: 'email' | 'pwd'): void;
  };
}

export interface LoginViewProps {
  ctx: LoginViewContext;
}

// 一行声明：把本页注册进页面域（<ThemeView> 靠它取版式）
defineThemePage({ page: 'login' });
```

**注意**：页面契约文件是**纯副作用 + 纯类型**，不要在这里 import `virtual:theme`、不要自己
`import.meta.glob`。版式组件清单由内核从 `virtual:theme` 惰性解析。

### 4.3 清单 `theme.config.ts`

```ts
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  // 调试面板：'off' | 'url' | 'always'（见 §九）
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
```

---

## 五、vite.config.ts（构建期接入）

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { themeAssets, resolveThemeDir } from 'skinsuite/vite';

export default defineConfig(({ mode }) => ({
  plugins: [
    // 顺序：themeAssets 在前、vue 在后
    themeAssets({ dir: resolveThemeDir(mode) }),
    vue()
  ]
}));
```

`themeAssets` 扫 `VITE_THEME_DIR` 指向的目录，产出虚拟模块 `virtual:theme`（`packages` /
`colors` / `styles` / `themeViews` / `themeManifest`），并在模块被 import 时**自动装配**。

要点：
- **构建与单测两侧必须用同一份插件**（否则单测的 `virtual:theme` 是空表，用例静默落默认值）。
  建议抽成一个 `sharedPlugins(mode)` 工厂，`vite.config.ts` 和 `vitest.config.ts` 共用。
- `resolveThemeDir` 记得显式传 `root`（工程根），不要依赖 `process.cwd()`。

### 5.1 `.env`

```env
VITE_THEME_DIR=src/theme
```

缺省就是 `src/theme`，可不写。**换目录只改这一个变量，不动代码。**

### 5.2 tsconfig / env 类型（必做一行）

`skinsuite/vite` 自带 `virtual:theme` 的类型声明（`src/vite/theme.d.ts`），但**类型声明只有在
被纳入 TS 程序时才有意义**。在你项目的 `src/vite-env.d.ts` 里加一行：

```ts
/// <reference types="vite/client" />
import "skinsuite/vite";   // 让 theme.d.ts 的 declare module 'virtual:theme' 进程序
```

🔴 **不要写 `/// <reference types="skinsuite/vite" />`**——`reference types` 解析不到包的
**子路径**入口，症状是 `vue-tsc -b` 报 `Cannot find module or type declarations for side-effect
import of 'virtual:theme'`（TS2882），而 `vite build` / 浏览器全正常，很容易误判成「只是编辑器问题」。

`import` 写在 `.d.ts` 里是**纯类型侧**的：不产生任何运行时代码，也不会把插件打进产物，只是
把 `src/vite/index.ts` 上的 `/// <reference path="./theme.d.ts" />` 带进程序。

---

## 六、bootstrap.ts（启动编排，从这开始写）

这是「接入」的核心。启动顺序：pinia → router → i18n → theme。

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import { theme } from 'skinsuite/vue';
// 设备声明（副作用：注册进设备域）—— 分发器的 fallbackDevice() 要用已注册清单
import './theme/views/devices';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

// 主题装配：只传 router（版式意图同步读 query）。库只认 router 的最小结构
// （currentRoute.value.{ query, path, fullPath }），不 import vue-router，
// **也不认识任何 URL 词汇或视口阈值** —— 设备判定全在宿主
// `utils/device-resolve.ts` + `composables/useRenderDevice.ts`（见 §4.1b），
// 设备身份由容器内的 <ThemeView device="…"> props 告知 store。
app.use(theme, { router });

router.isReady().then(() => app.mount('#app'));
```

**`app.use(theme, { router })` 的语义**：只递一个路由事实给库（版式意图同步读 query）。
设备判定**没有注册槽也不需要**：宿主设备模块自己管（页面分发器经 `useRenderDevice` 消费），
库只经 `<ThemeView>` 的 device prop 接收结果。单端应用连设备模块都可以不写。

---

## 七、store（宿主壳，pinia 不下沉）

```ts
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import 'virtual:theme';   // 副作用：装配版式表 + 注册表 + 清单 + 拉齐 views/*.ts 声明

export const useThemeStore = defineStore('theme', () => createThemeState());
```

三句话讲清边界：
1. **状态机已下沉** `createThemeState`——scope（明暗意图）/ intent（配色意图）/ runtime
   （token 注入）+ 持久化全在库内，宿主一行包成 store。
2. **pinia 不下沉**——状态机零 pinia API，库不为此加 peer 依赖；`defineStore` 只是壳。
3. **`import 'virtual:theme'` 必须保留**——它触发全部副作用装配，宿主**不要再手动 import
   任何 `@/theme/views/*`**（bootstrap 里也不 import）。

> `createThemeState(options?)` 可选 `ThemeStateOptions`（`storageKeys` / `colorParam` /
> `viewParam`），用于覆盖 localStorage 键名、URL 配色参数名（`th_color`）与版式参数名
> （`th`）；缺省对齐 oauth21 现状。

---

## 八、App.vue（外壳 + 调试面板）

```vue
<script setup lang="ts">
import { ThemeRoot, ThemeDebugPanel } from 'skinsuite/vue';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <ThemeRoot :theme-store="themeStore">
    <router-view />
    <ThemeDebugPanel />
  </ThemeRoot>
</template>
```

`<ThemeRoot :themeStore>` 是**纯外观壳**（挂 `.dark` 类 + 用 token 决定 body 底色），同时把
store `provide` 给子树，`<ThemeView>` 靠它 `inject`。`<ThemeDebugPanel>` 独立挂载，`?debug=theme`
才下载 / 显示。

---

## 九、路由与容器

### 9.1 路由表（宿主事实）

路由是**宿主固定声明**的，页面名编码在 path 里（`/<page>` 桌面、`/m/<page>` 手机）。库**不
驱动路由、不声明标题**——`document.title` 归路由 `meta.title`。

```ts
import type { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/view/web/login/index.vue'),
    meta: { title: '登录', requiresAuth: false } },
  { path: '/m/login', name: 'mobile-login', component: () => import('@/view/web/login/index.vue'),
    meta: { title: '登录' } }
];
```

### 9.2 容器（业务逻辑）与版式（UI）分离

容器只写业务：表单校验、ctx 组装、请求、路由。版式组件由 `<ThemeView>` 按「页面 + 设备」自动
选择并渲染：

#### 容器放哪：**页面名 = 文件上一级目录名**

`pageContainers()` 从 glob 结果的 `a/b/<页面>/<文件>.vue` 里取 `parts[length-2]` 当**页面名**，
再用各设备声明的 `fileRe` 筛文件名。于是两份声明各自解读同一批文件：

| 设备 | glob（`views/devices.ts`） | `fileRe` | 实际位置约定 |
|---|---|---|---|
| `mobile` | `/src/view/app/*/index.vue` | `/^index\.vue$/` | `view/app/<页面>/index.vue` |
| `tablet` | `/src/view/tablet/*/index.vue` | `/^index\.vue$/` | `view/tablet/<页面>/index.vue` |
| `standard` | `/src/view/web/*/*.vue` | `/^Standard/` | `view/web/<页面>/Standard<页面>.vue` |
| `mini` | `/src/view/web/*/*.vue` | `/^Mini/` | `view/web/<页面>/Mini<页面>.vue` |

🔴 **`standard` / `mini` 共用 `view/web/`，靠文件名前缀区分设备、靠目录名区分页面**。把
`StandardLogin.vue` 直接摊在 `view/web/` 下 ⇒ 页面名被算成 `web` ⇒ 该设备在这一页「没写容器」⇒
分发器 `resolveContainerOf()` 取不到（`standard` 是兜底，连兜底也空就 reject）。

`import.meta.glob` 的 `*` **不跨 `/`**，所以 `web/*/*.vue` 恰好吃「一层目录 + 一个文件」，不需要 `**`。

```vue
<script setup lang="ts">
import { ThemeView } from 'skinsuite/vue';
import type { LoginViewContext } from '@/theme/views/login';
import { computed } from 'vue';

const ctx = computed<LoginViewContext>(() => ({
  t: k => k,
  fields: { /* ... */ },
  submitting: false,
  actions: { submit() { /* ... */ }, switchMode() { /* ... */ } }
}));
</script>

<template>
  <ThemeView page="login" device="mobile" :ctx="ctx" />
</template>
```

`<ThemeView>` 三个 props：
- `page`：页面名（与 `defineThemePage({ page })` 一致）
- `device`：设备名（**容器文件位置即身份**，无需从别处推断）
- `ctx`：传给版式组件的业务上下文

`<ThemeView>` 内部自动完成：选版式（URL `?th[_<设备缩写>]` > 主题包声明 > 当前包名）→ 惰性
加载 → epoch 防抖回退 → 通知 store 当前页 / 版式 / **设备**（`setActiveDevice(props.device)`，
与 `setActivePageView` 同帧）。**不要在容器里再写 `setActiveDevice` / `setActivePageView`**——
那些是旧版样板，现在都是冗余；`device` prop 本身就是告知（见 §4.1b）。

---

## 十、验证清单（接完按这个跑）

| 项 | 命令 / 动作 | 期望 |
|---|---|---|
| 类型检查 | `vue-tsc -b` | 0 error（`virtual:theme` 有类型、`createThemeState` 面完整） |
| lint | `eslint .` | 0 error |
| 单测 | `vitest run` | 全绿（确认 `vitest.config` 也挂了 `themeAssets`） |
| 构建 | `vite build` | 成功，内置包 eager、非内置包独立 chunk |
| 手测 | `?th=<包>` / `?th_<设备缩写>=<包>` | 版式切换 |
| 手测 | `?debug=theme` | 调试面板出现，可切配色 |
| 手测 | 缩放窗口 / 换 UA | 手机 / 桌面自动切换（由宿主设备模块判定，见 §4.1b） |
| 手测 | `?device=mobile` | 锁定手机端（宿主判定模块的词汇，刷新后失效） |

---

## 十一、常见坑（每一条都踩过）

1. **页面契约 import 了 `virtual:theme`** → 形成 `store → virtual:theme → 组件 → 容器 → store`
   循环。页面契约必须是纯声明（只 `defineThemePage({ page })`），版式表由内核惰性解析。

2. **手写 `import.meta.glob('/src/theme/themes/...')`** → 换目录就失效。扫描全交给
   `themeAssets`，主题目录位置只由 `VITE_THEME_DIR` 决定。

3. **单测没挂 `themeAssets`** → `virtual:theme` 是空表，用例不报错、只静默落默认值，极难归因。
   build 与 test 两侧必须共用同一份插件工厂。

4. **设备判定写了两份**（分发器一套、库一套）→ 口径不一致时手机端渲染但主题是桌面作用域。
   判定只认宿主设备模块一处：分发器用它选容器，被选中容器内的 `<ThemeView device="…">`
   props 告知主题 —— 容器与主题永远同源（库不自行判定，见 §4.1b）。

5. **在容器里手写 `setActiveDevice` / `setActivePageView`** → 冗余且会被 `<ThemeView>` 覆盖。
   全删，交给 `<ThemeView>`（`device` prop 即告知）。

6. **设备判定（视口阈值 / UA / `?device=` / `?isMobile` / `?from=`）写进库里** → 边界错。
   库不提供任何注册槽 / 分发器 composable：判定与它的词汇全部写在宿主 utils 层
   （纯函数 + 薄 composable，见 §4.1b）。同理别指望库订阅 `matchMedia` ——
   视口做成宿主的响应式信号（`mobileViewport()`），判定函数的入参就是它，
   依赖由 `useRenderDevice` 的 computed 自动收集。

7. **容器摊平在 `view/web/` 下**（`web/StandardLogin.vue`）→ 页面名被算成 `web`，该页在这一设备上
   等于「没写容器」。`standard` / `mini` 必须各自待在 `view/web/<页面>/` 里，见 §9.2。
   **症状**：类型检查 / lint / build 全绿（glob 是静态的、文件确实被打进产物），只在运行时分发
   取不到容器才炸。

---

## 附：一个最小可跑的接入骨架（目录总览）

```
my-app/
├── vite.config.ts            # themeAssets({ dir: resolveThemeDir(mode) }) + vue()
├── .env                      # VITE_THEME_DIR=src/theme（可省）
└── src/
    ├── bootstrap.ts          # app.use(theme, { router })
    ├── App.vue               # <ThemeRoot :theme-store> + <ThemeDebugPanel>
    ├── stores/theme.ts       # defineStore('theme', () => createThemeState()) + import 'virtual:theme'
    ├── router/index.ts       # 固定声明 /<page>、/m/<page>
    ├── utils/
    │   ├── device.ts         # 视口口径 + mobileViewport() 响应式信号（宿主）
    │   └── device-resolve.ts # 判定纯函数（宿主，零 import）
    ├── composables/
    │   └── useRenderDevice.ts # 薄封装：route + 视口信号 → 判定纯函数
    ├── view/                 # 容器（业务），模板 <ThemeView page device :ctx>
    │   ├── app/<页面>/index.vue             # mobile（目录名 = 页面名）
    │   ├── tablet/<页面>/index.vue          # tablet（同上；常薄转发 standard）
    │   └── web/<页面>/Standard<页面>.vue    # standard + Mini<页面>.vue 同目录（见 §9.2）
    └── theme/                # 主题域（自足目录）
        ├── theme.config.ts   # defineThemeManifest({ debug })
        ├── views/
        │   ├── devices.ts    # defineThemeDevice 声明设备
        │   └── login.ts      # 契约类型 + defineThemePage({ page: 'login' })
        └── themes/default/
            ├── index.ts      # 包定义
            └── mobile/login/
                ├── index.vue # 版式组件（只渲染 ctx）
                └── colors/light/
                    ├── index.ts  # MauthThemeColor（tokens）
                    └── theme.scss
```
