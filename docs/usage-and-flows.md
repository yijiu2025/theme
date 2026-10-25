# skinsuite 完整使用示例与入口函数流程手册

> 版本：0.10.x · 2026-10-25
> 面向：要给任何前端（Vue + Vite 为主，也含无路由 / Node 脚本）接 `skinsuite`，并且想**逐函数**
> 知道"从哪来、到哪去、存了什么、什么格式"的读者。
> 前置：先读 `docs/onboarding.md`（接入步骤）与 `README.md`（心智模型）。本手册是**流程视角**的
> 全量索引：每个公开入口都给了链路、写入位置与数据格式。

---

## 〇、三个入口总览

| 入口 | 发布形态 | 里面是什么 | 谁 import |
|---|---|---|---|
| `skinsuite` | `dist/index.js`（编译产物） | 纯内核：常量、类型、token 校验、注册表构建/查询、URL 参数解析、清单 | 任何地方（Node / 单测 / 任意框架） |
| `skinsuite/vue` | `src/vue/index.ts`（源码直供，SFC 随包） | Vue 绑定：组件（ThemeRoot/ThemeView/ThemeScope/ThemeProvider/ThemePart/调试面板）+ 状态机 + DOM 注入 + 设备/页面/版式/部件域 | Vue 应用 |
| `skinsuite/vite` | `dist/vite/index.js`（编译产物，types 直供源码） | 构建插件 `themeAssets` + 目录常量 | `vite.config.ts` |

> 记忆点：**纯内核零 DOM 零依赖；vue 层才碰 DOM/store；vite 层才碰文件系统与 import.meta.glob。**

---

## 一、完整使用示例

### 1.1 路由版（对标 oauth21）

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { themeAssets } from 'skinsuite/vite';

export default defineConfig({
  // 目录缺省 = env VITE_THEME_DIR（无 env 则 src/theme），插件在 configResolved 自解析
  plugins: [themeAssets(), vue()]
});
```

```env
# .env（可省，缺省 src/theme）
VITE_THEME_DIR=src/theme
```

```ts
// src/stores/theme.ts —— 宿主壳 + 副作用装配（一行 import 触发全部装配）
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import 'virtual:theme'; // 🔴 副作用：装注册表/版式表/部件表/清单 + 拉齐 views/*.ts 声明

export const useThemeStore = defineStore('theme', () =>
  createThemeState({ devices: DEVICES })
);
```

```ts
// src/bootstrap.ts
import { theme } from 'skinsuite/vue';

app.use(createPinia());
app.use(router);
app.use(theme, { router }); // 路由型：递 router（版式意图随路由同步）
router.isReady().then(() => app.mount('#app'));
```

```vue
<!-- src/App.vue -->
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

```ts
// src/view/devices.ts —— 设备清单（宿主事实；顺序 = 优先级，末条兜底，
// 经 createThemeState({ devices }) 注入 store，容器布线宿主自持）
import type { Component } from 'vue';
import type { DeviceVocab } from 'skinsuite/vue';

export interface HostDeviceDef extends DeviceVocab {
  containers: ReadonlyMap<string, () => Promise<{ default: Component }>>;
}

function containerMap(glob: Record<string, () => Promise<{ default: Component }>>) {
  const map = new Map<string, () => Promise<{ default: Component }>>();
  for (const [path, loader] of Object.entries(glob)) {
    const page = path.split('/').at(-2);
    if (page) map.set(page, loader);
  }
  return map;
}

export const DEVICES: readonly HostDeviceDef[] = [
  { id: 'mobile', label: '手机端', urlKey: 'mobile',
    containers: containerMap(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue')) },
  { id: 'standard', label: '桌面端', urlKey: 'std',
    containers: containerMap(import.meta.glob<{ default: Component }>('/src/view/web/*/Standard*.vue')) }
];
```

```ts
// src/theme/views/login.ts —— 页面契约 + 版式 ctx 类型
import { defineThemePage } from 'skinsuite/vue';

export interface LoginViewProps { ctx: { /* 表单字段 + actions */ } }
defineThemePage({ page: 'login' });
```

