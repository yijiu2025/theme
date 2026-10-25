# 调试

## 调试面板

dev 下（或清单开启的任意环境）在地址栏加触发参数：

```
/login?debug=theme        ← 默认触发键；可在 theme.config.ts 的 debug.query / debug.value 自定义
```

面板功能：查看当前 设备 / 页 / 版式 / 包 / 配色 / 明暗，点选即切换（版式与配色只写 store、不碰 URL），并显示 URL 非法值警告。

### 三档开关（`theme.config.ts`）

```ts
export default defineThemeManifest({
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
```

| 档 | 行为 |
| --- | --- |
| `off` | 面板主体是独立 chunk，**完全不下载、不执行**（门卫 `v-if` 恒 false） |
| `url` | **生产缺省**。不带触发参数同样不下载；带了才异步拉 chunk |
| `always` | 首屏就异步拉 chunk（演示 / 联调环境） |

::: tip 为什么 url 是生产缺省
真机没有 DevTools，线上排查「某个租户颜色不对」时能直接切主题看效果是刚需。面板内容只有主题名与色值，不构成信息泄露。
:::

## dev 探针（`window.__MAUTH_STORE__`）

dev 下带触发参数时挂载，右下角另有常驻角标（设备/页/版式/包 + 警告计数，红 = 当前有问题；点击打印快照）：

| 键 | 内容 |
| --- | --- |
| 11 个 store getter | `themeId` / `deviceTheme` / `viewIntent` / `deviceView` / `mode` / `packageId` / `activeDevice` / `activePage` / `activeView` / `activeThemeId` / `activeTone` |
| `url` | 地址栏主题参数原始值（白名单键归位，含重复键显影） |
| `effectiveView` | 当前设备生效版式的「输入 + 判定」（legal = null 表示无 URL 值或页未注册） |
| `warnings` | 当前存在的问题列表（每次刷新重算） |

链路显影：**地址栏原始值 → store 意图 → 生效结果**，联调一眼定位断在哪一环。

## 静默失败审计（dev 恒开）

主题链的失败几乎全是**静默**的——「怎么点都没变化」当时唯一的线索。以下四类问题在 dev 下**无条件**打 console（同一问题只喊一次），不靠「记得开开关」防：

| 类型 | 示例 | 警告内容 |
| --- | --- | --- |
| 未知设备锁定 | `?device=phon` | 列出已注册设备 + 兜底设备，锁定不生效 |
| 版式值不存在 | `?th=compat` | 带「可用版式：…」字典序建议；契约是非法值不回退、落当前包 |
| 其它设备的专属键错值 | `?th_tab=compact`（tablet 只有 default） | 现在不渲染、切过去才静默落包，提前报 |
| 白名单键重复 | `?th=a&th=b` | 版式键说「按未指定」、配色键说「取首值」——读取侧两种语义，文案分开说 |

::: warning 明确不检的
配色合法性（生效配色 = URL + localStorage + 用户操作 + 跨包兜底的合成，脱离 store 单看 URL 会误报）与通用键对其余设备的解析（部署方常有意只保一端）。
:::

宿主 / CI 可直接复用这套审计做链接体检（纯函数，打 dist 出口）：

```ts
import { parseThemeParams, collectWarnings } from 'skinsuite';

const params = parseThemeParams(query, { debugQuery: 'debug' }); // 触发键跟随清单配置
const warnings = collectWarnings(params, {
  activeDevice, activePage, packageId, pageRegistered,
  devices, hasView, listViews
});
```

## dev 防呆：注册表为空

store 装配时注册表为空（最常见：store 文件漏了 `import 'virtual:theme'`）会输出三步排查指引——此前页面正常渲染、只是没主题、零报错，是「最难归因」的失败形态。生产不喊（静默兜底是机制对「还没建主题」的合法状态的承诺）。

## 构建期警告

插件扫描的「写歪就跳过」点（包缺 index.ts、页面缺 index.vue、配色缺 index.ts、部件缺 index.vue）在 dev server 下以 `[theme] 扫描跳过 <路径>：<原因>` **去重**警告；构建期零噪音。
