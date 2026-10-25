# 仓库结构与文件说明

> 本文件是 `skinsuite` 每个源码文件的**职责地图**。读代码前先看这里定位；
> 每个文件的头部注释有更细的设计要点与约束，本表只回答「它是干什么的、和谁相邻」。
> 结构基线：0.10.x（vue 层按文件类型分组 + 设备清单注入化之后）。

## 总览：三个入口，一条依赖方向

```
skinsuite            纯内核 —— 零依赖、零 DOM、零 Vue（Node / SSR / 任意框架可用）
skinsuite/vue        Vue 绑定层 —— 状态机 + 组件 + 注册表（唯一 import 'vue' 的层）
skinsuite/vite       构建期插件 —— 扫主题目录生成 virtual:theme（唯一 import 'vite' 的层）
```

**依赖方向（单向，关卡 `verify-kernel-zero-coupling` 在宿主侧守）**：

```
vue ──→ kernel（../constants / ../registry / ../scheme / ../tokens / ../types / views/params）
vite ──→ kernel（constants）
kernel 内部 ──→ constants / types（叶子）
```

宿主与库的相遇点只有两个显式注入：`createThemeState({ devices })`（词汇）与
`themeAssets()`（目录，缺省走 env `VITE_THEME_DIR`）。

---

## 根内核层 `src/`（`skinsuite` 的全部）

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 内核**桶出口**：显式具名导出（不用 `export *`），本表即公开面承诺 |
| `constants.ts` | 目录契约常量：`THEME_ID_RE` 白名单、四段目录层 `THEME_DIR_LEVELS`、`colors` 字面段、默认包/配色、定义文件候选 `THEME_DEF_FILE_CANDIDATES`（index.ts/index.js，.ts 优先） |
| `types.ts` | 全部公开**契约类型**：`MauthThemeMeta/Package/Color/Record`、`DeviceVocab`、`ThemeTokenOverrides/Layers`、`VirtualThemeModule` 等——文档注释即规格 |
| `scheme.ts` | **明暗 mode**（`system/light/dark`，含 `MODE_CYCLE`、`normalizeMode`）与**色系 tone**（`light/dark`，配色自带属性）——「明暗 ≡ 色系」这条核心不变量的两半 |
| `tokens.ts` | CSS 变量**安全校验**：名字白名单（`--mauth-*`）、取值白名单（hex/rgb/hsl/长度/var 引用）、`sanitizeOverrides`（逐条丢弃 + rejected 回执）——防 CSS 注入与外发请求 |
| `manifest.ts` | 主题域清单 `theme.config.ts` 的契约与解析：`defineThemeManifest` / `resolveThemeManifest` / `isThemeDebugVisible`（调试面板门控） |
| `registry.ts` | **配色注册表**：三个加载表（packages/colors/styles）→ 四段键 Map；`buildThemeRegistry`（重复键警告、tone 兜底）、`getThemeRecord` 回退链（精确 → 同包同系别 → 默认包兜底）、惰性索引查询（0.8.0 性能项）、`installThemeRegistry` 单例 |
| `views/params.ts` | 设备维度 **URL 参数解析**（纯函数）：`?th[_<urlKey>]` / `?th_color[_<urlKey>]` 的键形规则、设备专属 > 通用键、空串 = 未指定；`readUrlViewIntent` 全设备一次读入 |
| `views/param-audit.ts` | URL 参数**审计**（dev 警告的数据源）：非法值 / 未知设备缩写 / 重复键的收集逻辑，供调试句柄消费 |

## 构建期 `src/vite/`（`skinsuite/vite` 的全部）

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 子路径桶出口（`themeAssets` + 目录常量） |
| `plugin.ts` | **主题扫描插件** `themeAssets()`：零参（`configResolved` 用 `config.env` + `config.root` 自解析目录）；扫 `themes/<包>/<设备>/<页面>/colors/<配色>/` 出四张加载表 + `themeParts` + `views/*.ts` 副作用；fail-soft（目录不存在出空注册表）；跳过项 dev 去重警告 |
| `dir.ts` | 目录**约定常量**：`DEFAULT_THEME_DIR`（src/theme）、env 键 `THEME_DIR_ENV_KEY`、固定子目录名 `themes` / `views`、清单文件名 `theme.config.ts` |
| `theme.d.ts` | `virtual:theme` 虚拟模块的**类型声明**（宿主 IDE 补全靠它，随包发布） |

