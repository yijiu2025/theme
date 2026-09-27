# Changelog

本包遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：0.x 阶段的次要版本允许重命名与结构调整（公开出口是显式具名导出，改名即 semver-minor）。

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
