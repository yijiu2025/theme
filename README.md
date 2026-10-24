# skinsuite

多主题 / 多版式机制的实现库：**主题包 × 设备 × 页面 × 配色** 四段键 + 明暗联动 + token 安全校验 + 设备维度 URL 参数。零运行时依赖，Vue / React / Node / SSR 通用。

```bash
npm install skinsuite
```

包分三个入口，按需 import：

| 入口 | 内容 |
| --- | --- |
| `skinsuite` | 纯内核：常量白名单、`mode` / `tone`、token 校验、设备参数解析（无 DOM、无框架依赖） |
| `skinsuite/vue` | Vue 绑定：`createThemeState` 状态机、`<ThemeView>` / `<ThemeRoot>` / `<ThemeScope>`、调试面板 |
| `skinsuite/vite` | 构建插件：`themeAssets()` 扫主题目录生成 `virtual:theme` |

---

## 快速上手（Vue + Vite）

**1. vite.config.ts 挂插件**——零参数，主题目录默认 `src/theme`（可用 env `VITE_THEME_DIR` 改）：

```ts
import { themeAssets } from 'skinsuite/vite';

export default defineConfig({
  plugins: [themeAssets(), vue()]
});
```

**2. 宿主设备清单**——设备是**你的**词汇表（mobile / standard / mini …），一份清单同时供 store（词汇）与页面分发器（容器布线）消费：

```ts
// src/view/devices.ts —— 数组序 = 优先级，末条 = 兜底设备
export const DEVICES = [
  { id: 'mobile', label: '手机端', urlKey: 'mobile' },
  { id: 'standard', label: '桌面端', urlKey: 'std' }
];
```

**3. 装 store + 渲染**：

```ts
import { createThemeState } from 'skinsuite/vue';
import { defineStore } from 'pinia';
import { DEVICES } from '@/view/devices';

export const useThemeStore = defineStore('theme', () =>
  createThemeState({ devices: DEVICES })
);
```

```vue
<ThemeRoot :themeStore="useThemeStore()" />
<ThemeView page="login" device="mobile" :ctx="ctx" />
```

页面分发器按自己的口径（视口 / `?device=`）选设备容器，容器内的 `<ThemeView>` 用 props 告知作用域——**判定在宿主，库只读取渲染**。

完整接入（目录约定、声明文件、路由、验证清单、常见坑）见
[docs/onboarding.md](./docs/onboarding.md)；每个入口的调用链路见
[docs/usage-and-flows.md](./docs/usage-and-flows.md)。

---

## 心智模型

```
themes/<主题包>/<设备>/<页面>/colors/<配色>/
       │          │        │          │
       │          │        │          └─ 配色：一套扁平 token（+ 可选 theme.scss）
       │          │        └──────────── 页面：login / register …（宿主词汇）
       │          └───────────────────── 设备：宿主词汇（mobile / standard / mini …）
       └──────────────────────────────── 一个主题包 = 一种版式
```

| 维度 | 谁定义 | 要点 |
| --- | --- | --- |
| 设备 | **宿主** | 库不认识具体设备名；清单经 `createThemeState({ devices })` 注入，库不自持注册表 |
| 页面 | 宿主 | 每页一份版式组件，只在「当前包 × 当前设备」下查找 |
| 配色 | 主题包 | 自带 `tone`（light / dark）；唯一性作用域 = 同包 × 同设备 × 同页面 |
| 明暗 | 用户偏好 | 与配色正交，经 `tone` 联动：切「暗」落黑系配色，切「明」回白系 |

⚠️ **明暗 ≡ 色系**：明暗切换的本质是「切到哪一系配色」，不是两套规则。

主题包定义与配色定义接受 `index.ts` 或 `index.js`（`.ts` 优先）——纯 JS 项目无需引入 TypeScript。

---

## 内核 API（`skinsuite`）

显式具名导出，表里没有的名字不承诺稳定。

### 常量

