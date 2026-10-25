# Changelog

本包遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：0.x 阶段的次要版本允许重命名与结构调整（公开出口是显式具名导出，改名即 semver-minor）。

## 未发布

- **赞助区块三码齐**：微信收款码（扫码直接转账）/ 支付宝收款码 / 公众号「柒染靓月」二维码（.github/assets/ 三张图，README 双语三列表格）；FUNDING.yml custom 指向 README「#赞助支持」锚点（爱发电已停服，收款码直贴不依赖第三方平台）
- **设备机制层参考示例（新 guide 页）**：`docs/guide/device-layer.md` —— types / tools（pageContainers）/ runtime（createDeviceModule）三件最小实现 + 判定接线（纯函数 / useRenderDevice / 分发器装配）+ 与主题侧的边界表；README 双语 step2 与 guide 两章互链；README 安装命令恢复不带版本号
- **设备侧与主题侧彻底分离（文档口径定稿）**：设备清单文件（`view/devices.ts`）**零主题库 import**——机制收在宿主 `src/device/`（`createDeviceModule` + `pageContainers`）；主题侧注入的不是整份清单，而是**词汇投影**（`DEVICES.map(({ id, label, urlKey }) => …)`，containers 等设备侧事实不进主题，两侧唯一耦合点）；分发器经设备侧清单选容器。README 双语 step2/4/7、guide 三篇、api/vue 同步，旧手搓 helper 样例（containerMap / deviceIds / fallbackDevice / resolveContainerOf）全仓清除
- **README 完善（双语）**：顶部加 badges（npm 版本 / CI / 文档站 / license / node）；新增「特性速览」六条（对齐文档站首页）；安装示例改为显式版本号 + 0.x 提示；新增「社区与支持」分流表（文档站 / Wiki / Discussions / Issue / 私密安全报告 / CONTRIBUTING / SUPPORT）
- **社区基准补全**：新增 `SUPPORT.md`（求助分流表 + 响应口径）；CONTRIBUTING「报告问题」扩为「报告问题与社区讨论」（Issue vs Discussion 分流判据、好 bug 报告三要素、标签语义、维护者口径）；issue 模板 config 的 contact_links 补 Discussions / 文档站入口
- **Wiki 建站**（github.com/yijiu2025/theme/wiki）：Home / Roadmap（L1–L3 三层模型）/ Versioning（0.x 口径与发版链）/ Community（讨论与 Issue 规范镜像 + 分类改名对照）/ FAQ（精选）/ 侧边栏
- Discussions 已开启（默认英文分类）；中文分类改名对照表见 wiki Community 页（GitHub 未开放分类创建 API，需网页一次性改名）

## 0.11.2 — 2026-10-25

### 修复

- **vite 构建插件加固**：`toSpecifier` 两条返回路径都过 `assertSafeModuleSpec` 白名单断言——虚拟模块生成的 `import()` 说明符中，引号 / 反引号 / 反斜杠 / 尖括号 / 控制字符一律抛错（纵深防御：锁定 codegen 说明符形态，不依赖扫描器认可）
- **devDeps**：vitepress 1.6.4 嵌套的 vite `5.4.21 → 6.4.5`、esbuild `→ 0.25.12`（范围化 override `{ "vitepress": { "vite": "^6.4.4" } }`，只压嵌套副本、直装 vite 7.3.7 不动），清掉 Dependabot 全部 9 条告警（8 vite + 1 esbuild，含 2 条 high）

### 其它

- 新增 `.github/FUNDING.yml`（github: yijiu2025）
- CodeQL 两条 `js/bad-code-sanitization` 误报：白名单断言加固后经 API 以 false_positive 关闭（default setup 不认行内豁免注释；dismiss 说明含完整依据）

### 公开面

无变化（`src/vite/plugin.ts` 为构建期插件内部加固，86 例全绿含插件 fixture 测试）。

## 0.11.1 — 2026-10-25

### 文档与社区设施（代码零变化 —— `src/` / `test/` 自 0.11.0 零 diff；发版目的 = npm 主页 README 刷新）

- **README 双语完善**：顶部 badges（npm / CI / 文档站 / license / node）、「特性速览」六条、「社区与支持」分流表、安装示例
- **社区基准**：新增 `SUPPORT.md`；CONTRIBUTING「报告问题」扩为「报告问题与社区讨论」（分流判据 / 好 bug 报告三要素 / 标签语义 / 维护者口径）；issue 模板 contact_links 补 Discussions 与文档站入口；Wiki 建站（Home / Roadmap / Versioning / Community / FAQ）；Discussions 开启
- **设备侧与主题侧分离口径定稿**：设备清单文件零主题库 import（机制在宿主 `src/device/` 机制层），主题侧只注入词汇投影；新增 guide「设备机制层（宿主示例）」页（types / tools / runtime 三件 + 判定接线 + 边界表）；README step2/4/7、guide 三篇、api/vue 同步
- 公开面：**无任何变化**（0.x patch，宿主按 `^0.11.1` 跟进即可）

## 0.11.0 — 2026-10-25

### 公开面（0.x 口径记 minor）

- **`fetchRemoteThemeConfig` 身份参数通用化**：签名从 `(clientId, options)` 改为 `(options)`，身份上下文收进 `RemoteThemeFetchOptions.params`（键名与取值由调用方决定 —— `client_id` / `user_id` / 接入应用标识等；库不再硬编码 oauth21 的 `client_id`、不再读 `location.search`）。空串 / undefined 的参数不发送。此前无任何宿主直接调用（机制未启用），无迁移成本
- **`ThemeStateOptions.remoteParams`**：拉远程主题配置时的身份参数 provider（`() => Record<string, string | undefined>`），经 `useThemeRuntime` → `useThemeSources` 传到取数层，发请求前才取值。缺省不带参数；oauth21 启用该机制时传 `remoteParams: () => ({ client_id: … })` 即恢复原行为
- **`parseThemeParams` 加可选 `{ debugQuery }`**：审计的调试触发键跟随清单 `debug.query` 配置（缺省 `'debug'`，缺省行为不变）；新增导出类型 `ParseThemeParamsOptions`

