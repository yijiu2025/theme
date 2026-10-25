# 架构地图（逐文件职责）

> 读代码前先看这里定位；每个文件的头部注释有更细的设计要点与约束，本表只回答「它是干什么的、和谁相邻」。
> 结构基线：0.10.x（vue 层按文件类型分组 + 设备清单注入化之后）。

## 总览：三个入口，一条依赖方向

```
skinsuite            纯内核 —— 零依赖、零 DOM、零 Vue（Node / SSR / 任意框架可用）
skinsuite/vue        Vue 绑定层 —— 状态机 + 组件 + 注册表（唯一 import 'vue' 的层）
skinsuite/vite       构建期插件 —— 扫主题目录生成 virtual:theme（唯一 import 'vite' 的层）
```

**依赖方向（单向）**：

```
vue ──→ kernel（constants / registry / scheme / tokens / types / views/params）
vite ──→ kernel（constants）
kernel 内部 ──→ constants / types（叶子）
```

宿主与库的相遇点只有两个显式注入：`createThemeState({ devices })`（词汇）与
`themeAssets()`（目录，缺省走 env `VITE_THEME_DIR`）。

## 根内核层 `src/`

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 内核**桶出口**：显式具名导出（不用 `export *`），本表即公开面承诺 |
| `constants.ts` | 目录契约常量：`THEME_ID_RE` 白名单、四段目录层、`colors` 字面段、默认包/配色、定义文件候选 |
| `types.ts` | 全部公开**契约类型**：`MauthThemeMeta/Package/Color/Record`、`DeviceVocab`、`ThemeTokenOverrides/Layers`、`VirtualThemeModule` 等——文档注释即规格 |
| `scheme.ts` | **明暗 mode**（`system/light/dark`）与**色系 tone**（`light/dark`）——「明暗 ≡ 色系」的两半 + 远程配置归一 |
| `tokens.ts` | CSS 变量**安全校验**：名字白名单、取值白名单、`sanitizeOverrides`（逐条丢弃 + rejected 回执）——防 CSS 注入与外发请求 |
| `manifest.ts` | 主题域清单 `theme.config.ts` 的契约与解析：`defineThemeManifest` / `resolveThemeManifest` / `isThemeDebugVisible` |
| `registry.ts` | **配色注册表**：三个加载表 → 四段键 Map；构建（重名告警、tone 兜底）、查询（惰性索引、回退链）、`installThemeRegistry` 单例 |
| `views/params.ts` | 设备维度 **URL 参数解析**（纯函数）：键形规则、设备专属 > 通用键、空串 = 未指定；`readUrlViewIntent` 全设备一次读入 |
| `views/param-audit.ts` | URL 参数**审计**（dev 警告的数据源）：非法值 / 未知设备缩写 / 重复键的收集逻辑 |

## 构建期 `src/vite/`

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 子路径桶出口（`themeAssets` + 目录常量） |
| `plugin.ts` | **主题扫描插件** `themeAssets()`：零参自解析目录；扫包/页/配色/部件出加载表 + 清单；fail-soft + dev 跳过警告 |
| `dir.ts` | 目录**约定常量**：`DEFAULT_THEME_DIR`、env 键、固定子目录名、清单文件名 |
| `theme.d.ts` | `virtual:theme` 的类型声明（随包发布，宿主不必自写） |

## Vue 绑定层 `src/vue/`

按文件类型分七组 + 三个根文件：

| 根文件 | 职责 |
| --- | --- |
| `index.ts` | 子路径**桶出口** |
| `plugin.ts` | Vue 插件 `app.use(theme, { router? })`：只装设备域的 URL 通道 |
| `types.ts` | 面板数据契约：`ThemeDebugModel/Actions/Color` |
| `shims-vue.d.ts` | `.vue` 模块兜底声明（纯 tsc 场景） |
| `env.d.ts` | `import.meta.env` 自包含兜底类型（不依赖 vite 安装） |

### `store/` —— 状态机（scope → intent → runtime 三层编排）

| 文件 | 职责 |
| --- | --- |
| `theme-scope.ts` | **作用域层**：`activeDevice`（唯一写入口 = `<ThemeView>` device prop）/ `activePage` / `activeView`；`themeRecordFor` 按作用域解析生效配色；版式意图的 URL 读入与同步 |
| `theme-intent.ts` | **意图层**：明暗三态 + 双侧记忆槽 + `syncColorToTone`（单向联动）+ 用户操作入口；首屏对齐 watch |
| `theme-runtime.ts` | **DOM 副作用层**：token 分层注入 + `html.dark` + `data-mauth-theme` + theme.scss 惰性加载（epoch 防串台）+ 切版式重置配色 + 外部配置合入；🔴 TDZ 顺序有约束 |
| `theme-persistence.ts` | localStorage 安全读写（`mauth:*` 键 + 旧键读回退）+ URL 配色意图读取 |
| `theme-store.ts` | `ThemeStoreLike` **结构契约** + provide/inject 键——库不 import 宿主 Pinia |
| `create-theme-state.ts` | **编排入口**：装配三层 + query watch + 调试句柄 + 注册表空防呆 + `dispose` 收全副作用 |