```
src/theme/
├── theme.config.ts                          # defineThemeManifest({ debug: { enabled: 'url' } })
├── views/                                   # 页面契约（副作用模块）
└── themes/default/standard/login/
    ├── index.vue                            # 版式（一页一版式，default 包 eager）
    └── colors/white/{ index.ts, theme.scss } # 配色（meta + tone + tokens）
```

```vue
<!-- 页面容器（业务逻辑唯一一份） -->
<script setup lang="ts">
import { ThemeView } from 'skinsuite/vue';
import type { LoginViewProps } from '@/theme/views/login';
const ctx = computed<LoginViewProps['ctx']>(() => ({ /* ... */ }));
</script>
<template>
  <ThemeView page="login" device="standard" :ctx="ctx" />
</template>
```

```vue
<!-- 弹窗：行为唯一一份 + 部件实现随包换 -->
<Teleport to="body">
  <div v-if="open" class="modal-mask" @click.self="ctx.onCancel">
    <ThemePart id="confirm-modal" :ctx="ctx" />
  </div>
</Teleport>
<!-- 钉死配色的悬浮窗（不随全局换肤） -->
<ThemeProvider page="app" device="standard" color-id="black">
  <FloatingQuickPanel />
</ThemeProvider>
```

### 1.2 无路由版（纯 UI 壳 / 工具页 / 嵌入式小组件）

```ts
// bootstrap.ts：app.use(theme) 无参；无 router
app.use(createPinia());
app.use(theme);
app.mount('#app');
```

```vue
<!-- App.vue：ThemeScope 是 token-only 锚点 -->
<ThemeRoot :theme-store="themeStore">
  <ThemeScope page="app" device="standard">
    <ModalHost /> <MessageToast />
  </ThemeScope>
</ThemeRoot>
```

```ts
// store：defaultPage 播种——ThemeScope 挂载前 token 也能解析
export const useThemeStore = defineStore('theme', () =>
  createThemeState({ defaultPage: 'app' })
);
```

主题目录里给壳层建一个普通页面目录即可（`themes/default/standard/app/colors/...`），零新增概念。

---

## 二、运行流程总览（首屏到切肤，一次看全）

```
vite build/dev
  └─ themeAssets() 插件
       ├─ configResolved  → 记 root
       ├─ resolveId('virtual:theme') → '\0virtual:theme'
       └─ load  → scan(dir)（递归 themes/ + views/ 声明）
                  → render() 生成虚拟模块源码（见 §五）
                        ↓
store 文件 import 'virtual:theme'（模块求值期副作用）
  ├─ installThemeViews(themeViews)   → 版式加载表单例
  ├─ installThemeParts(themeParts)   → 部件加载表单例
  ├─ installThemeRegistry(buildThemeRegistry({packages,colors,styles}))
  │                                     → Map<'pkg/device/page/colorId', record>
  └─ installThemeManifest(resolveThemeManifest(__manifest)) → 清单单例

bootstrap.ts
  └─ app.use(theme, { router? }) → installThemeDomain → 记 routerRef（或走 location.search 快照）

App.vue 渲染 <ThemeRoot :theme-store> → provide(themeStoreKey, store)

<ThemeView page device :ctx>（页面容器内）
  ├─ viewId = pick(url 意图 → 包声明 → 当前包)
  ├─ setActivePageView(page, viewId)   → activePage / activeView
  ├─ setActiveDevice(device)           → activeDevice
  └─ views.load(id, pkg, device) → epoch 防抖 → 渲染版式组件

<ThemePart id :ctx>（弹窗等，P1b）
  ├─ pkg = store.packageId（只读）/ device = store.activeDevice（只读）
  ├─ themePartsFor(id) → 当前包 loader else default eager
  ├─ epoch 防抖 → 渲染部件实现（🔴 不写 store 作用域）
  └─ color-id 给了 → resolveScopedRecord + useScopedTheme → 根元素注入

createThemeState()（store 创建）
  ├─ scope：读 URL（配色 location.search / 版式 currentQuery）→ 播种 refs
  ├─ intent：mode=readInitialMode；matchMedia 监听；三 watch 联动
  ├─ runtime：三个 watch（immediate）→ 首屏即注入
  ├─ watch(currentQuery) → URL 版式意图变化同步进 store
  └─ installThemeDebug（dev 探针 + 静默失败警告）

runtime 注入链（每次作用域变化）
  [themeId,deviceTheme,activeDevice,activePage,activeView] 变
    → id = deviceTheme[device] ?? themeId
    → getThemeRecord({id, device, pkg: activeView, page: activePage})
    → html.dataset.mauthTheme = id；themeTokens = record.tokens；loadThemeStyle()
  [themeTokens, externalTokens, activeDevice, isDark] 变
    → html.classList.toggle('dark', isDark)
    → applyThemeLayers({theme, external}) → html 上写 --mauth-* inline style
```

