# Vue 绑定 `skinsuite/vue`

以**源码形态**发布（`.ts` / `.vue` 随包，宿主构建器处理）；宿主需要 vue >= 3.4（optional peer）。

## 装配

### `createThemeState(options?)` — 状态机编排入口

宿主一行 `defineStore` 包起来；返回对象的 ref 会被 pinia 自动解包。

```ts
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import type { DeviceVocab } from 'skinsuite/vue';
import 'virtual:theme';   // 副作用：装配版式表 + 注册表 + 清单

// 设备侧 → 主题侧的唯一耦合点：只投影词汇三字段（id / label / urlKey）
const deviceVocab: DeviceVocab[] = DEVICES.map(({ id, label, urlKey }) => ({ id, label, urlKey }));

export const useThemeStore = defineStore('theme', () =>
  createThemeState({ devices: deviceVocab })
);
```

`ThemeStateOptions`（全可选）：

| 项 | 缺省 | 说明 |
| --- | --- | --- |
| `devices` | `[]` | 设备词汇清单（`DeviceVocab[]`，数组序 = 优先级、末条 = 兜底设备） |
| `storageKeys` | `{ mode:'mauth:mode', theme:'mauth:theme' }` | localStorage 键名（同源多应用隔离） |
| `colorParam` | `'th_color'` | 配色 URL 参数前缀 |
| `viewParam` | `'th'` | 版式 URL 参数前缀 |
| `defaultPage` | `''` | 无路由播种：`activePage` 初始值（token 从首帧可解析） |
| `remoteParams` | 无 | 拉远程主题配置的身份参数 provider（键名宿主定；发请求前才取值） |

返回的 store 公开面（`ThemeStoreLike` 结构契约）：`devices` / `themeId` / `mode` / `isDark` / `activeTone` / `packageId` / `activeDevice` / `activePage` / `activeView` / `deviceViewOf` / `viewFor` / `themeRecordFor` / `setActiveDevice` / `setActivePageView` / `setDeviceView` / `clearDeviceViewOverride` / `setTheme` / `setMode` / `cycleMode` / `toggleTheme` / `applyTheme` / `applyThemeConfig` / `themes` / `lightColor` / `darkColor` / `themeTokens` / `externalTokens` / `dispose()`。

`dispose()` 收全副作用：query watch、调试探针与角标、intent 的 3 watch + 系统偏好监听、runtime 的 3 watch、postMessage 监听、在途远程 fetch（abort）。

### `theme` — Vue 插件

```ts
app.use(theme, { router });   // router 可选（0.9 起无路由应用无参装配）
```

只认 `currentRoute.value.{ query, path, fullPath }` 最小结构；未传 router 时 URL 意图走 `location.search` 一次性快照。

## 组件

| 组件 | 职责 |
| --- | --- |
| `<ThemeRoot :themeStore>` | **provide 点**（必传，否则子组件 inject 抛错）+ 挂 `.dark` 类 + body 底色 token |
| `<ThemeView page device :ctx>` | 渲染某页「当前生效版式」：pick（URL > 声明 > 包名）→ epoch 防抖加载 → 告知 store；`device` prop 即设备身份告知 |
| `<ThemeScope page device>` | token-only 锚点（无路由应用 / 壳层兜底）：只锚作用域，不渲染版式 |
| `<ThemeProvider page device :pkg? :color-id?>` | 钉死 / 并行主题容器：纯查询解析，不读不写全局 store；token 注入到根元素 |
| `<ThemePart id :ctx? :device? :pkg? :color-id?>` | 部件渲染：解析 (包×设备×partId)，**绝不碰全局作用域**；`color-id` 作用域注入 |
| `<ThemeDebugPanel />` | 调试面板门卫（零接线；清单开关 + 触发参数决定要不要下载主体） |

## Composables

| 导出 | 说明 |
| --- | --- |
| `useThemeDebugPanel()` | 面板适配器：从 store / 页面域 / 内核注册表自动组装 `model` + `actions`（宿主零接线） |
| `useThemeSources({ applyThemeConfig, applyTheme, remoteParams? })` | 主题意图来源接入：父 postMessage 同步 + 后端配色拉取（端点读 env）；返回 cleanup 供 dispose |
| `useParentThemeSync({ isAllowedOrigin, apply, applyDark? })` | postMessage 协议解析与分发（`THEME_CHANGE` 新旧协议；origin 白名单宿主参数）；返回 cleanup |
| `useScopedTheme(recordRef, elRef)` / `resolveScopedRecord(params)` | 作用域注入半边（ThemeProvider / ThemePart 共用）：解析纯查询 + 注入到任意元素 + 差集清理 |

## Token 运行时（DOM 注入半边）

| 导出 | 说明 |
| --- | --- |
| `applyThemeLayers(layers, { target? })` | 分层注入（theme 在前 external 在后，同名后者胜）+ 按目标差集清理；返回 rejected |
| `applyThemeTokens(overrides)` | 等价 `applyThemeLayers({ external })` |
| `clearThemeTokens(target?)` | 摘掉某目标上一次注入的全部主题变量（缺省全局） |
| `getInjectedTokenNames(target?)` | 某目标当前已注入的变量名（验收 / 单测断言用） |

缺省注入 `document.documentElement`；传 `{ target: el }` 注入任意元素（各目标注入名单 WeakMap 分账，互不串台）。

## 注册表（版式 / 页面 / 部件）

| 导出 | 说明 |
| --- | --- |
| `defineThemePage({ page })` | 页面契约唯一写法（页面文件一行声明；`views/<page>.ts` 纯声明无逻辑） |
| `pageOf(name)` / `registeredPageNames()` / `isThemePage(v)` | 页面域查询 |
| `createViewRegistry(loaders, options)` / `createViewPicker({ registry })` | 版式注册表 / 选择器工厂（一般经 `defineThemePage` 间接使用） |
| `installThemeViews(views)` / `themeViewsFor(page)` | 版式加载表单例（`virtual:theme` 自动装配） |
| `installThemeParts(parts)` / `themePartsFor(id)` | 部件加载表单例 |

## 设备域（URL 通道）

| 导出 | 说明 |
| --- | --- |
| `currentQuery()` | 当前路由 query；未装 router 回退 `location.search` 一次性快照 |
| `replaceQuery(patch)` | 替换 query（保留既有业务参数，只增删目标项）；无 router 时 no-op |
| `installThemeDomain({ router })` | 装配（`app.use(theme, { router })` 内部调用） |

## 远程取数

| 导出 | 说明 |
| --- | --- |
| `fetchRemoteThemeConfig({ endpoint, params?, timeoutMs?, omitCredentials?, signal? })` | 取数骨架：`params` 任意键名身份参数（空值不发送）；默认 3s 超时 + 无 cookie；一切失败静默 null |
| `isRemoteThemeEnabled(endpoint)` | 端点非空 = 启用 |

## 调试

| 导出 | 说明 |
| --- | --- |
| `ThemeDebugModel` / `ThemeDebugActions` / `ThemeDebugColor` | 面板数据契约（自建面板壳时用） |
| `skinsuite/vue/panel` | 面板独立入口（专供 `defineAsyncComponent`，保证 chunk 切分；宿主一般不必直接用——`<ThemeDebugPanel />` 已内置门卫） |

dev 探针 `window.__MAUTH_STORE__` 由 `createThemeState` 自动挂载（见[调试](/guide/debug)），无需接线。