### 修复

- **审计调试键硬编码**：宿主自定义 `debug.query` 后，探针 `url.debug` 显影恒 null、自定义键重复定义漏报、默认 `debug` 键被误当主题键显影 —— `theme-debug` 三处调用收进 `themeParams()` 助手统一传清单配置，审计与门控同源
- **`import.meta.env` 类型兜底**：新增 `src/vue/env.d.ts`（与 `vite/client` 逐字同形的自包含声明，同场时接口合并零冲突），4 个使用 `import.meta.env` 的源文件加 `/// <reference path>` 路径引用 —— 编辑器游离文件 / 纯 tsc 上下文不再报 TS2339

### 文档

- **VitePress 文档站**（`https://yijiu2025.github.io/theme/`）：指南 11 章 + API 参考 3 篇 + 进阶 2 篇（逐文件架构地图 / 发布流程），中文界面 + 三区侧边栏 + 本地搜索；`docs-pages.yml` 推 main 自动部署 GitHub Pages（`base: '/theme/'` + `cleanUrls: false` 适配子路径托管）；旧 `docs/onboarding.md` / `usage-and-flows.md` / `structure.md` 内容并入新章节后移除
- **设备清单章节对齐 2026-10-24 定稿形态**：指南与双语 README 明确「宿主事实 + 宿主 `src/device/` 机制层（`createDeviceModule` / `pageContainers`）」分工 —— 那些不是 skinsuite 的导出；注入主题 store 只消费词汇三字段
- devDeps 加 `vitepress`（docs 构建用，不触碰运行时零依赖承诺）；本仓补 `package-lock.json`（与根仓 workspaces 脱钩后独立安装复现）
- 新增 `test/vue/remote-fetch.test.ts` 5 例（任意键名参数 / 空值剔除 / 端点关闭零请求 / 默认无凭据 / 响应归一），全量 86 例

> **命名沿革**：2026-09-27 当天两度改名，最终定为 **`skinsuite`**：
>   ① 初版发布名 `mauth-theme-core@0.1.0`（前缀取自宿主的 `mauth-*` 主题层，对外没有意义）；
>   ② 改 `multitheme` 时被 npm 拒绝（403：与已存在的 `multi-theme` 过于相似，官方建议改 scope）；
>   ③ 定名 `skinsuite`（"皮肤 / 配色套件"，对应这套机制里 `?skin=` 那一层）。
>   旧名 `mauth-theme-core` 的 `0.1.0` / `0.1.1` 均已标记 **deprecated** 并保留可安装，不再更新 ——
>   它们的代码与 `skinsuite@0.1.0` 完全一致，只有包名不同。

## 0.10.1 — 2026-10-24

### 修复

- **exports 补注册 `./vue/panel` 子路径**：0.9.x 起该子路径就没进 exports（monorepo 宿主靠 alias 直指源码掩盖），standalone 形态裸 import 会 `ERR_PACKAGE_PATH_NOT_EXPORTED`。0.10.0 的 vue 层重构把 `panel.ts` 移入 `debug/` 子目录后，宿主 aliases 的物理探测也失效（CI standalone 关卡红）。现 exports 与物理路径对齐为 `./src/vue/debug/panel.ts`
- 宿主同步：oauth21 的 `config/aliases.ts` 探测 rel 路径与 `tsconfig.app.json` paths 同步指向 `src/vue/debug/panel.ts`

## 0.10.0 — 2026-10-24

### Vue 绑定层按文件类型重构（内部结构；公开面只减不增）

- `src/vue/` 29 个平铺文件按类型分组：`components/`（7 个 SFC）、`composables/`（use* 组合式）、
  `store/`（状态机 scope/intent/persistence/编排/契约）、`runtime/`（token 注入 / 主题运行时 / 远程取数）、
  `registry/`（版式 / 页面 / 部件注册表）、`debug/`（调试句柄 + 面板独立入口）、`device/`（URL 通道）；
  `plugin.ts` / `types.ts` / `shims-vue.d.ts` 留根。公开面（`skinsuite/vue` 桶）逐字不变，宿主零改动
- **死代码移除**（唯一宿主 oauth21 已自带同口径实现，库内零使用）：
  - `pageContainers` / `containerOf` / `resolveContainerOf` / `DeviceContainerLoader`（`skinsuite/vue` 导出移除；
    容器布线归属宿主设备模块）——`vue/device-containers.ts` 与 `views/device.ts` 整文件删除
  - `resolveThemeDir`（`skinsuite/vite` 导出移除；`themeAssets()` 零参自解析已覆盖，
    手工 loadEnv 仪式不再保留）——`vite/dir.ts` 收敛为纯常量
  - `BASE_VIEW_ID` / `THEME_PACKAGE_DEF_FILE` / `THEME_COLOR_DEF_FILE` 常量（零使用或被
    `THEME_DEF_FILE_CANDIDATES` 取代）
- `DeviceVocab` 类型从 `views/device.ts` 迁至根 `types.ts`（store 核心消费的形状，随类型层走）

## 0.9.2 — 2026-10-24

### 文档