---

## 三、纯内核 `skinsuite` 入口逐个流程

### 3.1 注册表：`buildThemeRegistry` / `installThemeRegistry` / 查询族

**`buildThemeRegistry(modules, onWarn?)`**
- 输入：`modules = { packages, colors, styles }`（`virtual:theme` 的三张表，见 §五）
- 流程：包定义键 `./<包>/index.ts` 取包名 → 记 `packageViews`（包级版式声明）→ 配色键
  `./<包>/<设备>/<页面>/colors/<配色>/index.ts`（或部件键 `…/parts/<部件id>/colors/<配色>/index.ts`）
  解析四段 → 校验目录名白名单 + 包存在 + tone → 生成 record → `styles` 同键挂 `loadStyle`
- 输出：`Map<string, MauthThemeRecord>`；重名（同包×设备×页×配色）先到先得并 `onWarn`
- **保存的键格式**：`"${pkg}/${device}/${page}/${colorId}"`；部件配色 page 段 = `"part:<partId>"`

```ts
// MauthThemeRecord 保存格式
{
  pkg: 'default', device: 'standard', page: 'login',
  meta: { id: 'white', name: '白', description?, preview?, author? },
  tone: 'light' | 'dark',
  tokens: { '--mauth-bg': '#f8fafc', ... } | undefined,   // 未做安全校验，注入时统一过白名单
  views: { login: 'default' } | undefined,
  loadStyle: () => Promise<string> | undefined             // theme.scss ?inline 懒加载
}
```

**`installThemeRegistry(registry)`** — 把构建好的 Map 装入模块级单例（查一次，此后全库查询函数读它）。

**查询族（读单例，回退链从高到低）**

| 函数 | 流程（从哪到哪） | 返回格式 |
|---|---|---|
| `getThemeRecord({id,device,pkg,page})` | 精确四段键 `Map.get` → 同 id 同包兜底 → 跨包回 default 包 → 同系别首套 → 该范围兜底色（white 优先）→ 空记录 | `MauthThemeRecord` |
| `getDefaultThemeId({device,page,pkg})` | 该范围 id 清单（索引预排序）→ 有 `white` 用 white，否则字母序第一，空则 null | `string \| null` |
| `listThemes(device?)` | 全表（或按设备索引）→ map 出 meta | `MauthThemeMeta[]` |
| `listColorsOf(device,page,pkg)` | 该范围记录按 id 去重 → `localeCompare` 排序 | `MauthThemeMeta[]` |
| `toneOfColor(id,device,page,pkg)` | `findRecord(...)?.tone ?? null` | `'light'\|'dark'\|null` |
| `toneOfAnyScope(id)` | 该 id 的全部登记处**路径序第一份**的 tone | 同上 |
| `listColorIdsOfTone(device,page,pkg,tone)` | 该范围按 tone 过滤去重排序 | `string[]` |
| `resolveThemeId(raw,device?,page?,pkg?)` | trim+小写+白名单 → id 候选（按 meta.id 索引）→ 可选段过滤 | `string \| null` |
| `isKnownTheme(id,...)` | 包装 `resolveThemeId` | `boolean` |
| `listColorViews(device,page)` | 该设备×页下登记过配色的包集合，排序 | `string[]` |

> 索引说明（0.8.0 起）：以上查询由 WeakMap 按注册表实例缓存的**惰性索引**服务（O(n) 全表扫描
> → O(k)），`installThemeRegistry` 换表自动失效；精确四段键仍走 `Map.get`。

### 3.2 token 安全校验：`sanitizeOverrides` / `isSafeToken*`