| 导出 | 值 | 说明 |
| --- | --- | --- |
| `THEME_ID_RE` | `/^[a-z0-9-]+$/` | 所有 id / 目录名的白名单（会进属性选择器） |
| `DEFAULT_THEME_PACKAGE` | `'default'` | 内置默认包（首屏静态引入） |
| `DEFAULT_THEME_COLOR` / `DEFAULT_THEME_DARK_COLOR` | `'white'` / `'black'` | 默认配色 / 暗系配对值 |
| `DEFAULT_THEME_ID` | `'default'` | 空注册表的占位 id，**不是**默认配色 |
| `BASE_VIEW_ID` | `'base'` | 版式注册表的逻辑 id，不该出现在配色键里 |

### 明暗 mode 与色系 tone

- `ThemeMode = 'system' | 'light' | 'dark'`；`MODE_CYCLE` 切换循环；`normalizeMode(raw)` 非法返回 `null` 不抛错
- `ThemeTone = 'light' | 'dark'`（配色自带属性，无 `system`）；`normalizeTone` 同口径
- `THEME_TONES` / `TONE_LABELS` / `isThemeMode` / `isThemeTone` 辅助判断

### token 安全校验

```js
const { tokens, rejected } = sanitizeOverrides(payload);
```

- 名字必须是 `--mauth-<小写短横线>`；取值走**白名单**（`#hex` / `rgb()` / `hsl()` / 长度 / `var(--mauth-*)`）
- 非法条目**逐条丢弃**（`rejected` 说明原因），不整体拒绝
- 刻意不放行：CSS 颜色名、`url()`、`;` `{}` `<>` 反斜杠、注释、`@import`
- `--mauth-font-family` 是唯一放宽项（字体栈天然含空格逗号引号）

### 设备维度参数

```js
readDeviceParam(query, 'th', 'mobile');
// query['th_mobile'] → query['th'] → undefined（设备专属优先，空串 = 未指定）
```

只决定取哪个键，合法性校验是宿主的事（需要「当前包里有没有」的知识）。

### 契约类型

`MauthThemeMeta` / `MauthThemePackage` / `MauthThemeColor` / `MauthThemeRecord` / `DeviceVocab` 等，文档注释即规格。

---

## 什么不在包里

内核不认识宿主——这是它可复用的前提：

| 不在包里 | 由谁提供 |
| --- | --- |
| `import.meta.glob` / 构建 | `skinsuite/vite` 的 `themeAssets()`（其他构建器写自己的适配） |
| DOM / localStorage / 路由 | 宿主（`skinsuite/vue` 提供 Vue 版默认实现，键名可经 `storageKeys` 覆盖） |
| 设备清单 | 宿主文件 + `createThemeState({ devices })` 注入 |
| 业务资产（`themes/**`） | 随应用走 |

## 安全边界

CSS 自定义属性能直接改变渲染，未校验的 `setProperty` 等于交出两个口子：**外发请求**（`url()` 探测内网 / 追踪）与**样式注入**（闭合规则注入任意 CSS）。所以用白名单过滤。判据：**必须写 `url()` 或需要伪元素 / keyframes 的，走 `theme.scss`（构建期真实 CSS），不走 token。**

## 单例语义（微前端必读）

`installThemeRegistry` / `installThemeManifest` / `installThemeViews` 等是模块级单例，token 注入写 `document.documentElement`。承诺形态：**每个 JS realm + 每份 document = 一个主题域**。

- ✅ 一个 SPA、一个 iframe、SSR 每次渲染：各自独立
- ⚠️ 微前端共享模块实例：后注册整体覆盖先注册，token 注入互清——子应用需各自模块隔离，或只用纯内核自行管理注入
- ⚠️ 同源多应用：localStorage 键与 `th` / `th_color` 参数是共享命名空间，用 `createThemeState({ storageKeys, colorParam, viewParam })` 细分

---

## 开发

```bash
npm run typecheck   # tsc + vue-tsc
npm run build       # tsc → dist/
npm test            # 构建 + node:test（内核 .mjs + vue 层编译产物）
```

- `src/` 相对 import **必须带 `.js` 后缀**（NodeNext 编译，产物原样保留说明符）
- exports 双轨：`types` 指向 `src/`（源码直供防类型双身份），`.` 与 `./vite` 的 `import` 指向 `dist/`，`./vue` 源码形态发布（tsc 编不出 SFC）

0.x 阶段次要版本可能包含重命名（公开出口是显式具名导出，改名即 semver-minor）。

## License

[MIT](./LICENSE) © 2026 qirly
