# 目录约定

主题域是一个**自足目录**，内部三个名字是固定约定；库靠「名字固定」对齐，不靠配置。

```
<主题根目录>/                     ← 由 env VITE_THEME_DIR 指定（缺省 src/theme）
├── theme.config.ts              清单：调试开关（defineThemeManifest）
├── themes/                      主题包目录（一个包 = 一整套设计）
│   └── default/                 ← 内置包（default 是保留名，eager 首屏零请求）
│       ├── index.ts             包定义（MauthThemePackage）
│       └── <设备>/<页面>/        版式组件 + 配色
│           ├── index.vue        该设备该页的版式组件
│           └── colors/<配色>/
│               ├── index.ts     配色元信息 + tokens
│               └── theme.scss   附加样式（可选）
└── views/                       页面契约目录
    └── <page>.ts                defineThemePage 声明页面
```

## 三个固定名字

| 名字 | 作用 | 可配置？ |
| --- | --- | --- |
| `theme.config.ts` | 清单（调试开关），插件从根层读 | 文件名可用 `manifestFile` 选项改；设空串则不注入清单 |
| `themes/` | 主题包目录，扫描器在这里递归 | 固定 |
| `views/` | 页面契约目录，插件副作用 import 拉齐注册 | 固定 |

主题根目录位置本身由 env `VITE_THEME_DIR` 决定（缺省 `src/theme`）。换目录只改这一个变量，不动代码。

## 四段键

目录深度即解析键：`themes/<包>/<设备>/<页面>/colors/<配色>/` 对应注册表键 `包/设备/页面/配色`。这段结构的唯一来源是内核常量：

- `THEME_DIR_LEVELS = ['pkg', 'device', 'page', 'colorId']` —— 取值目录段；
- `THEME_COLORS_SEGMENT = 'colors'` —— 固定字面段；
- `THEME_DEF_FILE_CANDIDATES = ['index.ts', 'index.js']` —— 定义文件（并存时 `.ts` 优先）。

改目录结构（配色下再分层、`colors` 改名）只动 `constants.ts` 这一份契约，构建插件与注册表解析一起跟着变。

## 命名规则（白名单）

`THEME_ID_RE = /^[a-z0-9-]+$/` 同时作用于**主题包名、设备名、页面名、配色 id、部件 id**——它们都会进 `data-*` 属性与 CSS 属性选择器。

::: warning 不合规 = 静默跳过
一个写坏的目录不该让整站起不来，所以不合规目录**静默跳过**（dev 下有扫描警告）。排查「加了主题没生效」，第一件事就是核这条正则。
:::

## parts（部件）目录

与页面平级的「可复用零件」层，住在**包内**：

```
themes/<包>/<设备>/parts/<部件id>/
├── index.vue                    部件 DOM 实现（换版式 = 换包，与页面同一条法则）
└── colors/<配色>/               可选：部件自己的配色域
    ├── index.ts
    └── theme.scss
```

部件配色注册进现有注册表，`page` 段记 `part:<部件id>` 命名空间（冒号不会与真实页面名撞——页面名过白名单不含冒号）。详见[无路由 · 作用域 · 部件](/guide/routerless)。

## 声明文件放哪

| 声明 | 位置 | 说明 |
| --- | --- | --- |
| 页面契约 | `<根目录>/views/<page>.ts` | 纯声明（`defineThemePage({ page })`），不能有逻辑；插件副作用 import 拉齐 |
| 设备清单 | **宿主** `src/view/devices.ts` | 不在主题目录——设备词汇是宿主事实，经 `createThemeState({ devices })` 注入 |
| 清单 | `<根目录>/theme.config.ts` | 调试开关；写错启动即抛（面板不出现这类症状无从归因） |