- **双语 README + 使用说明加深**：`README.md` 改为英文主文件（npm 面向国际的惯例），新增 `README.zh-CN.md` 中文版（同结构镜像，顶部互链）；沿袭本仓 stable-deviceid 的双语家规，`README.zh-CN.md` 进 `files` 随包发布。使用说明从三步扩为**六步完整上手**（含设备清单真实文件、主题目录全注释树、包/配色/theme.scss/页面契约/清单的真实文件内容、分发器模式），并补 URL 参数手册、配置项、无路由/作用域/部件/纯内核进阶用法
- 修正 manifest 示例为真实形状（`debug: { enabled: 'url' | 'off' | 'always', query, value }`）

## 0.9.1 — 2026-10-24

### 文档

- **README 重写**（334 行 → ~170 行）：快速上手前置（`themeAssets()` 零参 + 设备清单 + `createThemeState({ devices })` 三步接入）；修正 0.9.0 后过时内容（`defineThemeDevice` 注册表已退役、exports 双轨指向、删手搓适配层示例）；删除历史对照（Roadmap 表）与实现内幕（TS2883 排查记录）等冗长段落

### 工程

- `.mimosa/`（安全扫描器本地状态目录）入 `.gitignore`

## 0.9.0 — 2026-10-24（含未单独发布的 0.8.0 体检项）

**无路由应用 + 路由树外 UI（弹窗 / 通知 / 悬浮窗）的多主题支持**（设计计划见根仓 `docs/plans/2026-10-23-theme-routerless-overlay.md`）。P0 无路由支持是纯放宽（向后兼容），P1a / P1b 是新增能力（新增组件与目录契约，不改既有行为）。

### P0 无路由支持（新增能力，无行为变更）

- **`app.use(theme)` 无参可用**：`ThemePluginOptions.router` 改可选。无 vue-router 的应用（纯 UI 壳 / 嵌入式小组件）不必再传假 router
- **`currentQuery()` 无 router 回退**：未装 router 时读 `location.search` 一次性快照（重复键折叠为数组，与 vue-router `LocationQuery` 同形）——无路由应用的 URL 本来不变，一次性读取是正确语义；装了 router 的宿主行为零变化
- **新组件 `<ThemeScope page device>`**：`<ThemeView>` 的 token-only 子集——只锚定作用域（`setActivePageView` / `setActiveDevice`），模板只有一个 `<slot />`，不查页面注册表、不加载版式组件。无路由应用与路由型应用的壳层兜底都靠它
- **`createThemeState({ defaultPage })` 播种**：`activePage` 初始值——没有任何 `<ThemeView>` / `<ThemeScope>` 挂载时 token 也能从首帧解析（此前 activePage 空串 → 零注入）

### P1a 作用域主题（同屏多主题 / 钉死配色）

- **`token-runtime` 注入目标参数化**：`applyThemeLayers(layers, { target })` / `clearThemeTokens(target?)` / `getInjectedTokenNames(target?)`——注入名单改 WeakMap 按目标元素分账，多目标互不串台、差集清理只动"该目标自己写过的名字"。**缺省目标仍是 html 根，历史行为逐字不变**
- **新组件 `<ThemeProvider page device :pkg? :color-id?>`**：给子树一套**自己的主题**——解析走内核纯查询 `getThemeRecord`（**不读不写全局 store**），token / `.dark` 类 / `data-mauth-theme` 注入到组件根元素，卸载精确清理。作用域是 **tokens-only**（theme.scss 与基线 `html.dark` 不进作用域）
- **新 composable `useScopedTheme` / `resolveScopedRecord`**：Provider 与 ThemePart 共用的作用域注入半边；`color-id` 指定了但解析不到时 dev 警告、prod 静默兜底（Q2 口径）

### P1b 部件层（主题化的弹窗 / 通知 / 悬浮窗组件本身）

- **目录契约 `themes/<包>/<设备>/parts/<部件id>/`**：与页面平级的"可复用零件"层（page = 导航表面，part = 组合零件）。`index.vue` 是部件 DOM 实现（**换版式 = 换主题包**，与页面同一条法则），可选 `colors/` 是部件自己的配色域（注册进现有注册表，page 段记 `part:<部件id>` 命名空间）。🔴 parts 住在**包内**（不与 default/compact 并列）——包自足性是机制根基（计划 §2.3 坑 ④）
- **新组件 `<ThemePart id :ctx? :device? :pkg? :color-id?>`**：渲染"当前生效的部件实现"——解析键 (包 × 设备 × 部件 id)，**绝不调 `setActivePageView` / `setActiveDevice`**（用 `<ThemeView>` 渲染弹窗会劫持全局作用域、背景换肤闪变——计划 §一「陷阱」）；default 包 eager 兜底、其余包惰性；颜色默认继承全局，`color-id` 走 P1a 作用域注入
- **插件扫描 + 装配**：`themeAssets` 产出 `themeParts`（按部件 id 分组，default eager），`installThemeParts` / `themePartsFor` 收进单例；`theme.d.ts` 补 `virtual:theme` 的 `themeParts` 类型
- **测试基建**：`test/vue/*.test.ts` 经 esbuild 打包到 `.test-dist`（node:test 直跑，不引 vitest），devDeps 加 happy-dom + esbuild；vue 层（作用域注入 / 无路由回退 / defaultPage 播种 / dispose）首次有库级测试

### 构建插件零配置（接入仪式消除）

- **`themeAssets()` 零参可用**：`ThemeAssetsPluginOptions.dir` 改可选。省略时插件在 `configResolved` 里用 Vite 已加载的 env（`config.env`，含 `.env.<mode>` / `.env.local` / CLI `--env-dir` 分层）读 `VITE_THEME_DIR`，未配置回落 `DEFAULT_THEME_DIR`；root 取权威 `config.root`。宿主 `vite.config.ts` 不再需要 `defineConfig(({ mode }) => …)` + `resolveThemeDir(mode, root)` 的三行仪式，也结构性消除了 `process.cwd()` 陷阱（从非工程根 cwd 起 vite 时手工 `loadEnv` 会读错目录、主题扫空）。显式传 `dir` 的宿主行为逐字不变（向后兼容）
- 新导出 `THEME_DIR_ENV_KEY`（env 键名单一来源，`themeAssets()` 自解析与 `resolveThemeDir()` 共用）；`resolveThemeDir` 保留给 vite 之外的场合（e2e 关卡、Node 脚本、config 定义期就需要目录绝对路径的宿主）

