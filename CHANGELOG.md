# Changelog

本包遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：0.x 阶段的次要版本允许重命名与结构调整（公开出口是显式具名导出，改名即 semver-minor）。

> **命名沿革**：2026-09-27 当天两度改名，最终定为 **`skinsuite`**：
>   ① 初版发布名 `mauth-theme-core@0.1.0`（前缀取自宿主的 `mauth-*` 主题层，对外没有意义）；
>   ② 改 `multitheme` 时被 npm 拒绝（403：与已存在的 `multi-theme` 过于相似，官方建议改 scope）；
>   ③ 定名 `skinsuite`（"皮肤 / 配色套件"，对应这套机制里 `?skin=` 那一层）。
>   旧名 `mauth-theme-core` 的 `0.1.0` / `0.1.1` 均已标记 **deprecated** 并保留可安装，不再更新 ——
>   它们的代码与 `skinsuite@0.1.0` 完全一致，只有包名不同。

## 0.8.0 — 未发布

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