- **流程**：输入 `ThemeTokenOverrides`（`Record<'--mauth-*', string>`）→ 逐条过
  `isSafeTokenEntry`（名白名单 `--mauth-[a-z0-9-]+` + 值白名单：hex/rgb/hsl/长度/var() 引用/
  关键字，字体族特例放宽；**拒 url()、颜色名、`;{}<>`、注释、@import**）→ 合法项 trim 收进
  `tokens`、非法项进 `rejected`（`"name=value前40字符"` 格式供上报告警）
- **输出格式**：`{ tokens: Record<string,string>, rejected: string[] }`。逐条丢弃而非整体拒绝。

### 3.3 URL 参数：`readDeviceParam` / `readUrlViewIntent` / `viewParamsSnapshot` / `sameViewSnapshot`

| 函数 | 流程 | 返回格式 |
|---|---|---|
| `readDeviceParam(query,name,deviceKey)` | `query['<name>_<deviceKey>']` 存在且非空 → 用它；否则 `query[name]`；都没有 undefined | `unknown`（原样不校验） |
| `readUrlViewIntent(query,viewParam='th',devices)` | 每台设备读 `th_<urlKey>`（非空字符串才算）进 `deviceView`；通用键 `th` 原样进 `viewIntent`（**不下发**到每台） | `{ deviceView: Partial<Record<string,string>>, viewIntent: string \| null }` |
| `viewParamsSnapshot(query,...)` | 白名单收 `th` + `th_<urlKey>`（配色键 `th_color*` 不进——防误触发版式同步） | `Record<string,unknown>` |
| `sameViewSnapshot(a,b)` | 键集合 + 各键原始值全等 | `boolean` |

口径：**空串 = 未指定**；重复键（数组）版式侧按未指定、配色侧取首值。

### 3.4 静默失败审计：`parseThemeParams` / `collectWarnings` / `effectiveViewRaw`

- **`parseThemeParams(query)`**：白名单六键（`th` / `th_color` / `device` / `debug` + 设备专属
  `th_<urlKey>`）归位；重复键进 `repeated`（带首值）；空串归一 null。
- **`collectWarnings(params, ctx)`**：检四类静默失败——未知 `?device=`、当前设备版式值不存在、
  其它设备专属键不存在、白名单键重复。返回人类可读警告 `string[]`（空 = 没问题）。
- **`effectiveViewRaw(params, urlKey)`**：`th_<urlKey> ?? th ?? null`（与读取侧同口径）。

### 3.5 远程配置归一：`normalizeRemoteThemeConfig`

- **流程**：非对象/数组 → null；`theme`(string) / `mode`(经 normalizeMode) / `tokens`(object)
  三字段各自取用；**全空返回 null**。只归一形状，不碰网络（取数是 `skinsuite/vue` 的事）。

### 3.6 清单：`defineThemeManifest` / `resolveThemeManifest` / `installThemeManifest` / `themeManifest` / `isThemeDebugVisible`

- **`defineThemeManifest(manifest?)`**：补默认 `debug = { enabled:'url', query:'debug', value:'theme' }`；
  非法档位/空键名直接 throw（配置错误启动期就炸）。
- **`resolveThemeManifest(manifest?)`**：null/undefined → `defineThemeManifest({})` 兜底。
- **`installThemeManifest(m)` / `themeManifest()`**：装入/读取模块级单例（`virtual:theme` 自动装配）。
- **`isThemeDebugVisible(debug, query)`**：off→false；always→true；url→`query[query键]` 任一元
  素 === value（支持数组，对齐 vue-router `LocationQuery`）。

### 3.7 明暗/系别：`normalizeMode` / `normalizeTone` 等

- `normalizeTone(raw)`：字符串 trim+小写，`'light'|'dark'` 命中返回，否则 null。
- `normalizeMode(raw)`：同上，`'system'|'light'|'dark'`。

---

## 四、Vue 绑定层 `skinsuite/vue` 入口逐个流程

### 4.1 插件与设备域：`theme` / `installThemeDomain` / `currentQuery` / `replaceQuery`

- **`app.use(theme, { router? })`** → `installThemeDomain({ router })`：
  **保存** `routerRef`（模块级，路由型应用一个）。无 router 时**不装**。