### vite 插件层工程化（render 重构 / 跳过警告 / 测试）

- **`renderLoaderTable` 收拢重复段**：`themeViews` / `themeParts` 两段「builtin 过滤 + 分组 + eager/惰性」的近似重复拼接收成一个泛型函数；重构以**改前/改后生成模块字节级 diff 为零**验收，生成物契约零变化
- **扫描跳过 dev 警告**：包缺 `index.ts`、页面缺 `index.vue`、配色缺 `index.ts`、部件缺 `index.vue` 四类「写歪就静默跳过」的点，现在在 dev（`command === 'serve'`）下经 `load()` 边界以 `[theme] 扫描跳过 <路径>：<原因>` **去重**警告 —— 此前纯静默、全靠宿主 e2e 关卡大喊；构建期零噪音；`.` 开头目录（.git 等）静默跳过不进警告
- **`load()` 返回 `{ code, map: null }`**：显式声明「无 sourcemap」，虚拟模块内运行时报错不再参与任何 map 推断；将来要挂真 map 不用改钩子契约
- **包内插件层测试**：新增 `test/vite-plugin.test.mjs`（7 例，钩子级驱动 + 运行期 tmp fixture，fixture 不入库防漂移），覆盖零参/env/缺省回落/显式 dir 优先/EMPTY_MODULE/eager-惰性形态/警告去重与 build 静默 —— 插件层首次有库内测试（此前仅 oauth21 集测兜底）

### 设备清单注入化（`defineThemeDevice` 注册表退役）

- **设备词汇改为装配期注入**：`ThemeStateOptions.devices: DeviceVocab[]`（`{ id, label, urlKey? }`，数组序 = 优先级、末条 = 兜底）。与 `storageKeys` / `colorParam` / `viewParam` 同一参数化语言 —— 库**不自持**设备注册表，只读取渲染。store 核心全部消费注入值：URL 参数键形（`?th_<urlKey>` / `?th_color_<urlKey>`）、初始/兜底设备（`theme-scope`）、调试面板设备列表（`theme-debug` / 面板经 `ThemeStoreLike.devices`）
- **退役**：`defineThemeDevice` / `deviceIds` / `fallbackDevice` / `registeredDevices` / `urlKeyOf`（模块删除）。导出面改为**纯工具**：`pageContainers` / `containerOf` / `resolveContainerOf`（传 defs 版，无模块状态）——「设备 id → 容器」的布线整份归宿主清单文件
- **`view-registry` 设备白名单退化为形态校验**：`THEME_ID_RE` 合法即可进表（内核只认「设备名是字符串」这条形态，设备词汇表归宿主）；picker 的 `asDevice` 不再用末条设备顶替未知值（声明期拿不到清单，未知设备由 `registry.resolve` 既有回退链兜底落当前包）
- 新类型 `DeviceVocab`（内核 `skinsuite` 与 `skinsuite/vue` 双导出）；`ThemeStoreLike` 增 `devices`
- **宿主迁移**：设备清单（词汇 + 布线一份）放宿主（如 oauth21 `src/view/devices.ts`），`createThemeState({ devices })` 注入、分发器直接 import 宿主清单（零库 import 的查询函数除外——`pageContainers` 等纯工具可复用）

### 纯 JS 宿主：主题包定义支持 index.js

- **包定义与配色定义接受 `index.ts` / `index.js` 两种形态**（新增共享契约 `THEME_DEF_FILE_CANDIDATES`，`.ts` 在前 = 并存时优先）：无 TS 工具链的前端也能纯 JS 写主题包（定义本质是 meta / tone / tokens / views 数据）。扫描侧（`pickDefFile`）按候选序取实际存在的文件、**键带实际文件名**；内核 `packageFromKey` / `parseColorKey` 同步认两种后缀——两侧同一来源，防「扫得到但解析不出」
- 顺带修复 `parseColorKey` 拼接正则的**交替优先级缺陷**：多后缀裸拼 `a|b` 进大正则会被 `|` 劈成两半（单后缀时代无害、多后缀下必失效），整体包 `(?:…)` 修正——由新增的 JS 形态用例捕获
- 边界不动：版式/部件组件恒为 `index.vue`、附加样式恒为 `theme.scss`、声明目录恒为 `views/*.ts`
- 新增 3 个用例：registry 的 JS 键同权解析、插件的 JS fixture 扫描、`.ts`/`.js` 并存优先级

### 使用建议（组合方式）

- 弹窗/通知**跟随当前主题**：裸用（CSS 变量从 html 根继承，零成本，如 oauth21 MessageToast）
- 弹窗/悬浮窗**钉死配色**：`<ThemeProvider page="app" device="standard" color-id="black">`
- 弹窗 DOM **随包换肤**：行为容器里 `<ThemePart id="confirm-modal" :ctx="ctx" />`（行为唯一一份 + 部件实现纯呈现，容器/呈现分离见计划 §2.3 ④）

## 0.8.0 — 未单独发布（体检项随 0.9.0 一并上线）

**全面审查后的健壮性版本**：一次覆盖「生命周期清理 / 静默失败防呆 / 查询性能 / 类型检查盲区」的企业级体检修复（审查报告见根仓 `reports/theme-core-review-2026-10-23.md`）。

### 变更（默认行为）