### `components/` —— 七个 SFC（薄组件：只消费 store/注册表）

| 文件 | 职责 |
| --- | --- |
| `ThemeRoot.vue` | **provide 点** + 挂 `.dark` 类 + body 底色 token |
| `ThemeView.vue` | 渲染某页「当前生效版式」：pick → epoch 防抖加载 → 告知 store（设备身份的唯一告知通道） |
| `ThemeScope.vue` | token-only 锚点（不查版式注册表，只告知作用域） |
| `ThemeProvider.vue` | 钉死/并行主题容器：子树自己的配色，纯查询不碰全局 store |
| `ThemePart.vue` | 部件渲染：按 (包×设备) 解析，绝不碰全局作用域；可选 `color-id` 作用域注入 |
| `ThemeDebugPanel.vue` | 面板**门卫**：只算 `visible`，off 档连 chunk 都不下载 |
| `ThemeDebugPanelBody.vue` | 面板主体（重 chunk）：设备/版式/颜色/明暗四段 UI |

### `composables/` · `runtime/` · `registry/` · `debug/` · `device/`

| 文件 | 职责 |
| --- | --- |
| `composables/use-scoped-theme.ts` | 作用域注入半边（ThemeProvider / ThemePart 共用）：纯查询 + 注入任意元素 + 差集清理 |
| `composables/useThemeDebugPanel.ts` | 面板适配器：自动组装 `model` + `actions`（切设备/版式/配色只写 store 不碰路由） |
| `composables/useThemeSources.ts` | 主题意图来源接入：postMessage 同步 + 后端配色拉取（端点读 env；身份参数宿主经 `remoteParams` 注入） |
| `composables/useParentThemeSync.ts` | postMessage 协议解析与分发（origin 白名单宿主参数） |
| `runtime/token-runtime.ts` | token 注入的账本半边：`applyThemeLayers`（分层 + 按 target 差集清理，WeakMap 分账） |
| `runtime/theme-runtime.ts` | 见上表 store 组（放本组，与 token 注入相邻） |
| `runtime/remote-fetch.ts` | 后端配置取数骨架：fetch + 超时 + 失败静默 null + 形状归一交内核 |
| `registry/view-registry.ts` | 版式**注册表 + 选择器**工厂：`resolve`（URL > 声明 > 包名，非法值不回退） |
| `registry/view-page.ts` | **页面工厂** `defineThemePage({ page })`：机制只写一次，页面文件退化成「契约 + 声明」 |
| `registry/theme-views.ts` | 版式加载表**单例**（`virtual:theme` 装入） |
| `registry/theme-parts.ts` | 部件加载表**单例**（同范式） |
| `debug/theme-debug.ts` | 调试句柄：`window.__MAUTH_STORE__` 探针 + 右下角角标 + URL 静默失败警告（无门控）；prod 静态消除 |
| `debug/panel.ts` | 面板独立入口 `skinsuite/vue/panel`（专供 `defineAsyncComponent`） |
| `device/device-domain.ts` | 设备域仅存的 URL 通道：`currentQuery()`（router 可选）/ `replaceQuery` |

## 测试 `test/` 与脚本 `scripts/`

| 文件 | 覆盖 |
| --- | --- |
| `theme-core.test.mjs` | 内核常量 / mode / tone / manifest 契约 |
| `registry.test.mjs` | 配色注册表行为：四段归属、回退链、索引失效、JS 键同权、part: 命名空间 |
| `tokens.test.mjs` | token 白名单校验（注入/绕过样例矩阵） |
| `param-audit.test.mjs` | URL 参数审计的警告矩阵 |
| `vite-plugin.test.mjs` | 插件钩子级：零参/env/显式 dir、EMPTY_MODULE、eager-惰性形态、跳过警告去重 |
| `vue/*.test.ts` | 经 esbuild 编译到 `.test-dist/` 跑（装配 / 设备通道 / token 注入 / 远程取数） |
| `scripts/run-tests.mjs` | fs 展开测试文件列表喂 `node --test`（Node 20 兼容） |
| `scripts/build-vue-tests.mjs` | esbuild 把 `test/vue/*.test.ts` 编译到 `.test-dist/` |
| `scripts/publish-and-sync.mjs` | 发版链：publish → 等传播 → 宿主 lock 补丁 → `npm ci --dry-run` 终证 |
| `scripts/release-notes.mjs` | 从 CHANGELOG 抽指定版本段（GitHub Release body 来源） |

## 宿主侧的对应物

设备清单与判定**不在本库**——宿主自建（词汇 + 布线一份声明）。本库只消费注入的 `DeviceVocab[]` 与 `<ThemeView device>` props。
