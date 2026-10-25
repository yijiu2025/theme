# 外部主题来源

除 URL / 用户操作 / localStorage 外，主题还有两个可选的外部来源——都**缺省关闭**，env 配了才活。

## 来源优先级

```
URL 显式意图（?th_color= 等）
  ＞ 后端下发（VITE_THEME_ENDPOINT）
  ＞ 用户本地偏好（localStorage）
  ＞ 包/配色声明
```

## 一、iframe 嵌入：父应用用 URL 控制主题

父应用拼 iframe src 时直接带参数——**首帧生效、锁定该设备**（后端下发与本地偏好都压不过它）：

```html
<iframe src="https://auth.example.com/m/login?client_id=posecraft&th_color=blue"></iframe>
```

要做的内容工作：把各租户的品牌配色作为正式配色目录放进主题包的对应作用域（包 × 设备 × 页面），id 起租户名（如 `posecraft`）。client_id → 配色 id 的映射放在**父应用自己的配置里**。

### 运行时跟随切换（postMessage）

父应用切主题时想让 iframe **跟着变**（不刷新），走 `THEME_CHANGE` 消息：

```js
// 父应用
iframe.contentWindow.postMessage(
  { type: 'THEME_CHANGE', isDark: true, theme: 'black', tokens: { '--mauth-primary': '#e11d48' } },
  'https://auth.example.com'
);
```

| 字段 | 说明 |
| --- | --- |
| `isDark` | 旧协议：只同步明暗（布尔） |
| `theme` | 新协议：配色 id（必须是已注册配色） |
| `tokens` | 新协议：扁平 CSS 变量覆写（**逐条过白名单**——父页面虽是受信来源，postMessage 载荷终究是外部输入，未校验就写 CSS 变量等于开 CSS 注入的口子） |

宿主 env 配白名单（逗号分隔，**只写会嵌本页的父应用**，别写自己的域名）：

```ini
VITE_ALLOWED_PARENT_ORIGINS=https://app.example.com,https://posecraft.example.com
```

::: warning 留空 = 不启用
白名单为空时整个父同步功能不挂监听（fail-closed）。**漏配的症状是「弹窗 loading 慢」而不是报错**——`SSO_READY` 握手被拒发，宿主等满自己的兜底超时。排查任何 iframe 握手类「慢」，第一件事看控制台有没有 origin 拒绝日志。
:::

## 二、后端按身份下发（`VITE_THEME_ENDPOINT`）

```ini
VITE_THEME_ENDPOINT=/api/theme    # 空串 = 机制关闭，不发任何请求
```

启用后，store 创建那一刻自动发 `GET {端点}?{remoteParams 给的身份参数}`——**身份参数键名由宿主决定**（库不读 URL、不预设 `client_id` 等业务词汇）：

```ts
createThemeState({
  devices: DEVICES.map(({ id, label, urlKey }) => ({ id, label, urlKey })),  // 词汇投影
  // 按租户：oauth21 恢复原行为的写法
  remoteParams: () => ({ client_id: new URLSearchParams(location.search).get('client_id') ?? '' }),
  // 或按用户 / 按接入应用：
  // remoteParams: () => ({ user_id: user.id })
  // remoteParams: () => ({ app: 'posecraft', page: 'login' })
})
```

### 响应契约

```json
{
  "theme": "blue",
  "mode": "light",
  "tokens": { "--mauth-primary": "#e11d48", "--mauth-radius": "12px" }
}
```

| 字段 | 校验 | 语义 |
| --- | --- | --- |
| `theme` | 必须是当前作用域**已注册**的配色 id，查不到静默丢弃 | 换到该配色（L2：内置配色间切换） |
| `mode` | `light / dark / system` 之外的值丢弃 | 明暗初值 |
| `tokens` | 逐条过 `--mauth-*` 名值白名单（拒 `url()`、颜色名、规则闭合字符），被拒项告警 | 品牌色微调（L1：改色值不发版） |

### 行为要点

- **首屏不阻塞**：先用本地默认配色渲染，响应到了再切（约有一帧闪变——父应用要零闪变请用 URL 参数方案）；
- **失败全静默**：超时（默认 3s，可调）/ 非 200 / JSON 不合法 / 归一后全空 → null，维持本地配色——主题是锦上添花，绝不能挡住页面；
- **默认不带 cookie**（`credentials: 'omit'`，防把登录态发到第三方域名；调用层可用 `omitCredentials: false` 放开）；
- store 被 dispose 时在途请求 abort，迟到响应不写已废弃状态；
- 该设备被 `?th_color=` 显式锁定时，后端下发的 `theme` **不生效**（URL 意图优先）。

::: info 边界：这套接口只做「改色不发版」
响应里的 `theme` 只能在**构建期已登记**的配色里选（注册表是构建期扫出来的，目录里没有的 id 会被判非法回落）。远程换**整套设计**（新配色 + 新结构 + 新版式）是规划中的 L3（主题包产物发 CDN + 运行时热更注册表），尚未实现——见仓库 `oauth21/docs/theme-hot-update.md` 的三层模型。
:::

## 三、选型建议

| 场景 | 方案 |
| --- | --- |
| 第三方接入方控制登录页主题 | iframe URL 参数（零开发、零闪变、锁定设备） |
| 第一方父应用运行时跟随切换 | postMessage `THEME_CHANGE` + origin 白名单 |
| 新增租户不想发前端版 / 租户色值频繁微调 | `VITE_THEME_ENDPOINT` + `remoteParams` |
| 三者并存 | 天然不打架：URL ＞ 后端 ＞ 本地偏好 |