- **默认 localStorage 键加 `mauth:` 命名空间**：`theme` → `mauth:mode`、`theme-id` → `mauth:theme`。旧默认裸键与生态撞名是真实冲突（本仓 admin / firewall / phonecopy 都用裸 `'theme'` 存自己的明暗偏好，同源部署互相覆盖）。**读取带一次性回退迁移**：新键缺席时读旧键（`LEGACY_STORAGE_KEYS`，不导出），存量用户偏好无声延续；写入只写新键、不删旧键（同源下旧键可能属于别的应用）。自定义过 `storageKeys` 的部署不受影响。

### 性能

- **注册表查询索引化**（`src/registry.ts`）：回退链与范围查询从 O(n) 全表扫描改为惰性索引（WeakMap 按注册表实例缓存；`installThemeRegistry` 换表自动失效）。`findRecord` 回退、`defaultColorIdOf`、`listColorsOf`、`listColorIdsOfTone`、`resolveThemeId`、`listColorViews`、`toneOfAnyScope` 全部走索引；各查询"先到先得"的路径序语义逐字保持（新增 `test/registry.test.mjs` 11 个用例锁行为）
- **scope 共享 `activeRecord` computed**（`src/vue/theme-scope.ts`）：`isDark` / `activeTone` / `packageId` 从同一份解析结果派生，一次状态变化不再重复解析 3-4 次

### 生命周期（dispose 契约收全）

- `createThemeState().dispose()` 现在清理**全部**副作用：编排层 query watch、`installThemeDebug` 的探针/角标/2 个 watch（此前返回值被丢弃）、intent 的 3 个 watch + 系统偏好监听、runtime 的 3 个 watch、postMessage 监听、**在途的后端配色拉取**（`fetchRemoteThemeConfig` 新增 `signal` 参数，dispose 时 abort + disposed 标志兜住迟到响应）
- `defineThemeDevice` 重复声明按 id **覆盖**（保持原优先级位置），HMR / 单测反复 import 不再重复注册

### 静默失败防呆（dev）

- **注册表为空警告**：store 装配时 `listThemes()` 为空（最常见：漏 `import 'virtual:theme'`）在 dev 下输出三步排查指引 —— 此前页面正常渲染、只是没主题、零报错
- **探针门控读 manifest**：`theme-debug.ts` 的 `?debug=theme` 硬编码改为 `isThemeDebugVisible(themeManifest().debug, currentQuery())`，宿主自定义 `debug.query` / `debug.value` 后探针与面板一起生效（此前探针永远只认默认键）

### 工程化

- **vue-tsc 接入 typecheck**：`npm run typecheck` 的 vue 半边从 `tsc`（靠 shim 把 `.vue` 当不透明组件）升级为 `vue-tsc`（`tsconfig.vue.json` include 覆盖 SFC），`<script setup>` 内部的类型错误首次被库仓自己拦住。已验证 vue-tsc@3.3.13 兼容 TS 6.0.3，且注入探针确认 SFC 内部检查真实生效；`shims-vue.d.ts` 保留作纯 tsc 场景兜底
- **Vite 插件 watcher 三边界**：主题目录在 root 外时 `watcher.add`；路径比较归一大小写 + 前缀带分隔符（修 `D:/theme` 误匹配 `D:/theme-other`）；补 `addDir` / `unlinkDir`（删除整个配色目录不再漏刷新）

### 文档

- `docs/onboarding.md` §3 示例修正为 `meta` 嵌套契约（原示例照抄编译不过）；`src/vite` 两处头注释与 exports 实际对齐（运行时指 dist、类型源码直供、`.js` 后缀约定）；README 新增「单例语义」一节（微前端 / 同源多应用边界）

## 0.7.1 — 2026-10-22

**发布闭环与类型覆盖补齐** —— 0.7.0 之前「发版」是本地手工活：没有人能在 CI 里复现它，也没有任何关卡保证 tag 与源码版本不漂移。本版把发布搬进 GitHub Actions，并把 `src/vue`（skinsuite/vue 的绑定层）纳入类型检查 —— 这一层此前从未被检查过。

### 新增

- **`.github/workflows/release-npm.yml`（CD）**：推 `v*` tag 即发布 `skinsuite` 到 npm；`workflow_dispatch` 可填 tag 手动重跑（发布失败重跑填同一个 tag）。命名按家族 CI 规范，发布族一律 `release-<target>.yml`
  - **认证走 Trusted Publishing（OIDC）**，仓库不再持有任何长期 token（`permissions: id-token: write`）。npmjs 侧的一次性配置见 workflow 头部注释
  - **OIDC 前置校验步骤**：npm ≥ 11.5.1 且 node ≥ 22.14.0。版本不足时 OIDC **静默不生效** —— npm 回退去找 token，最后以 401 收场，而报错信息完全指不到真因。宁可在这里红，也不让它走到 `npm publish`
  - **只发布、不同步宿主**：CI checkout 里没有 oauth21 与根仓，宿主 `package.json` + lock 补丁与 `npm ci --dry-run` 自证需要两仓同时在场；跨仓提交也不该由 CI 代劳（会绕过宿主仓自己的 PR 门禁）。1~3 步在 CI，4~6 步本地 `node scripts/publish-and-sync.mjs --skip-publish` 续跑
- **`scripts/publish-and-sync.mjs` 两个开关**
  - `--publish-only`：只跑发布 + 等 registry 传播自证，跳过宿主同步
  - `--tag <名>`：优先读 `GITHUB_REF`；**CI 下 tag 名必须等于 `v` + package.json 版本**，不一致直接红。防的是 tag 与源码版本漂移 —— 这是本流程最该守住的一条
