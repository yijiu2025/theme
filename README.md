# skinsuite

多主题 / 多版式机制的**纯内核**：把「主题包 → 设备 → 页面 → 配色」这套机制里**与业务、与框架都无关**的那一半抽成一个零运行时依赖的 npm 包。

> **English TL;DR** — `skinsuite` is the framework-agnostic core of a multi-theme / multi-layout system: whitelisted constants, theme-package contract types, *mode* (light/dark/system) vs *tone* (light/dark color family), safe CSS-variable token validation, and device-scoped URL parameter resolution. Zero runtime dependencies, no DOM, no bundler APIs, no router — usable from Vue, React, plain Node or SSR. Everything DOM/bundler/store related is intentionally **your** adapter layer (see [What this package deliberately does not do](#什么不在这个包里)).

```bash
npm install skinsuite
```

---

## 它解决什么问题

把一个 app 里打磨成熟的多主题机制搬到别的前端时，真正值得复用、也**最容易走样**的是这几件事：

| 机制 | 手写时的典型事故 |
| --- | --- |
| 目录名 / id 白名单 | 主题目录名直接拼进 `data-*` 属性与 CSS 选择器，一个大写字母就是静默不生效 |
| 明暗（`mode`）与色系（`tone`）的联动 | 两个维度被混成一个布尔值 →「开夜间」切不到深色配色，或者切过去就再也回不来 |
| CSS 变量（token）的安全校验 | 后端/父页面下发的值直接 `setProperty`，等于把 CSS 注入和外发请求的口子交出去 |
| 设备维度的 URL 参数 | `?view.mobile=compact&view.standard=default` 各端各一套的取值链，抄一份就漂移一份 |

本包把这些做成一串**纯函数 + 常量**：零运行时依赖、`sideEffects: false`、可在 Node / SSR / 单测里直接跑，也可以在 Vue 与 React 里共用同一份口径。

它的出身地是 [`oauth21`](https://github.com/yijiu2025/CoreFlow) 的移动端认证页（3 设备 × 3 页面 × 多配色 / 多主题包），但**包里没有任何一行是那个页面特有的**——这就是为什么它可以被你直接用。

---

## 接入指南（新前端从零接入）

> 要在一个**新的 Vue + Vite 前端**里用上多主题 / 多版式 / 多设备 / 调试面板？从头一步步走：

- **完整接入指南**：[`docs/onboarding.md`](./docs/onboarding.md) —— 从安装、目录约定、写主题资产、
  写声明文件、`vite.config.ts`、`bootstrap.ts`、store、`App.vue`、路由与容器，到验证清单与常见坑，
  每一步给真实 API + 完整代码。

先看三个入口的分工，再看下面的「30 秒上手」体会单个 API 的用法：

| 入口 | 作用 |
| --- | --- |
| `skinsuite` | 纯内核（本 README 的 API 全在这里） |
| `skinsuite/vue` | Vue 绑定：`<ThemeView>` / `<ThemeRoot>` / `createThemeState` / 设备域 |
| `skinsuite/vite` | 构建期插件：`themeAssets` 扫主题目录生成 `virtual:theme` |

---

## 30 秒上手

### 1. 安全地接受外部下发的 CSS 变量

```js
import { sanitizeOverrides } from 'skinsuite';

// 后端配置 / 父应用 postMessage 同步 / URL 参数 —— 一律视为不可信输入
const { tokens, rejected } = sanitizeOverrides(payload);

for (const name of Object.keys(tokens)) {
  document.documentElement.style.setProperty(name, tokens[name]);
}
if (rejected.length) reportToSentry('theme: illegal token', rejected);
```

非法条目被**逐条丢弃**而非整体拒绝（`rejected` 会告诉你哪几条、为什么），所以后端写错一个色值不会让整站退回默认外观。

### 2. 按设备读取 URL 参数

```js
import { readDeviceParam } from 'skinsuite';

// /login?view=default&view.mobile=compact
readDeviceParam(route.query, 'view', 'mobile'); // 'compact'  设备专属优先
readDeviceParam(route.query, 'view', 'standard'); // 'default'  该设备没指定 → 通用键
readDeviceParam({}, 'view', 'mobile'); // undefined  由调用方决定兜底
```

---

## 心智模型

```
themes/<主题包>/<设备>/<页面>/colors/<配色>/
       │          │        │          │
       │          │        │          └─ 配色 id：一套扁平 token（+ 可选 theme.scss）
       │          │        └──────────── 页面：login / register / forgot-password …
       │          └───────────────────── 设备：**宿主**的词汇表（mobile / standard / mini / tablet …）
       └──────────────────────────────── 一个主题包 = 一种版式
```

四条固定口径（它们决定了下面所有 API 的形状）：

| 维度 | 谁定义 | 说明 |
| --- | --- | --- |
| **设备**（device） | **宿主**（你） | 本包刻意**不认识**具体设备名。「加一种设备」只改宿主清单，内核无感 —— 这是它能跨项目复用的前提 |
| **页面**（page） | 宿主 | 每页一份 `.vue`，只在**当前包 × 当前设备**下查找 |
| **配色**（color） | 主题包 | 每套配色自带 `tone`（白系 / 黑系），唯一性作用域是「同包 × 同设备 × 同页面」 |
| **明暗**（mode） | 用户偏好 | 与配色正交，通过 `tone` 联动：切「暗」→ 落到黑系配色，切「明」→ 落回白系 |

⚠️ **明暗 ≡ 色系**，不是两套规则：明暗切换的本质是"切到哪一系配色"。这条是本包 `mode` / `tone` 两个模块分工的依据（`tone` 是配色**自带**的属性，`mode` 是用户的意图）。

---

## API

唯一公开出口是包根 `skinsuite`，采用**显式具名导出**（不用 `export *`）—— 下面这张表就是包的承诺，表里没有的名字不该被依赖。

### 常量与兜底口径

```js
import {
  THEME_ID_RE,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  DEFAULT_THEME_PAGE,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_DARK_COLOR,
  BASE_VIEW_ID
} from 'skinsuite';
```

| 导出 | 值 | 用途 |
| --- | --- | --- |
| `THEME_ID_RE` | `/^[a-z0-9-]+$/` | 目录名 / id 白名单：主题包名、配色 id、版式 id、页面名都要过这条（它们会进属性选择器） |
| `DEFAULT_THEME_PACKAGE` | `'default'` | 内置默认**主题包**（首屏静态引入、无需惰性加载的那个包） |
| `DEFAULT_THEME_PAGE` | `'login'` | 未指定页面时的兜底（认证流程的最常见入口） |
| `DEFAULT_THEME_COLOR` | `'white'` | **默认配色**（显式值，不是"字母序第一"—— 那样加一个 `amber` 就会静默改掉默认外观） |
| `DEFAULT_THEME_DARK_COLOR` | `'black'` | 暗系配对值，与上一行成对使用 |
| `DEFAULT_THEME_ID` | `'default'` | 空记录（注册表还没产出任何记录）的**占位** id，**不是**默认配色 |
| `BASE_VIEW_ID` | `'base'` | 版式注册表工厂的**逻辑** id；它永远不该出现在配色键里 |

### 明暗 `mode`

```js
import { MODE_CYCLE, MODE_LABELS, isThemeMode, normalizeMode } from 'skinsuite';
```

- `ThemeMode = 'system' | 'light' | 'dark'` —— 含 `system`，旧版只有布尔值时"切过就回不来"
- `MODE_CYCLE = ['system', 'light', 'dark']` —— 切换按钮的循环顺序
- `normalizeMode(raw)` —— 容忍大小写与首尾空白，非法返回 `null`（是否回退由你决定），而不是抛错

### 色系 `tone`

```js
import { THEME_TONES, TONE_LABELS, isThemeTone, normalizeTone } from 'skinsuite';
```

- `ThemeTone = 'light' | 'dark'` —— **没有** `system`：系别是配色自带的属性，不存在"跟随系统"
- `tone` 不参与渲染（不是 CSS 变量），唯一用途是判断"当前配色与目标明暗是否一致"

### token 安全校验

```js
import {
  isSafeTokenName,
  isSafeTokenValue,
  isSafeTokenEntry,
  sanitizeOverrides
} from 'skinsuite';
import type { ThemeTokenOverrides, SanitizeResult, ThemeTokenLayers } from 'skinsuite';
```

- token 名必须是 `--mauth-<小写短横线>`（避免误伤 `--background` 这类全局变量）
- 取值逐条走**白名单**：`#hex` / `rgb()` / `hsl()` / 长度 / `var(--mauth-*)` / 少量关键字
- `--mauth-font-family` 是唯一的例外（字体栈天然含空格、逗号、引号，且含括号即被拒）
- `sanitizeOverrides(input)` → `{ tokens, rejected }`

详见下方[安全边界](#安全边界)。

### 契约类型（编译期擦除）

```js
import type {
  MauthThemeMeta,
  MauthThemePackage,
  MauthThemeColor,
  MauthThemeRecord
} from 'skinsuite';
```

主题包定义、配色定义，以及注册表里一条已解析好的记录。它们的文档注释就是规格说明（我们会保持注释与实现一致）。

### 设备维度参数

```js
import { DEVICE_SCOPED_PARAMS, readDeviceParam } from 'skinsuite';
import type { DeviceScopedParam } from 'skinsuite';

readDeviceParam(query, name, device);
// `query['<name>.<device>']` → `query[name]` → undefined
```

- query key 里带 `.` 合法，但访问必须用下标：`query['view.standard']`
- **空串 / 纯空白 / 空数组 = 未指定**，不顶掉通用键（部署方习惯把参数留空表示"这台设备不特殊指定"）
- 只决定"取哪个键"，**不做合法性校验** —— 校验需要"当前包里有没有这套东西"的知识，那是宿主的事

---

## 什么不在这个包里

内核不该知道宿主 —— 这条原则是它可复用的全部理由。以下都由**你的适配层**提供：

| 不在包里 | 原因 |
| --- | --- |
| `import.meta.glob` / `import.meta.env` | 构建器专有（webpack 用 `require.context`，测试环境喂数组），同一份内核才能适配多种来源 |
| `document` / `localStorage` / `matchMedia` | DOM 与存储；SSR 与单测需要一个替代实现 |
| Pinia store / 路由 | 应用自己的世界观 —— 路由尤其如此（路径语义、`meta` 约定） |
| 设备取值集合 | `mobile` / `standard` / `mini` 是**某个 app** 的词汇表，不是机制的一部分 |
| 业务资产（`themes/**`） | 版式实现与配色数据是"你的页面长什么样"，随应用走 |

配套的宿主 Vue 适配层（`<ThemeView>` / `<ThemeRoot>` / 状态机 / 设备域）与 Vite 构建插件
已经作为**同包子路径** `skinsuite/vue` 与 `skinsuite/vite` 一起发布 —— 见
[接入指南](./docs/onboarding.md)，不再单发一个包。

### 在自有项目里接入（Vite 示例）

安装后无需任何别名配置：包自带类型声明，`import { … } from 'skinsuite'` 直接可用。
真正要你写的是**一层薄适配**——把本包的纯函数接到你的平台上：

```ts
// src/theme/index.ts —— 你的适配层
import { THEME_ID_RE, sanitizeOverrides } from 'skinsuite';

// ① 主题包：构建期扫出来（Vite 专有，留在宿主）
const packages = import.meta.glob('./themes/*/index.ts', { eager: true });

// ② 写入 DOM：值走本包的白名单，写到哪一层是你自己的活
export function applyTokens(el: HTMLElement, overrides?: Record<string, string>) {
  const { tokens } = sanitizeOverrides(overrides);
  for (const [k, v] of Object.entries(tokens)) el.style.setProperty(k, v);
}
```

要点：**注入的位置由你定，校验的规则由本包给**。这几件事因此能被复用到任何宿主：名称白名单、明暗 / 系别归一、token 安全、设备维度取值链。

---

## 安全边界

CSS 自定义属性是能**直接改变渲染**的输入。未经校验就 `setProperty` 等于把两个口子交给后端或父页面：

- **外发请求**：值里塞一个指向第三方的 `url()` → 可用于探测内网存活、追踪用户
- **样式注入**：值里塞能闭合规则再起新规则的文本 → 注入任意 CSS

所以本包用**白名单**而不是黑名单过滤，并且刻意不放行：

| 不放行 | 原因 |
| --- | --- |
| CSS 颜色名（`red` / `blue`） | 若放宽成"任意字母"，会连带放行 `expression` 这类历史攻击向量 |
| `url()` | 外发请求的唯一入口；背景图/字体请走构建期就存在于仓库里的 `theme.scss` |
| 含 `;` `{}` `<>` 反斜杠、注释、`@import` 的值 | 规则闭合与 @ 规则注入 |

配套约定：**值怎么给**

| 值 | 走哪条路 |
| --- | --- |
| 颜色、圆角、间距、字体族名 | `tokens`（→ `--mauth-*` 变量，过白名单） |
| 背景图、webfont、动画、伪元素、结构级差异 | `theme.scss`（写真实 CSS，选择器带 `html[data-mauth-theme='<id>']` 前缀） |

判据很简单：**必须写 `url()` 或需要伪元素 / keyframes 的，就不能走 token。**

---

## Roadmap

本包当前只包含"纯叶子层"（Stage 1）。迁移是分期的，每期保持宿主侧的导入面不变，任何一期可独立回滚：

| 期 | 内容 | 状态 |
| --- | --- | --- |
| Stage 1 | 常量与白名单、`types`、`tone`、`mode`、设备维度参数、token 形态与校验 | ✅ 已发布 |
| Stage 2 | 版式注册表工厂 + 版式选择器（`defineThemePage` / `createViewPicker`，`?th[_<设备缩写>]` → 包声明 → 当前包） | ✅ 已发布（`skinsuite/vue`） |
| Stage 3 | 配色注册表与回退链（`createColorRegistry` 等） | ✅ 已发布 |
| Stage 4 | store 的纯逻辑（`createThemeState`：URL 意图归一、明暗联动、token 注入） | ✅ 已发布（`skinsuite/vue`） |
| Stage 5 | Vue 适配层 + Vite 构建插件（`skinsuite/vue` / `skinsuite/vite`） | ✅ 已发布 |

> 阶段划分已随机制下沉而完成，上表仅作历史对照。接入方式以 [docs/onboarding.md](./docs/onboarding.md) 为准。

在 1.0 之前（0.x），次要版本可能包含重命名 —— 公开出口是显式具名导出，改名即 semver-minor。

---

## 开发

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/（ESM + .d.ts + sourcemap）
npm test            # 先构建，再用 node:test 跑 dist 产物
```

⚠️ `src/` 里的相对 import **必须带 `.js` 后缀**：包以 `moduleResolution: NodeNext` 编译，TS 会把 `.js` 映射回 `.ts` 源码，而产物里的相对说明符是原样保留的 —— 不带后缀浏览器与 Node 的原生 ESM 都解析不到。

---

## License

[MIT](./LICENSE) © 2026 qirly
