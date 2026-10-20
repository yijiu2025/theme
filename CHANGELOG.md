# Changelog

本包遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：0.x 阶段的次要版本允许重命名与结构调整（公开出口是显式具名导出，改名即 semver-minor）。

> **命名沿革**：2026-09-27 当天两度改名，最终定为 **`skinsuite`**：
>   ① 初版发布名 `mauth-theme-core@0.1.0`（前缀取自宿主的 `mauth-*` 主题层，对外没有意义）；
>   ② 改 `multitheme` 时被 npm 拒绝（403：与已存在的 `multi-theme` 过于相似，官方建议改 scope）；
>   ③ 定名 `skinsuite`（"皮肤 / 配色套件"，对应这套机制里 `?skin=` 那一层）。
>   旧名 `mauth-theme-core` 的 `0.1.0` / `0.1.1` 均已标记 **deprecated** 并保留可安装，不再更新 ——
>   它们的代码与 `skinsuite@0.1.0` 完全一致，只有包名不同。

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