- **`currentQuery()`**：有 routerRef → `currentRoute.value.query`（响应式）；
  无 → **装载时读一次** `window.location.search`（重复键折叠成数组），**保存**模块级快照
  `routerlessQuery`，之后一直返回同一份（无路由应用 URL 不变）。
- **`replaceQuery(patch)`**：保留既有业务 query（授权上下文等），增删目标项后 `router.replace({query})`；
  无 router 或未实现 replace 则 no-op（Q4：不警告，无路由应用本就不该改 URL）。

### 4.2 状态机：`createThemeState(options?)` —— 总装配

- **输入**：`{ devices?, remoteParams?, storageKeys?, colorParam='th_color', viewParam='th', defaultPage='' }`
  （`devices` = 宿主设备清单 `DeviceVocab[]`，数组序 = 优先级、末条 = 兜底设备；
  `remoteParams` = 拉远程主题配置的身份参数 provider，键名宿主决定）
- **内部链**（顺序敏感）：

```
① useThemeScope(keys, colorParam, viewParam, defaultPage, devices)
    读 URL 意图 → refs 播种：
      deviceTheme = {...urlIntent.deviceTheme}        // URL 按设备显式指定的配色
      themeId     = urlIntent.deviceTheme[fallback]   // 全局配色意图
                    ?? readInitialTheme(keys)
      deviceView / viewIntent = 版式意图（URL 一次读入）
      activeDevice = devices 清单末条              // 兜底设备（未注入时空串）
      activePage   = defaultPage                      // 🔴 P0 播种
      activeView   = 'default'
    派生 computed：activeRecord → isDark / activeTone / packageId
    方法：setActiveDevice / setActivePageView / themeRecordFor / viewFor /
          deviceViewOf / setDeviceView / clearDeviceViewOverride / syncUrlViewIntent …

② useThemeIntent(scope, keys)
    mode = readInitialMode(keys)
    systemDark = matchMedia('(prefers-color-scheme: dark)').matches，addEventListener
    记忆槽 lightColor/darkColor（会话级，不落盘）
    watch(activePage, immediate) → 首屏对齐系别
    watch(mode) / watch(systemDark) → 明暗≡色系联动 syncColorToTone
    方法：setMode/cycleMode/toggleTheme/setTheme/applyTheme/dispose

③ useThemeRuntime(scope, intent)
    themeTokens = scope.themeRecordFor().tokens ?? null；externalTokens = null
    watch① 注入：classList.toggle('dark') + applyThemeLayers({theme,external})
    watch② 记录：dataset.mauthTheme + themeTokens=record.tokens + loadThemeStyle(epoch 防串台)
    watch③ 切版式：activeView 变且该设备未被 URL 锁定 → themeId 落到新包兜底色
    applyThemeConfig(config)：外部配色/明暗/tokens 合入（不落盘）
    disposeSources = useThemeSources({applyThemeConfig, applyTheme})

④ watch(() => currentQuery(), () => scope.syncUrlViewIntent(), {deep:true})
    —— URL th* 原始值变化才重新读入（快照判等，debug 改写不碰 URL 不会被误冲）

⑤ installThemeDebug(scope, intent) —— dev 探针 + 静默失败警告（返回值已接入 dispose）

⑥ 返回公开面（ref 会被 pinia 解包；直接调用时是裸 ref，断言读 .value）
```

- **`dispose()`**：stop query watch → disposeDebug → intent.dispose（matchMedia+3 watch）→
  runtime.dispose（3 watch + postMessage + abort 在途 fetch）。二次调用幂等。

### 4.3 持久化：`readInitialMode` / `readInitialTheme` / `readUrlIntent` / `safeGet` / `safeSet`

| 函数 | 读什么（按序） | 回退 | 保存的格式 |
|---|---|---|---|
| `readInitialMode(keys)` | `mauth:mode` → 旧 `theme` | 非法/缺失 → `'system'` | `'system'\|'light'\|'dark'` |
| `readInitialTheme(keys)` | `mauth:theme` → 旧 `theme-id` | 非法/缺失 → `'default'`（占位） | 配色 id 字符串 |
| `readUrlIntent(colorParam)` | `location.search` 里 `th_color_<urlKey>` → `th_color` | 无 → 该设备不锁定 | `{ deviceTheme: Partial<Record<deviceId, colorId>> }` |

