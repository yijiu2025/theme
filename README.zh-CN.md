# skinsuite

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/skinsuite)](https://www.npmjs.com/package/skinsuite)
[![CI](https://github.com/yijiu2025/theme/actions/workflows/ci.yml/badge.svg)](https://github.com/yijiu2025/theme/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-yijiu2025.github.io%2Ftheme-blue)](https://yijiu2025.github.io/theme/)
[![license](https://img.shields.io/npm/l/skinsuite)](./LICENSE)
![node](https://img.shields.io/node/v/skinsuite)

多主题 / 多版式机制的实现库：**主题包 × 设备 × 页面 × 配色** 四段键 + 明暗联动 + CSS 变量安全校验 + 设备维度 URL 参数。零运行时依赖，Vue / React / Node / SSR 通用。

```bash
npm install skinsuite
```

**特性速览**

- 🎨 **主题包 = 版式 + 配色**：换设计 = 新建包，不碰业务代码；换色值 = 改配色目录
- 📱 **设备词汇完全宿主化**：mobile / desktop / mini 由你定义，库零判定、只接收渲染
- 🔗 **URL 即状态**：`?th` / `?th_color` / `?device` 三族参数；非法值 dev 告警、永不锁死页面
- 🌗 **明暗 ≡ 色系**：切暗 = 切黑系配色，双侧记忆槽；点色卡不改明暗（正交 + 单向联动）
- 🛡️ **白名单安全校验**：token 名值双闸，拒 `url()` 与规则闭合字符——外部下发每个值都过闸
- 🧩 **无路由 / 作用域 / 部件**：`<ThemeScope>` / `<ThemeProvider>` / `<ThemePart>` 覆盖弹窗与悬浮窗

包分三个入口，按需 import：

| 入口 | 内容 |
| --- | --- |
| `skinsuite` | 纯内核：id 白名单、`mode` / `tone`、token 校验、设备维度参数（无 DOM、无框架依赖） |
| `skinsuite/vue` | Vue 绑定：`createThemeState` 状态机、`<ThemeView>` / `<ThemeRoot>` / `<ThemeScope>` / `<ThemeProvider>` / `<ThemePart>`、调试面板 |
| `skinsuite/vite` | 构建插件：`themeAssets()` 扫主题目录生成 `virtual:theme` 虚拟模块 |

---

## 快速上手（Vue + Vite）

从零七步。完整教程见[文档站](https://yijiu2025.github.io/theme/)（[快速上手](./docs/guide/getting-started.md)），API 参考见 [docs/api/](./docs/api/kernel.md)，逐文件职责地图见 [docs/advanced/structure.md](./docs/advanced/structure.md)。

### 1. 挂构建插件

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

### 2. 声明设备清单（设备侧，不 import skinsuite）

设备是**独立的子系统**：设备机制（判定 / 容器布线 / 装配）是宿主自己的事（oauth21 收在 `src/device/` 机制层），设备清单文件**不 import 任何主题库的东西**——主题侧与设备侧的唯一耦合点在第 4 步（只投影词汇三字段）：

```ts
// src/view/devices.ts —— 设备事实（宿主）：数组序 = 优先级，末条 = 兜底设备
import type { Component } from 'vue';
import { createDeviceModule, pageContainers } from '@/device';   // 你的设备机制层
import type { HostDeviceInput } from '@/device';

export const DEVICES: readonly HostDeviceInput[] = [
  {
    id: 'mobile',
    label: '手机端',
    urlKey: 'mobile',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'standard',
    label: '桌面端',
    urlKey: 'std',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/Standard*.vue'), /^Standard/)
  }
];

/** 设备模块实例（判定接线 + 页面装配）—— 页面分发器经此消费 */
export const device = createDeviceModule({ devices: DEVICES });
```

容器位置约定：**页面名 = 容器文件的上一级目录名**（`view/app/login/index.vue` → 页面 `login`）；web 家族共用一份 glob、靠文件名前缀区分（上面是示例，模式与文件名约定由你定）。判定口径（视口 / UA / `?device=` 语义）同样在你的设备机制层——与主题无关。设备机制层自身的最小参考实现见 [docs/guide/device-layer.md](./docs/guide/device-layer.md)。

### 3. 建主题目录

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

### 4. 装 store

```ts
// src/stores/theme.ts —— 主题侧
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import type { DeviceVocab } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import 'virtual:theme';   // 副作用：装注册表 + 版式表 + 清单

// 设备侧 → 主题侧的唯一耦合点：只投影词汇三字段（id / label / urlKey），
// containers 等设备侧事实不进主题
const deviceVocab: DeviceVocab[] = DEVICES.map(({ id, label, urlKey }) => ({ id, label, urlKey }));

export const useThemeStore = defineStore('theme', () =>
  createThemeState({
    devices: deviceVocab      // 词汇注入；库不自持设备注册表
    // storageKeys / colorParam / viewParam / defaultPage / remoteParams —— 见下节
  })
);
```

```ts
// src/bootstrap.ts（路由应用）
import { theme } from 'skinsuite/vue';
app.use(theme, { router });   // 0.9 起 router 可选（无路由应用见下）
```

### 5. App 层挂 ThemeRoot（provide 点）

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

### 6. 渲染页面

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

`ThemeView` 按「当前包 × 设备 × 页面」解析版式（注册表回退链兜底）：内置包 eager 加载（首屏零请求），其余包惰性 chunk；随后把配色的 tokens + `.dark` 类 + `data-mauth-theme` 属性注入作用域。

### 7. 每页选设备（分发器）

「当前是哪台设备」**库不判定**——视口阈值、UA、`?device=` 锁定都是宿主口径。分发器经设备侧的清单选容器（不碰主题）：

```ts
// src/view/web/login/index.vue（路由组件）
import { computed, defineAsyncComponent } from 'vue';
import { DEVICES } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';   // 你的设备机制层的判定

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

---

## URL 参数手册

统一下划线键形；设备专属键优先于通用键；空值 = 未指定（不会顶掉通用键）。

| 参数 | 含义 | 取值链 |
| --- | --- | --- |
| `?th=<包>` | 版式意图，全设备 | `th_<urlKey>` → `th` → 包默认 |
| `?th_mobile=<包>` | 单设备版式意图 | 同链，按设备各一条 |
| `?th_color=<配色>` | 配色意图，全设备 | `th_color_<urlKey>` → `th_color` → 落盘偏好 → 作用域默认 |
| `?th_color_std=<配色>` | 单设备配色意图 | 同链，按设备各一条 |

示例：`/login?th=compact`、`/login?th_mobile=default&th_std=compact`（各端各一套包）、`/login?th_color=blue`。非法值不会锁死任何东西——dev 下警告后沿链回落。

明暗**没有** URL 入口（设计如此）——它是用户偏好，落 localStorage（`mauth:mode` / `mauth:theme`；0.7.x 的旧裸键有一次性读迁移）。

## 明暗与色系

- `mode` = 用户意图：`'system' | 'light' | 'dark'`（`MODE_CYCLE` 是切换循环序）
- `tone` = 每套配色**自带**的属性：`'light' | 'dark'`
- 切「暗」= 切到黑系配色；切回「明」恢复你上次的白系配色（双侧记忆槽）。点颜色不会顺带改明暗——两个维度正交、单向联动。

## 配置项与进阶用法

```ts
createThemeState({
  devices,                                  // 设备维度参数/面板需要它
  storageKeys: { mode: 'my:mode', theme: 'my:theme' },  // 同源多应用隔离
  colorParam: 'brand',                      // → ?brand=<id> / ?brand_<urlKey>=<id>
  viewParam: 'layout',                      // → ?layout=<pkg> / ?layout_<urlKey>=<pkg>
  defaultPage: 'app',                       // 无路由播种：token 从首帧即可解析
  remoteParams: () => ({ client_id: '…' })  // 拉远程主题配置的身份参数（键名你定）；配合 VITE_THEME_ENDPOINT
})
```

- **无路由应用**：`app.use(theme)` 不传 router；壳层用 `<ThemeScope page device>`（只锚定作用域、只渲染 slot）；播种 `defaultPage` 让任何视图挂载前 token 就能解析。
- **钉死配色的作用域**（弹窗必须保持自己的颜色）：`<ThemeProvider page device :pkg :color-id>`——纯查询解析，不读不写全局 store。
- **部件主题化**（弹窗/通知组件本身换肤）：`<ThemePart id="confirm-modal" :ctx />`——渲染 `themes/<包>/<设备>/parts/<id>/index.vue`；一个包一种实现，与页面同一条法则。
- **调试面板**：dev 下加 `?debug=theme`——查看 store 状态、切配色/版式、看 URL 非法值警告（触发键可在 `theme.config.ts` 的 `debug.query` 自定义）。
- **iframe 嵌入（父应用控制主题）**：父应用拼 iframe src 时直接带 URL 参数即可（`?th_color=blue`、`?th=<包>`）——首帧生效且锁定该设备，后端下发与本地偏好都压不过它。运行时跟随父应用切换走 `THEME_CHANGE` postMessage：env 配 `VITE_ALLOWED_PARENT_ORIGINS`（逗号分隔的父 origin 白名单，只写会嵌本页的父应用；留空 = 不启用同步）。
- **后端按身份下发主题**：env 配 `VITE_THEME_ENDPOINT`（非空才启用），请求为 `GET {端点}?{remoteParams 给的参数}`——身份参数键名你定（`remoteParams: () => ({ client_id: … })` / `{ user_id }` / `{ app }`，库不读 URL、不预设键名），响应 `{ theme?, mode?, tokens? }`（`theme` 必须是已注册配色 id；`tokens` 逐条过白名单）。超时（默认 3s）/ 失败一律静默回落本地配色。优先级：URL 参数 ＞ 后端下发 ＞ 本地偏好。
- **纯内核用法（React / Node / SSR）**：`sanitizeOverrides(payload)` 校验任何外部下发的 CSS 变量；`readDeviceParam(query, name, deviceKey)` 设备维度取值链；`THEME_ID_RE` 等常量做校验。全程无需 DOM。

## 什么不在包里

| 不在 | 由谁提供 |
| --- | --- |
| `import.meta.glob` / 构建器专有 | `skinsuite/vite`（其他构建器写自己的适配） |
| DOM / localStorage / 路由 | 宿主，或 `skinsuite/vue` 默认实现（键可覆盖） |
| 设备清单 | 你的清单文件 + `createThemeState({ devices })` 注入 |
| 业务资产（`themes/**`） | 随应用走 |

## 安全边界

CSS 自定义属性能直接改变渲染。未校验的 `setProperty` 等于交出两个口子：**外发请求**（`url()` 探测/追踪）与**样式注入**（闭合规则载荷）。因此只用白名单：名字必须 `--mauth-<短横线>`；取值允许 `#hex` / `rgb()` / `hsl()` / 长度 / `var(--mauth-*)`；颜色名、`url()`、规则闭合字符逐条拒绝（`sanitizeOverrides` 返回 `{ tokens, rejected }`——一条坏值不会连累其余）。判据：**必须写 `url()`、伪元素、keyframes 的，走 `theme.scss`，不走 token。**

## 单例语义（微前端必读）

`installThemeRegistry` / `installThemeManifest` / `installThemeViews` 是模块级单例；token 注入写 `document.documentElement`。承诺形态：**每个 JS realm + 每份 document = 一个主题域。** SPA、iframe、SSR 每次渲染各自独立。微前端共享同一模块实例会互相覆盖（后注册整体生效、token 注入互清）——子应用要模块隔离，或只用纯内核自管注入。同源多应用共享 `th` / `th_color` 参数与 localStorage 键——用 `storageKeys` / `colorParam` / `viewParam` 细分。

---

## 开发

```bash
npm run typecheck   # tsc + vue-tsc
npm run build       # tsc → dist/
npm test            # 构建 + node:test（内核 .mjs + vue 层编译产物）
```

`src/` 相对 import **必须带 `.js` 后缀**（NodeNext 编译原样保留说明符）。exports 双轨：`types` 指向 `src/`（类型源码直供），`.` 与 `./vite` 的 `import` 指 `dist/`；`./vue` 以源码形态发布（tsc 编不出 SFC）。

0.x 阶段次要版本可能重命名导出（显式具名导出，改名即 semver-minor）。

## 社区与支持

| 我要… | 去哪 |
| --- | --- |
| 接入教程 / 查 API | [文档站](https://yijiu2025.github.io/theme/)（guide / api / advanced） |
| 看路线图 / 版本政策 / 常见问题 | [Wiki](https://github.com/yijiu2025/theme/wiki) |
| 使用提问 | [Discussions · Q&A](https://github.com/yijiu2025/theme/discussions/categories/q-a) |
| 功能想法 | [Discussions · 想法](https://github.com/yijiu2025/theme/discussions/categories/想法)（达成共识转 issue） |
| 报缺陷 | [Issue · 缺陷报告](https://github.com/yijiu2025/theme/issues/new?template=bug_report.yml)（带最小复现） |
| 安全漏洞 | [私密报告](https://github.com/yijiu2025/theme/security/advisories/new)（勿开公开 issue） |
| 参与贡献 | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| 求助分流 / 响应口径 | [SUPPORT.md](./SUPPORT.md) |

欢迎一切形式的贡献：报告问题、完善文档、提交代码。动手前读一遍 CONTRIBUTING 的「代码红线」——每一条都是实战踩出来的。

## 赞助支持

如果 skinsuite 帮到了你，欢迎请作者喝杯咖啡：

<p align="left">
  <img src=".github/assets/sponsor-wechat.png" width="200" alt="微信赞助二维码">
</p>

**微信**：扫码加好友，备注「赞助」即可转账。收到的每一笔都会记在心里。

## License

[MIT](./LICENSE) © 2026 qirly