- **类型检查覆盖 vue 绑定层**：新增 `tsconfig.vue.json`（`moduleResolution: bundler`）+ `src/vue/shims-vue.d.ts`，`npm run typecheck` 现在串联两个配置。此前主 `tsconfig.json` 排除了 `src/vue`，**独立仓形态下这一层从未被类型检查过**（23 个文件）
  - devDeps 补 `vue ^3.5.38`：本机此前 0 错是靠 monorepo 父级 node_modules hoist 上来的 vue；独立仓 `npm install` 后会报 19 个 `TS2307`。毒丸自证因此改成验两件事 —— 有效性（植入错误会红）与可移植性（隔离形态仍绿）

### 说明

- 公开出口与运行时行为**零变化**，宿主无需改代码；0.x 下 `^0.7.0` 与 `~0.7.0` 等价，升级方式不变
- 内核零耦合判据（`verify-kernel-zero-coupling`）只查 `dependencies` / `peerDependencies`，devDeps 加 vue 不触碰它 —— `src/vue/` 碰 vue 是设计内允许的

## 0.7.0 — 2026-10-21

**URL 主题参数的静默失败有了出口** —— `?th=compat`（拼错）不报错、`?device=phon` 不报错、`?th=a&th=b` 不报错，踩坑的人当时唯一的线索是"怎么点都没变化"。本版把这些静默失败变成 dev 下的 console 警告 + `?debug=theme` 时的探针链路键。第一版实现在 oauth21 宿主，评审后下沉库：判定知识（`pageOf(page).views.has()` / `registeredDevices()` / 参数键形）与被诊断的静默失败（`pick()` 回落、未知设备落兜底）**都是库的**，宿主各写一遍就是抄 N 份必然漂移（params.ts / view-picker / registry 都因此沉过内核）。

### 新增

- **内核 `views/param-audit.ts`**（零 import 纯函数，dist 出口，可被 CI 直接调用做链接体检）
  - `parseThemeParams(query)` —— 路由 query → 主题白名单键原始值。口径与读取侧逐字对齐：空串 = 未指定；重复键（router 数组）进 `repeated` 并**带首值** —— 版式键读取侧（`readUrlViewIntent` 的 `present()`）拒绝数组 ⇒ 按未指定，配色键（`readUrlIntent` 的 `URLSearchParams.get()`）只取首值 ⇒ 首值生效，两种净效果不同，警告文案分开说（说错一边审计就成了误诊）
  - `effectiveViewRaw(params, urlKey)` —— 当前设备生效的 URL 版式原始值（专属键 > 通用键 > 无）
  - `collectWarnings(params, ctx)` —— 四类静默失败显影：① `?device=` 未知 id（含已注册清单 + 兜底设备）② 当前设备生效版式值不存在（带「可用版式：…」字典序建议）③ 其它设备专属键错值（现在不渲染，切过去才静默落包）④ 白名单键重复定义。**不检**配色合法性（生效配色是 URL 覆盖 + 持久化 + 用户操作的合成，脱离 store 单看 URL 会误报）与通用键对其余设备的解析（部署方常有意只保一端）
  - 类型 `ThemeUrlParams` / `ParamAuditDevice` / `WarningContext` / `RepeatedParam`
- **`skinsuite/vue` 的 `installThemeDebug`**（由 `createThemeState` 装配末尾自动调用，宿主零接线；prod 下 `import.meta.env.DEV` 静态为 false，函数体整体消失）
  - **dev 无门控警告**：非法版式值 / 未知设备锁定 / 重复键直接喊 console（同一问题只喊一次，Set 去重）—— 静默失败不靠"记得开开关"防
  - **`?debug=theme` 门控探针**：`window.__MAUTH_STORE__` 既有 11 个 store getter **原样保留**（e2e 三个关卡的依赖面），新增 `url`（地址栏原始值，路由 query 同源）/ `effectiveView`（生效版式的输入 + 判定）/ `warnings`（当前存在的问题）三个链路键；右下角角标随警告计数红 / 绿
  - 响应式刷新：watch store 六值 + `watch(currentQuery, { deep })`，**不轮询**
- **库 test 23 例**（`test/param-audit.test.mjs`，打 dist）+ **宿主 vitest 6 例**（`src/theme/views/__tests__/theme-debug.test.ts`，真实 store + 假 router 域测装配：无门控警告 / 探针 11+3 键 / 角标红绿 / console 去重）

### 说明

- 判定为什么敢下结论：版式合法性由调用方注入 `hasView`（库公开 API `pageOf(page).views.has`），设备清单来自 `registeredDevices()` —— 审计**不复制 pick 逻辑**，只做「输入 → 判定 → 文案」
- 页未注册时不判版式（没有 registry 就没有判据，不误报）；`?device=` 警告照出

## 0.6.0 — 2026-10-21

**死字节清理** —— 全仓 grep（含单测与 e2e 关卡）核实零消费后整条删除，无行为变化。

### 删除

- **`DeviceDef.routePath` / `ThemeDeviceOptions.routePath`**（及 `defineThemeDevice` 构造透传）：设备声明里「该设备占哪条路由」的字段。路由 path 早在 2026-10-18 收归宿主 `router/routes.ts` 固定声明（清单再声明一份就是第二个真相），此后该字段只剩定义处与透传处、**零读取方**。宿主 `views/devices.ts` 的四条 `routePath` 同步删除
- **内核出口 `asDeviceId` / `deviceLabel`**（`views/device.ts`）：零调用方（`ThemeDebugPanelBody.vue` 里的 `deviceLabel` 是同名局部常量，不是它）
- **`skinsuite/vue` 出口 `isKnownDevice` / `resetDevices`**（`define-theme-device.ts`）：前者零调用（`view-registry.ts` 自有同名局部实现）；后者注释声称「单测 / HMR 用」，但单测与仓库内同样零调用
- **`skinsuite/vue` 出口 `resetPages` / `resetThemeViews` / `resetThemeRuntime`**：同族的「单测 / HMR 用」reset 导出，同样零调用，一并退役