- **`safeSet` 落盘格式**：`localStorage['mauth:mode'] = 'dark'`、`localStorage['mauth:theme'] = 'blue'`。
  旧键 `theme` / `theme-id` **只读不写**（同源可能属于别的应用）。

### 4.4 DOM 注入：`applyThemeLayers` / `applyThemeTokens` / `clearThemeTokens` / `getInjectedTokenNames`

- **`applyThemeLayers(layers, { target? })`**：
  1. `sanitizeOverrides` 校验两层（theme 层在前、external 层在后，同名后者胜）；
  2. 与该 target 上一轮的注入名单做**差集清理**（只摘自己写过的变量名）；
  3. 逐条 `target.style.setProperty('--mauth-x', v)`；
  4. 名单写回 WeakMap（按 target 分账），返回被拒条目。
- **保存格式**：DOM 元素的 `style.cssText` 里的 `--mauth-*: 值;`；名单在模块级
  `WeakMap<HTMLElement, string[]>`（元素销毁随 GC）。缺省 target = `document.documentElement`。

### 4.5 组件逐个流程

**`<ThemeRoot :themeStore>`**
- 流程：`provide(themeStoreKey, store)`（子树 inject 用）→ `isDark` computed → 渲染
  `div.dark` 壳 + `--mauth-bg/--mauth-text` 底色。**只读 store，不写。**

**`<ThemeView page device :ctx>`**（页面容器内）
- 流程：`pageOf(page)` 取页面（未注册 throw）→ `inject` store → `viewId = pick({url: deviceViewOf, theme: viewFor, pkg: packageId, device})` → `setActivePageView(page, viewId)` + `setActiveDevice(device)`（immediate watch）→ `views.load(id, pkg, device)` epoch 防抖 → 渲染版式组件。
- 保存：store 的 `activePage` / `activeView` / `activeDevice`（全局作用域三元组）。

**`<ThemeScope page device>`**（P0，token-only 锚点）
- 流程：`viewId = deviceViewOf(device) ?? viewFor(page,device) ?? 'default'` →
  `setActivePageView(page, viewId)` + `setActiveDevice(device)` → 渲染 `<slot/>`。
- 与 ThemeView 的差：不查页面注册表、不加载版式组件、无 ctx。

**`<ThemeProvider page device :pkg? :color-id?>`**（P1a，钉死/并行主题）
- 流程：`resolveScopedRecord({page,device,pkg,colorId})`（**纯查询不碰 store**）→
  `useScopedTheme(record, rootEl)` → 根元素注入 token + `data-mauth-theme` + `.dark` 类 →
  `onUnmounted` 精确清理。保存位置：**该组件根元素**（非 html 根）。

**`<ThemePart id :ctx? :device? :pkg? :color-id?>`**（P1b，主题化部件）
- 流程：`pkg = props.pkg ?? store.packageId`（只读）→ `device = props.device ?? store.activeDevice`（只读）
  → `themePartsFor(id)` 取该部件的加载表 → 当前包有专属实现则加载（epoch 防抖），否则 default eager
  兜底 → 渲染 `<component :is="activePart" :ctx="ctx">`；`color-id` 给了 → 以 `page = 'part:<id>'`
  走 `useScopedTheme` 注入根元素。**不写 store 作用域**（不 setActivePageView/Device）。
  当前包与 default 都没有该部件：dev 警告 + 渲染为空。

**调试面板族**（`ThemeDebugPanel` / `useThemeDebugPanel` / `theme-debug` 探针）
- 门卫 `ThemeDebugPanel`：`isThemeDebugVisible(themeManifest().debug, currentQuery())` 决定是否
  `defineAsyncComponent(import './ThemeDebugPanelBody.vue')`（off/无参数连 chunk 都不下载）。
- 适配器 `useThemeDebugPanel()`：从域自动取 store/设备/页面/配色清单，出 `model` + `actions`。
- 探针 `installThemeDebug`：dev 无条件喊 URL 静默失败；清单门控命中时挂 `window.__MAUTH_STORE__`
  + 右下角角标；返回 dispose（createThemeState 已接住）。

### 4.6 域注册：`defineThemePage` / `installThemeViews` / `installThemeParts`

