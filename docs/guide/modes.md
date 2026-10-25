# 明暗与色系

## 两个维度、一条联动

- **`mode`** = 用户意图：`'system' | 'light' | 'dark'`（`MODE_CYCLE` 是切换循环序：跟随系统 → 明 → 暗）
- **`tone`** = 每套配色**自带**的属性：`'light'` 白系 / `'dark'` 黑系（**必填**，漏写直接编译报错——系别判错的后果是「开夜间不联动」，现象极隐蔽，宁可构建期变红）

核心不变量：**明暗 ≡ 色系**。

- 切「暗」= 切到黑系配色；切回「明」恢复你上次的白系配色（**双侧记忆槽**，会话级，不落盘）。
- 点色卡 = 纯换配色，**不改明暗**（两个维度正交）；但色卡会同步把 mode 设成该配色的系别（点黑卡 → dark）。

## 运行时行为

| 动作 | 发生什么 |
| --- | --- |
| `toggleTheme()` | 明 ↔ 暗（纯反色，不进 `system`）；先清当前设备的 URL 覆盖 |
| `cycleMode()` | system → light → dark → system 循环 |
| `setTheme(id)` | 换配色 + 落盘 + 同步 mode 到该配色系别 + 打断对侧记忆槽 |
| 系统偏好变化 | 仅 `mode === 'system'` 时跟随切换 |

### 记忆槽规则

`lightColor` / `darkColor` 两个会话级槽只记「切走前正在用的那套」，只有**明暗切换**这个动作才写；点色卡不写槽。槽里那套在当前包下不存在时弃用，退回该系别标配（`DEFAULT_THEME_COLOR = 'white'` / `DEFAULT_THEME_DARK_COLOR = 'black'`），再退该系别字母序第一——**绝不跨系别硬凑**。

## 首屏对齐

store 装配时按「系别意图」把配色校正到匹配的系别（`mode=dark` 但落盘配色是白系 → 切到黑系）。页面上下文（`activePage`）由 `<ThemeView page>` 稍后告知——没有页面就没有「包 × 设备 × 页面」作用域，所以等它首次非空时执行一次。该设备被判 URL 锁定（`?th_color` 显式指定）时**不干预**——部署方/用户的明确意图压过联动。

## DOM 上的呈现

- `<html>` 上挂 `.dark` 类（`isDark` = 生效配色的 tone）——Tailwind `dark:` 变体与基线 SCSS 的开关；
- 同时写 `data-mauth-theme='<配色id>'` 属性——theme.scss 的选择器前缀锚点；
- token 分层注入 html inline style：主题包 tokens 在前、外部覆写在后（后者同名覆盖前者）。

作用域组件（`<ThemeProvider>` / `<ThemePart color-id>`）把 `.dark` 与 `data-mauth-theme` 挂到**自己的根元素**而非 html——见[无路由 · 作用域 · 部件](/guide/routerless)。

## 持久化

| 键 | 内容 | 说明 |
| --- | --- | --- |
| `mauth:mode` | `'system' \| 'light' \| 'dark'` | 明暗意图 |
| `mauth:theme` | 配色 id | 用户显式选过的配色 |

- 默认键带 `mauth:` 命名空间（避免与同源其它应用的裸 `theme` 键互相覆盖）；0.7.x 旧裸键（`theme` / `theme-id`）有一次性**读**迁移，写入只写新键、不删旧键。
- 隐私模式 / 禁用存储时读写全部静默降级，不会把应用带崩。
- 自定义键名：`createThemeState({ storageKeys: { mode: 'my:mode', theme: 'my:theme' } })`。