## Vue 绑定层 `src/vue/`（`skinsuite/vue` 的全部）

按文件类型分七组（0.10.0 起）+ 三个根文件：

| 根文件 | 职责 |
| --- | --- |
| `index.ts` | 子路径**桶出口**（公开面承诺，显式具名导出） |
| `plugin.ts` | Vue 插件 `app.use(theme, { router? })`：router 可选（0.9 无路由支持），只装设备域的 URL 通道 |
| `types.ts` | Vue 层契约：`ThemeDebugModel/Actions/Color`（调试面板的数据形状） |

### `store/` —— 状态机（scope → intent → runtime 三层编排）

| 文件 | 职责 |
| --- | --- |
| `theme-scope.ts` | **作用域层**：`activeDevice`（唯一写入口 = `<ThemeView>` device prop）/ `activePage` / `activeView` 三维度；`themeRecordFor` 按作用域解析生效配色（URL 设备覆盖 > 全局 themeId）；`isDark` / `packageId` 派生；版式意图的 URL 读入与同步 |
| `theme-intent.ts` | **意图层**：明暗三态 + 白/黑系会话记忆槽 + `syncColorToTone`（明暗→配色单向联动）+ 用户操作入口（`setTheme` / `cycleMode` / `toggleTheme`）；首屏对齐 watch |
| `theme-runtime.ts` | **DOM 副作用层**：token 分层注入 html 根 + `html.dark` 类 + `data-mauth-theme` 属性 + theme.scss 惰性加载（epoch 防串台）+ 切版式重置配色 + 外部配置合入；🔴 TDZ 顺序有专注释 |
| `theme-persistence.ts` | localStorage 安全读写（新键 `mauth:*` + 0.7.x 旧键读回退）+ URL 配色意图读取（按注入清单逐设备） |
| `theme-store.ts` | `ThemeStoreLike` **结构契约** + `provide/inject` 键——库不 import 宿主 Pinia，宿主 store 结构兼容即可传给 `<ThemeRoot>` |
| `create-theme-state.ts` | **编排入口**（宿主一行 `defineStore` 包起来）：装配三层 + query watch + 调试句柄 + 注册表空防呆 + `dispose` 收全副作用；`ThemeStateOptions` 是宿主策略收口点（`devices` / `storageKeys` / `colorParam` / `viewParam` / `defaultPage`） |

### `components/` —— 七个 SFC（全部薄组件：只消费 store/注册表，无业务）

| 文件 | 职责 |
| --- | --- |
| `ThemeRoot.vue` | **provide 点**：必须传 `:themeStore`（`ThemeView` / `ThemeDebugPanel` / `ThemePart` 全靠 `inject` 取 store，不传即抛错）——库不 import 宿主 Pinia，只约定 `ThemeStoreLike` 结构（字段兼容即可传）。此外挂 `.dark` 类 + body 底色 token |
| `ThemeView.vue` | 渲染某页「当前生效版式」：pick（URL > 包声明 > 包名）→ epoch 防抖加载 → `setActivePageView` / `setActiveDevice`（设备身份的唯一告知通道） |
| `ThemeScope.vue` | 无路由应用的 token-only 锚点（不查版式注册表，只告知作用域） |
| `ThemeProvider.vue` | 钉死/并行主题容器（P1a）：子树一套自己的配色，纯查询不碰全局 store |
| `ThemePart.vue` | 部件渲染（P1b）：`parts/<部件id>/index.vue` 按 (包×设备) 解析，绝不碰全局作用域；可选 `color-id` 作用域注入 |
| `ThemeDebugPanel.vue` | 调试面板**门卫**：只算 `visible`（清单开关 + query），`v-if` 保证 off 档连 chunk 都不下载 |
| `ThemeDebugPanelBody.vue` | 面板主体（重 chunk）：设备/版式/颜色/明暗四段 UI，scoped CSS 不依赖宿主框架 |

### `composables/` —— 组合式

| 文件 | 职责 |
| --- | --- |
| `use-scoped-theme.ts` | 作用域注入的 composable 半边（`resolveScopedRecord` 纯查询 + `useScopedTheme` 注入到任意元素，差集清理）——ThemeProvider / ThemePart 共用 |
| `useThemeDebugPanel.ts` | 面板**适配器**：从 store / 页面域 / 内核注册表自动组装 `model` + `actions`（切设备/版式/配色只写 store 不碰路由） |
| `useThemeSources.ts` | 主题意图**来源接入**：父应用 postMessage 同步 + 后端配色拉取（读 env，宿主零传参），返回 cleanup 供 dispose |
| `useParentThemeSync.ts` | postMessage **协议解析与分发**（`THEME_CHANGE` 新旧协议；origin 白名单由宿主参数给） |