| 入口 | 流程 | 保存 |
|---|---|---|
| `defineThemePage({page})` | `createViewRegistry(() => themeViewsFor(page), {page})` + picker，标记 PAGE_BRAND 后 `registeredPages.set(page)` | 模块级 `Map<page, ThemePage>` |
| `pageOf(name)` / `registeredPageNames()` | 从 registeredPages 查 | — |
| `installThemeViews(views)` / `themeViewsFor(page)` | virtual:theme 装入 / 按页取加载表 | 模块级 `Record<page, ViewModuleMap>` |
| `installThemeParts(parts)` / `themePartsFor(id)` | virtual:theme 装入 / 按部件 id 取加载表 | 模块级 `Record<partId, PartModuleMap>` |

> 设备清单**不是**域注册：词汇经 `createThemeState({ devices })` 装配期注入 store
> （数组序 = 优先级、末条 = 兜底），容器布线由宿主清单文件自持 —— 库不自持设备注册表
> （0.9.0 起注入化，`defineThemeDevice` 等注册 API 已退役）。

### 4.7 来源同步：`useThemeSources` / `fetchRemoteThemeConfig` / `useParentThemeSync` / `useScopedTheme` / `resolveScopedRecord`

- **`useThemeSources({applyThemeConfig, applyTheme, remoteParams?})`**：读 env
  （`VITE_ALLOWED_PARENT_ORIGINS` / `VITE_THEME_ENDPOINT`）→ 有白名单就 `useParentThemeSync`
  （postMessage `THEME_CHANGE`，origin 校验后 `apply/applyDark`）；有端点就 `fetchRemoteThemeConfig`
  （3s 超时 + AbortController + credentials omit + `remoteParams` 注入的身份参数，键名宿主决定）
  → `applyThemeConfig`。返回 cleanup（摘监听 + abort 在途 + disposed 标志兜迟到响应）。
- **`resolveScopedRecord({page,device,pkg?,colorId?})`**：纯查询——`colorId ?? getDefaultThemeId(...)`
  → `getThemeRecord`；指定 colorId 落空 dev 警告。返回 `MauthThemeRecord`。
- **`useScopedTheme(recordRef, elRef)`**：watch 记录 → 注入 token / `data-mauth-theme` / `.dark`
  到 el；record 为 null 时**清理并回到继承全局档**；返回 cleanup。

---

## 五、构建层 `skinsuite/vite` 入口流程

### 5.1 `themeAssets({ dir?, moduleId?='virtual:theme', manifestFile?='theme.config.ts' })`

- **流程**：`configResolved` 记 root（未显式传 `dir` 时：用 `config.env.VITE_THEME_DIR`，
  缺省 `src/theme`）→ `resolveId('virtual:theme')` → `\0virtual:theme` →
  `load(id)`：`isDir(dir)` 否 → `EMPTY_MODULE`；是 → `scan(dir)` + `render()` 生成模块源码。
- **`scan(dir)` 流程**：`dir/themes/<包>/` 循环 → 包定义 `index.ts` → `walk()` 按
  `THEME_DIR_LEVELS` 递归「设备→页面」→ 页面层收 `index.vue`（版式）+ `colors/<配色>/{index.ts,theme.scss}`；
  **设备层拦 `parts/` 段** → `collectParts` 收 `parts/<部件id>/{index.vue, colors/*}`；
  再收 `dir/views/*.ts`（页面契约，副作用 import）。
- **`render()` 产出（`virtual:theme` 模块内容，保存格式）**：

```ts
// 资产键相对 themes/ 目录（./ 开头）
export const packages   = { './default/index.ts': Module };                       // 包定义（模块命名空间）
export const colors     = { './default/standard/login/colors/white/index.ts': Module };
export const styles     = { './default/…/white/theme.scss': () => Promise<string> }; // ?inline 惰性
export const themeViews = { login: { './default/standard/login/index.vue': loader } }; // default eager
export const themeParts = { 'confirm-modal': { './default/standard/parts/confirm-modal/index.vue': loader } };
export const themeManifest = ResolvedThemeManifest;   // resolve 后恒非 null
// 模块体副作用（import 即执行）：
installThemeViews(themeViews); installThemeParts(themeParts);
installThemeRegistry(buildThemeRegistry({ packages, colors, styles }));
installThemeManifest(themeManifest);
```