### 说明

- `containers` 三参数（glob / fileRe / idRe）与 `pageContainers` / `resolveContainerOf` / `deviceIds` / `fallbackDevice` / `urlKeyOf` / `registeredDevices` 等**全部保留**——那是设备容器链路的命脉，本次审计确认无一死字节
- 删除的导出对下游的唯一影响是「import 不到」：按 0.x 口径记 minor，无 URL / 运行时行为变化

## 0.5.0 — 2026-10-20

**设备身份改由 `<ThemeView>` props 告知** —— `page="login" device="mini"` 一步告诉主题「哪台设备、哪页」，主题据此渲染。在此之前「判设备 → 选容器 → 告知主题」需要库提供注入槽 / 分发器接线，或宿主在分发器里手动 `setActiveDevice`；现在收成一条：宿主分发器只管按自己的口径选容器，设备身份由容器内的 `<ThemeView>` props 带进 store。库**零判定词汇**（不认视口 / UA / `?device=` / `?from=`），也不新增任何导出面。

### 新增

- **`ThemeStoreLike` 补两个成员**：`activeDevice`（只读标量，当前生效设备）+ `setActiveDevice(device)`（写入口）。自建 store 壳的宿主需要补齐（oauth21 已同步）
- **`<ThemeView>` 的 `device` prop 即告知**：setup 里 `watch(() => props.device, …, { immediate: true })` → `store.setActiveDevice`，与既有的 `setActivePageView` 同帧完成 —— 设备身份随容器渲染自然到达，无需分发器额外接线

### 迁移

- 0.4.0 之前引入的 `resolveDevice` / `deviceResolver` 注入槽**均不存在**：设备判定整条线在宿主侧（分发器按视口 / `?device=` 锁定选容器），库只经 ThemeView props 接收结果
- `useThemeDebugPanel` 的当前设备展示读 store `activeDevice`（0.4.0 撤 `currentDevice()` 导出后的修复）

### 说明

- 设备取值集合（`mobile` / `standard` / `mini` …）与判定口径（视口阈值、URL 锁定词）**都不属于本包**：那是宿主的词汇表；库只承诺「ThemeView props 告知 → store 是唯一事实源 → 按设备渲染」
- 详见契约文档 `oauth21/docs/login-theme-routing.md`

## 0.4.0 — 2026-10-20

**版式意图 store 化** —— URL 一次读入、store 是唯一事实源，与配色侧（`themeId` / `deviceTheme`）完全同形。在此之前版式是"每次渲染现读 `route.query`"，debug 面板换版式必须改 URL（触发路由变化）；现在与配色一样：URL 只负责**初始化播种**，运行时一切读写走 store。

### 新增

- **`views/params.ts` 一次性读入半边**（零 import，设备清单由调用方注入）
  - `readUrlViewIntent(query, viewParam, devices)` —— 把 URL 上所有 `th*` 原始值解析成 `{ deviceView, viewIntent }`：设备专属键（`?th_<urlKey>`）逐设备记，通用键（`?th`）原样进 `viewIntent`（不下发副本，由 `deviceViewOf` 兜底）。空串 = 未指定、重复键（数组）= 未指定，与配色侧同口径
  - `viewParamsSnapshot(query, viewParam, devices)` / `sameViewSnapshot(a, b)` —— `th*` 键白名单快照 + 判等：**仅当 URL 原始值变化才同步**，debug 改写（只碰 store）不会误触发。白名单 = `th` + `th_<urlKey>`（**不是**前缀匹配——那会把配色键 `th_color` 卷进来）
  - 类型 `DeviceViewIntent = Partial<Record<string, string>>`
- **`useThemeScope(keys, colorParam, viewParam)` 新增版式意图面**（与配色侧逐字同构）
  - `deviceView` / `viewIntent` 两个 ref、`deviceViewOf(device)`（专属键 > 通用键 > null）、`setDeviceView(device, id)` / `clearDeviceViewOverride(device)`（显式操作，只写 store）、`syncUrlViewIntent()`（快照判等后重新读入）
- **`ThemeView.vue` 与调试面板改数据源**：`<ThemeView>` 的 URL 兜底源从"每次渲染现读 `route.query`"换成 `store.deviceViewOf(props.device)`；`useThemeDebugPanel` 的 `pickView` 从 `replaceQuery`（改 URL）换成 `store.setDeviceView` —— **调试换版式零路由变化**
- **`createThemeState` 的 `viewParam` option** + `watch(() => currentQuery())` 编排：跨页带不同 `th`（/login → /register）仍会同步进 store

### 迁移

- `ThemeStoreLike`（`vue` 出口的类型契约）新增 `deviceViewOf` / `setDeviceView` / `clearDeviceViewOverride` / `viewIntent` 四个成员；自建 store 壳的宿主需要补齐（oauth21 已同步）
- 版式/配色参数键形不变（`th` / `th_<urlKey>`、`th_color` / `th_color_<urlKey>`），URL 兼容面无破坏

### 说明

- 版式意图**不做合法性校验、不落盘**：版式 id 合不合法是渲染期知识（当前包里有没有），由 `pick()` 兜底；版式也没有持久化语义（换包即重置）
- 详见契约文档 `oauth21/docs/login-theme-routing.md`

## 0.3.1 — 2026-10-19

- docs：设备判定示例从内核注释挪到宿主 `utils/device`（判定属于宿主，内核只收注入）

## 0.3.0 — 2026-10-19

### 破坏性变更

