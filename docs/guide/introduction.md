# 简介

skinsuite 是一套「多主题 / 多版式」机制的**实现库**：把换肤、换布局、多端适配做成可声明、可组合、可审计的目录约定 + 一小组运行时。

::: tip 一句话心智模型
**主题包 = 一整套设计**（版式组件 + 配色目录），按 `包 × 设备 × 页面 × 配色` 四段键解析；
业务代码持有「容器」，版式组件只管「长什么样」，两者通过 `ctx` 单向连接。
:::

## 它解决什么

| 诉求 | skinsuite 的答案 |
| --- | --- |
| 换配色（品牌色 / 明暗） | 配色目录（`colors/<id>/`），token + 可选 theme.scss |
| 换版式（同一页不同 DOM / 交互） | 版式跟随主题包：换版式 = 新建一个包 |
| 多端（手机 / 桌面 / mini 各自布局） | 包内按设备分区，设备词汇宿主自定 |
| 一条链接给不同端各指定一套 | 设备维度 URL 参数（`?th_mobile=…&th_std=…`） |
| 外部控制主题（父 iframe / 后端） | postMessage 协议 + 后端下发端点（可选启用） |
| 防注入 | token 名值双白名单；`url()` / 规则闭合字符一律拒绝 |

## 三个入口

按需 import，依赖方向单向：

```
skinsuite            纯内核 —— 零依赖、零 DOM、零 Vue（Node / SSR / 任意框架可用）
skinsuite/vue        Vue 绑定 —— 状态机 + 组件 + 注册表（唯一 import 'vue' 的层）
skinsuite/vite       构建插件 —— 扫主题目录生成 virtual:theme（唯一 import 'vite' 的层）
```

```ts
// 纯内核：任何地方可用（含 React / Node 脚本 / 单测）
import { sanitizeOverrides, THEME_ID_RE } from 'skinsuite';

// Vue 绑定：状态机 + 组件
import { createThemeState, ThemeRoot, ThemeView } from 'skinsuite/vue';

// Vite 插件：vite.config.ts 一行
import { themeAssets } from 'skinsuite/vite';
```

## 数据怎么流动

```
构建期  themeAssets() 扫描主题目录 ──生成──▶ virtual:theme（三张加载表 + 清单）
                                            │ import 副作用自动装配
运行时  createThemeState() ──▶ scope(作用域) / intent(意图) / runtime(注入)
                                            │
宿主    <ThemeView page device> ──告知──▶ store（唯一事实源）──▶ html 上写 --mauth-* 变量
```

宿主与库的相遇点只有两个显式注入：

- `createThemeState({ devices })` —— 设备词汇（库不自持设备注册表）；
- `themeAssets()` —— 主题目录（缺省走 env `VITE_THEME_DIR`）。

## 边界：什么不在包里

| 不在 | 由谁提供 |
| --- | --- |
| 设备判定（视口 / UA / `?device=` 语义） | 宿主分发器（库只经 `<ThemeView device>` 接收结果） |
| 路由 | 宿主（`app.use(theme, { router })` 只递一个最小结构） |
| DOM / localStorage | 宿主，或 `skinsuite/vue` 默认实现（键可覆盖） |
| 业务资产（`themes/**`） | 随应用走 |

## 版本与兼容

- 语义化版本，ESM only，Node >= 18；
- **0.x 阶段次要版本允许重命名导出**（显式具名导出，改名即 semver-minor）——升级前看 [CHANGELOG](https://github.com/yijiu2025/theme/blob/main/CHANGELOG.md)；
- 当前唯一公开消费者是 oauth21 登录页，公开面按「显式具名导出」管理，`export *` 不被允许。
