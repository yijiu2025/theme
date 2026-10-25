# 常见坑

每一条都真实踩过。

## 安全边界

CSS 自定义属性能直接改变渲染。未校验的 `setProperty` 等于交出两个口子：**外发请求**（`url()` 探测/追踪）与**样式注入**（闭合规则载荷）。因此只用白名单：

- 名字必须 `--mauth-<短横线>`；
- 取值允许 `#hex` / `rgb()` / `hsl()` / 长度 / `var(--mauth-*)` / 关键字；
- 颜色名、`url()`、规则闭合字符逐条拒绝（`sanitizeOverrides` 返回 `{ tokens, rejected }`——一条坏值不连累其余）。

判据：**必须写 `url()`、伪元素、keyframes 的，走 `theme.scss`，不走 token**（那是构建期受信代码）。

## 单例语义（微前端必读）

`installThemeRegistry` / `installThemeManifest` / `installThemeViews` / `installThemeParts` 是模块级单例；token 注入写 `document.documentElement`。承诺形态：**每个 JS realm + 每份 document = 一个主题域。**

- SPA、iframe、SSR 每次渲染各自独立；
- 微前端共享同一模块实例会互相覆盖（后注册整体生效、token 注入互清）——子应用要模块隔离，或只用纯内核自管注入；
- 同源多应用共享 `th` / `th_color` 参数命名空间与 localStorage 键——用 `storageKeys` / `colorParam` / `viewParam` 细分。

## 踩坑清单

### 1. 页面契约 import 了 `virtual:theme`

→ 形成 `store → virtual:theme → 组件 → 容器 → store` 循环。页面契约必须是纯声明（只 `defineThemePage({ page })`），版式表由内核惰性解析。

### 2. 手写 `import.meta.glob('/src/theme/themes/...')`

→ 换目录就失效。扫描全交给 `themeAssets()`，主题目录位置只由 `VITE_THEME_DIR` 决定。

### 3. 单测没挂 `themeAssets`

→ `virtual:theme` 是空表，用例不报错、只静默落默认值，极难归因。build 与 test 两侧必须同源（vitest 用 `mergeConfig(viteConfig, …)` 继承，或共用同一份插件工厂）。

### 4. 设备判定写了两份（分发器一套、库一套）

→ 口径不一致时手机端渲染但主题是桌面作用域。判定只认宿主设备模块一处；容器与主题永远同源（`<ThemeView device>` props 即告知）。

### 5. 在容器里手写 `setActiveDevice` / `setActivePageView`

→ 冗余且会被 `<ThemeView>` 覆盖。全删，交给 `<ThemeView>`。

### 6. 设备判定写进库里

→ 边界错。库不提供任何注册槽 / 分发器 composable；判定与它的词汇全部写在宿主 utils 层。

### 7. 容器摊平在 `view/web/` 下

→ `web/StandardLogin.vue` 的页面名被算成 `web`，该页在这一设备上等于「没写容器」。`standard` / `mini` 必须各自待在 `view/web/<页面>/` 里。症状：类型检查 / lint / build 全绿，只在运行时分发取不到容器才炸。

### 8. TS2882：`virtual:theme` 报 Cannot find module

→ 在 `vite-env.d.ts` 里写了 `/// <reference types="skinsuite/vite" />`——`reference types` 解析不到包的**子路径**入口。改成 `import "skinsuite/vite";`（纯类型侧，不产生运行时代码）。

### 9. 「面板不出现」却毫无报错

→ 检查清单：`theme.config.ts` 存在吗？`debug.enabled` 是不是 `off`？触发键改过吗（`debug.query` / `debug.value`）？——`defineThemeManifest` 对非法档位启动即抛，但「配置成 off」是合法状态。

### 10. 加了主题没生效

→ 核 `THEME_ID_RE`（`/^[a-z0-9-]+$/`）：目录名大写、下划线、中文都会**静默跳过**（dev 有 `[theme] 扫描跳过 …` 警告）。再看 `VITE_THEME_DIR` 是否指向存在的目录。