- **设备判定撤出内核**：`views/device.ts` 的 `resolveCurrentDevice`（视口宽度 / UA 嗅探）删除，改为宿主通过 `app.use(theme, { resolveDevice })` 注入。理由：设备形态判定依赖宿主的断点口径与 UA 词表，属于宿主策略；内核只保留"声明 + 查询"（`defineThemeDevice` / `registeredDevices` / `urlKeyOf` / `containersOf`）。详见 `docs/onboarding.md`

## 0.2.3 — 2026-10-19

- fix(vite)：扫描 `views/*.ts` 时误用 `.js` 后缀拼 glob，声明恒为空（vite 插件认 `.ts` 源文件）

## 0.2.2 — 2026-10-19

- fix(vite)：构建插件（`./vite` 入口）改为以**编译产物**发布（`dist/vite/`），源码只留作类型入口——此前发布的是 TS 源，Node 侧加载即报错

## 0.2.1 — 2026-10-19

- fix(exports)：根入口 `types` 统一指向 `src/`，消除 `dist/src` 双身份（此前 `types` 指向 dist 编译产物，跳转会落到编译目录）

## 0.2.0 — 2026-10-19

**机制全量下沉** —— 从 0.1.0 的"纯叶子层"扩为完整机制：配色注册表、版式机制、设备机制、主题状态机、构建插件全部收进本包。宿主（`oauth21`）侧只剩声明文件（设备清单 / 页面 glob / 主题目录）与一行 `defineStore` 壳。

### 新增

- **根入口（`.`）**：`src/registry.ts`（`buildThemeRegistry` / `installThemeRegistry` / `getThemeRecord` / `listThemes` 等查询函数）、`src/manifest.ts`（virtual:theme 清单单例）、`src/scheme.ts`（mode / tone / remote config）、`src/views/device.ts`（设备声明与查询）
- **Vue 适配层（`./vue`）**：`createThemeState`（状态机编排：scope / intent / runtime 三 composable + 持久化层）、`ThemeRoot.vue` / `ThemeView.vue` / `ThemeDebugPanel.vue`、`theme` 插件（`app.use(theme, { router, resolveDevice })`）、`useThemeSources` / `useParentThemeSync` / `useThemeDebugPanel`、`useThemeStore` 注入键
- **构建器入口（`./vite`）**：扫描 `src/theme/themes/` 生成注册表、扫 `views/*.ts` 装配版式、注入 `virtual:theme`、`VITE_THEME_DIR` 常量
- **`themeStoreKey`**：跨组件访问宿主 store 的注入键（调试面板无参化的基础）

### 交付形态变化

- `exports` 从单一 `.` 扩为 `.` / `./vue` / `./vite` 三个子路径；`./vue` 以源码发布（`.vue` / `.ts` 需宿主构建器处理），`.` 与 `./vite` 走 `dist/`
- 测试扩到 23 项，`node --test` 仍针对构建产物

## 0.1.0 — 2026-09-27

首个公开发布。内容 = 主题机制里的**纯叶子层**（抽包 Stage 1），从宿主 [`oauth21`](https://github.com/yijiu2025/CoreFlow) 的 `src/theme/` 原样迁出，宿主侧改为零逻辑转发壳。

### 新增

- **常量与白名单**（`src/constants.ts`）
  - `THEME_ID_RE` —— 目录名 / id 白名单（主题包名、配色 id、版式 id、页面名共用一条）
  - `DEFAULT_THEME_PACKAGE` / `DEFAULT_THEME_PAGE` / `DEFAULT_THEME_ID` —— 内置包、兜底页面、空记录占位
  - `DEFAULT_THEME_COLOR = 'white'` / `DEFAULT_THEME_DARK_COLOR = 'black'` —— **显式**默认配色与暗系配对（取代原先靠字母序巧合的兜底口径）
  - `BASE_VIEW_ID = 'base'` —— 版式注册表工厂的逻辑 id
- **明暗 intent**（`src/mode.ts`）—— `ThemeMode` 三态含 `system`、`MODE_CYCLE` 循环顺序、`MODE_LABELS` 文案、`isThemeMode` / `normalizeMode`（容忍大小写与空白，非法返回 `null`）
- **明暗系别**（`src/tone.ts`）—— `ThemeTone` 两系、`TONE_LABELS` 文案、`isThemeTone` / `normalizeTone`（无 `system`：系别是配色自带属性）
- **token 安全校验**（`src/tokens.ts`）—— 名字前缀白名单、取值白名单（拒颜色名与 `url()`）、`--mauth-font-family` 字体栈特例、`sanitizeOverrides` 逐条过滤并返回被拒项
- **契约类型**（`src/types.ts`）—— `MauthThemeMeta` / `MauthThemePackage` / `MauthThemeColor` / `MauthThemeRecord`，含包级 `views` 声明与 `coverage` 范围声明
- **设备维度参数**（`src/views/params.ts`）—— `readDeviceParam(query, name, device)` 与 `DEVICE_SCOPED_PARAMS`，取值链 `?view.<设备>` → `?view` → 未指定（空串 / 纯空白 / 空数组均视为未指定）

### 交付形态

- ESM only（`type: module`），`exports` 指向 `dist/`（含 `.js` + `.d.ts` + sourcemap），同时发布 `src/` 便于跳转源码
- `sideEffects: false`、零运行时依赖、Node >= 18
- `src/` 的相对 import 统一带 `.js` 后缀（`moduleResolution: NodeNext` 产物可被原生 ESM 解析）
- 测试：`node --test` 针对**构建产物**跑（顺带验证产物能被 Node 原生加载），14 项覆盖上述全部公开行为

### 说明

- 设备取值集合（`mobile` / `standard` / `mini` …）**不属于本包**：那是宿主应用的词汇表，必须在宿主的设备清单里声明
- 配套的 Vue 适配层（store / DOM 注入 / `import.meta.glob` 适配器）尚未抽包，计划为 `mauth-theme-vue`，见 README 的 Roadmap
