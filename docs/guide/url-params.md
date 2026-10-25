# URL 参数手册

统一下划线键形；设备专属键优先于通用键；空值 = 未指定（不会顶掉通用键）。

## 版式与配色

| 参数 | 含义 | 取值链 |
| --- | --- | --- |
| `?th=<包>` | 版式意图，全设备 | `th_<urlKey>` → `th` → 包默认 |
| `?th_<urlKey>=<包>` | 单设备版式意图 | 同链，按设备各一条 |
| `?th_color=<配色>` | 配色意图，全设备 | `th_color_<urlKey>` → `th_color` → 落盘偏好 → 作用域默认 |
| `?th_color_<urlKey>=<配色>` | 单设备配色意图 | 同链，按设备各一条 |

`<urlKey>` 是设备清单里声明的缩写（缺省回落设备 id）。

示例：

```
/login?th=compact                        三端共用（哪端没有就自动下沉到当前包）
/login?th_mobile=default&th_std=compact  各端各指定（其它设备走通用 / 包默认）
/login?th_color=blue                     三端换配色
/login?th_color_std=black                只给桌面端换配色
```

::: tip 非法值不会锁死任何东西
`?th=compat`（拼错）不报错、沿链回落包默认；dev 下 console 会出 `[theme]` 警告（无门控，静默失败显影），带 `?debug=theme` 时探针 `warnings` 里能看到完整判定。详见[调试](/guide/debug)。
:::

## 设备锁定

| 参数 | 含义 |
| --- | --- |
| `?device=<设备id>` | 锁定设备（**宿主判定模块的词汇**，语义由宿主定义，刷新后失效） |

库不认识 `?device=` 的取值集合——它只是宿主判定纯函数读的一个 query 键。dev 下未知设备 id 会被审计警告（`?device=phon` → 「不是已注册设备，分发器会静默落兜底设备」）。

## 语义细则（读取侧契约）

- **空串 = 未指定**：`?th_std=` 不顶掉 `?th=compact`——部署方常把参数留空当作「这台设备不特殊指定」。
- **重复键**（`?th=a&th=b`，router 给数组）：版式键按**未指定**处理（拒绝数组，不猜）；配色键（`URLSearchParams.get`）**取首值**。两种净效果不同，dev 审计的警告文案分开说。
- **版式意图不落盘**：URL 只负责初始化播种，运行时读写走 store；换包即重置。
- **配置色意图落 localStorage**（`mauth:theme`，键可覆盖）：显式操作（点色卡）会清掉当前设备的 URL 覆盖。

## 优先级总链

```
URL 显式意图（设备专属 > 通用）
  ＞ 后端下发（VITE_THEME_ENDPOINT，可选）
  ＞ 用户本地偏好（localStorage）
  ＞ 包/配色声明（views.<page>）
  ＞ 当前包名（view ≡ pkg）
```

## 明暗没有 URL 入口（设计如此）

明暗（`mode`）是用户偏好，落 localStorage（`mauth:mode` / `mauth:theme`；0.7.x 的旧裸键有一次性读迁移）。URL 不提供 `?mode=`——明暗见[明暗与色系](/guide/modes)。

## 自定义参数名

`createThemeState` 可换前缀（同源多应用隔离 / 避免与既有业务键撞名）：

```ts
createThemeState({
  colorParam: 'brand',    // → ?brand=<id> / ?brand_<urlKey>=<id>
  viewParam: 'layout'     // → ?layout=<pkg> / ?layout_<urlKey>=<pkg>
})
```

调试面板的触发键（`?debug=theme`）由清单配置：`debug: { enabled: 'url', query: 'debug', value: 'theme' }` 的 `query` / `value` 都可自定义。
