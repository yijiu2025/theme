# 无路由 · 作用域 · 部件

三个「路由树之外」的场景：无路由应用、钉死配色的子树、主题化的弹窗部件。

## 无路由应用（P0）

纯 UI 壳 / 工具页 / 嵌入式小组件没有 vue-router——`app.use(theme)` **无参可用**：

```ts
// bootstrap.ts（无路由版）
app.use(createPinia());
app.use(theme);                     // ✅ 无参：router 可选
app.mount('#app');
```

```vue
<!-- App.vue：ThemeScope 是 token-only 锚点 -->
<ThemeRoot :theme-store="themeStore">
  <ThemeScope page="app" device="standard">
    <ModalHost /> <MessageToast />
  </ThemeScope>
</ThemeRoot>
```

要点：

- 主题目录里给壳层建一个**普通页面目录**（`themes/default/standard/app/colors/...`）——壳层就是主题机制的普通页面，零新增概念；
- `<ThemeScope page device>` 是 `<ThemeView>` 的 token-only 子集：只锚定作用域（`setActivePageView` / `setActiveDevice`）、不查版式注册表、不加载版式组件（主题目录无需 `.vue`），模板只有一个 `<slot />`；
- `createThemeState({ defaultPage: 'app' })` 是兜底保险：没有任何 ThemeView / ThemeScope 挂载时（或 headless 消费）token 也能从首帧解析；
- 无路由时 `?th_color=blue` / `?th=compact` 读 `location.search` **装载时一次性快照**——URL 本来不变，无响应性需求。

## 钉死 / 并行主题（P1a `<ThemeProvider>`）

给一段子树一套**自己的主题**（弹窗锁死品牌色；暗色面板浮在浅色页面上）：

```vue
<ThemeProvider page="app" device="standard" color-id="black">
  <FloatingQuickPanel />
</ThemeProvider>
```

- 解析走内核纯查询（`resolveScopedRecord`），**不读不写全局 store**——全局换肤、路由切换都不影响本容器，反之亦然；
- token 注入到**本组件根元素**，沿 DOM 子树继承；`.dark` 类与 `data-mauth-theme` 挂本元素；
- `color-id` 缺省取该范围兜底色；指定了但不存在：dev 警告 + 回落兜底，prod 静默兜底；
- **作用域 = tokens-only**：`theme.scss` 与基线 `html.dark` 块不进作用域（它的选择器契约是 `html[data-mauth-theme]` 前缀）；作用域暗色依赖该配色**自带完整底色 token**。

::: tip 什么时候不该用
叠层 UI 跟随当前主题是**默认且免费**的（CSS 变量从 html 根继承）——只有需要「钉死/并行」时才包本容器。常态是裸用。
:::

## 主题化部件（P1b `<ThemePart>`）

弹窗 / 通知 / 悬浮窗的 **DOM 本身**随包换肤：

```vue
<Teleport to="body">
  <div v-if="open" class="modal-mask" @click.self="ctx.onCancel">
    <ThemePart id="confirm-modal" :ctx="ctx" />
  </div>
</Teleport>
```

目录契约（与页面平级，住在包内）：

```
themes/<包>/<设备>/parts/<部件id>/index.vue        ← 部件 DOM（换版式 = 换包）
themes/<包>/<设备>/parts/<部件id>/colors/<配色>/    ← 可选：部件自己的配色域
theme/parts/<部件id>.ts                            ← ctx 契约（纯类型，所有包共用）
```

```ts
// theme/parts/confirm-modal.ts —— 部件契约
export interface ConfirmModalProps {
  ctx: {
    title: string;
    body: string;
    type?: 'default' | 'danger';      // 调用侧展示变体走 ctx 字段，不是 id 维度
    actions: { onConfirm(): void; onCancel(): void };
  };
}
```

`<ThemePart id :ctx? :device? :pkg? :color-id?>` 与 `<ThemeView>` 的三点本质差异：

1. 解析键是 (pkg × device × partId)，**不查页面注册表**、不要求 `defineThemePage`；
2. 🔴 **绝不调 `setActivePageView` / `setActiveDevice`**——用 `<ThemeView page="modal-x">` 渲染弹窗会把背景页面的配色域劫持到弹窗页（弹窗一开背景换肤闪变），本组件为此存在；
3. 颜色默认**继承全局 token**（零成本）；显式给 `color-id` 时注入部件自己的配色到本组件根元素（作用域注入，不碰 store）。

实现选择：当前包（`store.packageId`，只读）有该部件就用它；否则回落 default 包（eager）。都没有：渲染缺省 + dev 警告（显式失败，不静默白屏）。

::: danger 行为放宿主容器
弹窗的开关状态 / Teleport / z-index / 焦点圈 / 动画归**宿主的行为容器**（唯一一份）；部件实现只吃 `ctx`、只调 `ctx.actions`。容器 / 呈现分离——否则每个包一份行为副本，改 bug 要改 N 处。
:::

## 组合建议

| 场景 | 做法 |
| --- | --- |
| 弹窗 / 通知**跟随当前主题** | 裸用（CSS 变量从 html 根继承，零成本） |
| 弹窗 / 悬浮窗**钉死配色** | `<ThemeProvider page device color-id="black">` |
| 弹窗 DOM **随包换肤** | 行为容器里 `<ThemePart id="confirm-modal" :ctx />` |