### `runtime/` —— DOM 与取数支撑

| 文件 | 职责 |
| --- | --- |
| `token-runtime.ts` | token 注入的**账本半边**：`applyThemeLayers`（分层 + 按 target 差集清理，WeakMap 分账）——P1a 注入目标参数化的实现 |
| `theme-runtime.ts` | 见上表 `store/theme-runtime.ts` 的 DOM 副作用层（放本组，与 token 注入相邻） |
| `remote-fetch.ts` | 后端配置取数骨架：fetch + 超时 + 失败静默返回 null + 形状归一交内核 |

### `registry/` —— 版式 / 页面 / 部件

| 文件 | 职责 |
| --- | --- |
| `view-registry.ts` | 版式**注册表 + 选择器**工厂：`resolve`（URL > 声明 > 包名，非法值不回退）、`builtin()` 内置包同步形态、`load` 惰性 chunk；设备段只做形态校验（词汇归宿主） |
| `view-page.ts` | **页面工厂** `defineThemePage({ page })`：机制只写一次，页面文件退化成「一份契约 + 一次声明」；惰性取 loader 防循环 |
| `theme-views.ts` | 版式加载表**单例**（`virtual:theme` 装入 → `themeViewsFor(page)` 渲染期取） |
| `theme-parts.ts` | 部件加载表**单例**（同范式，P1b） |

### `debug/` + `device/`

| 文件 | 职责 |
| --- | --- |
| `debug/theme-debug.ts` | 调试句柄：`window.__MAUTH_STORE__` 探针（11 store 键 + url/effectiveView/warnings 链路）+ 右下角角标 + URL 静默失败警告（**无门控**）；prod 静态消除 |
| `debug/panel.ts` | 面板独立入口 `skinsuite/vue/panel`（专供 `defineAsyncComponent`，保证 chunk 切分） |
| `device/device-domain.ts` | 设备域**仅存的 URL 通道**：`currentQuery()`（router 可选，无路由回退 location.search 快照）/ `replaceQuery` —— 判定与清单都不在库内（宿主事实） |

---

## 测试 `test/`（跑构建产物 `dist/`，`node --test`）

| 文件 | 覆盖 |
| --- | --- |
| `theme-core.test.mjs` | 内核常量 / mode / tone / manifest 契约 |
| `registry.test.mjs` | 配色注册表行为：四段归属、回退链、索引失效、JS 键同权、part: 命名空间 |
| `tokens.test.mjs` | token 白名单校验（注入/绕过样例矩阵） |
| `param-audit.test.mjs` | URL 参数审计的警告矩阵 |
| `vite-plugin.test.mjs` | 插件钩子级：零参/env/显式 dir、EMPTY_MODULE、eager-惰性形态、JS 定义、跳过警告去重 |
| `vue/*.test.ts` | 经 esbuild 编译到 `.test-dist/` 跑（create-theme-state 装配、device-domain 通道、token-runtime 注入） |

## 脚本 `scripts/`

| 文件 | 职责 |
| --- | --- |
| `run-tests.mjs` | 测试入口：fs 展开测试文件列表喂 `node --test`（Node 20 兼容，不用 21+ 的 glob 语法） |
| `build-vue-tests.mjs` | esbuild 把 `test/vue/*.test.ts` 编译到 `.test-dist/`（Node 原生跑不了 SFC 测试） |
| `publish-and-sync.mjs` | 发版链：npm publish → 等 registry 传播自证 → 宿主 package.json/lock 三字段二进制补丁 → `npm ci --dry-run` 终证 |
| `release-notes.mjs` | 从 CHANGELOG 抽指定版本段（GitHub Release 的 body 来源；缺失响亮失败） |

## 宿主（oauth21）侧的对应物

设备清单与判定**不在本库**——`oauth21/src/device/`（`createDeviceModule({ devices })` 机制层）
+ `oauth21/src/view/devices.ts`（词汇+布线一份声明）。本库只消费注入的 `DeviceVocab[]`
与 `<ThemeView device>` props。详见各宿主仓库。