- **dev HMR**：`configureServer` 里 `watcher.add(dir)`（root 外目录也监听）+ add/unlink/addDir/unlinkDir
  四事件（路径归一比较 + 前缀带分隔符防误匹配）→ 失效虚拟模块 + full-reload。

### 5.2 `virtual:theme` 的类型（`theme.d.ts`）

随 `skinsuite/vite` 发布，宿主 `vite-env.d.ts` 里 `import 'skinsuite/vite'` 带入程序；不必自写。

---

## 六、数据保存格式汇总表（速查）

| 数据 | 位置 | 格式 |
|---|---|---|
| 明暗意图 | `localStorage['mauth:mode']` | `'system' \| 'light' \| 'dark'` |
| 配色偏好 | `localStorage['mauth:theme']` | 配色 id（`'white'` / `'blue'`…） |
| 旧键回退 | `localStorage['theme']` / `['theme-id']` | 同值；只读不写 |
| token 注入 | `<html>`（或作用域元素）`style` | `--mauth-*: 值;` 逐条 inline |
| 注入名单 | `WeakMap<HTMLElement, string[]>` | 各目标自己写过的变量名 |
| 生效配色标识 | `<html>.dataset.mauthTheme`（或作用域元素） | 配色 id 字符串 |
| 暗色开关 | `<html>.classList` 的 `dark`（或作用域元素） | 布尔 |
| 配色注册表 | 模块级 `Map` | 键 `pkg/device/page/colorId`，值 `MauthThemeRecord` |
| 查询索引 | `WeakMap<Map, RegistryIndex>` | byColorId / byScope / sortedIds / byDevicePage / byDevice |
| 版式加载表 | 模块级 `Record<page, ViewModuleMap>` | 键 `./pkg/device/page/index.vue`，值 loader |
| 部件加载表 | 模块级 `Record<partId, PartModuleMap>` | 键 `./pkg/device/parts/partId/index.vue`，值 loader |
| 清单 | 模块级单例 | `{ debug: { enabled, query, value } }` |
| 设备清单 | store 装配期注入（`createThemeState({ devices })`） | `DeviceVocab[]`，数组序 = 优先级、末条 = 兜底 |
| 页面域 | 模块级 `Map<page, ThemePage>` | page → { page, views, pick } |
| 路由引用 | 模块级 `routerRef` / `routerlessQuery` | vue-router 实例 / location.search 快照对象 |
| 父应用同步 | `window` message 事件 | `{ type:'THEME_CHANGE', isDark?, theme?, tokens? }`，origin 白名单 |
| 后端配置 | fetch JSON | `{ theme?, mode?, tokens? }`，`normalizeRemoteThemeConfig` 归一 |
| URL 参数 | `location.search` / `route.query` | `th`、`th_<urlKey>`、`th_color`、`th_color_<urlKey>`、`device`、`debug` |

---

## 七、一个请求/切换的完整时序（示例：点色卡切到 blue）

```
1. 调试面板 pickColor('blue') → store.setTheme('blue')
2. setTheme：resolveThemeId('blue') 校验已登记
   → scope.clearDeviceThemeOverride()          # 清当前设备 URL 覆盖
   → scope.themeId.value = 'blue'              # 全局配色意图
   → safeSet('mauth:theme', 'blue')            # localStorage 落盘
   → toneOfAnyScope('blue') = 'light' → mode 同步 'light' + safeSet('mauth:mode','light')
3. runtime watch② [themeId,…] 触发：
   id = deviceTheme[device] ?? 'blue'
   record = getThemeRecord({id:'blue', device, pkg:activeView, page:activePage})
   html.dataset.mauthTheme = 'blue'
   themeTokens.value = record.tokens
   loadThemeStyle('blue', …) → theme.scss ?inline → <style id="mauth-theme-css"> 替换
4. runtime watch① [themeTokens, …] 触发：
   isDark = record.tone==='dark' → html.classList.toggle('dark', false)
   applyThemeLayers({theme: tokens}) → 差集清理旧变量 → 写入新 --mauth-* inline style
5. （若有 ThemeProvider/ThemePart 钉死作用域）它们不读 store.themeId，纹丝不动。
```
