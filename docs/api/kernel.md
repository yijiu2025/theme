# 内核 `skinsuite`

纯内核：零依赖、零 DOM、零框架。任何前端（Vue / React / Node / SSR）可用。

## 常量与白名单

| 导出 | 说明 |
| --- | --- |
| `THEME_ID_RE` | 目录名 / id 白名单 `/^[a-z0-9-]+$/`（包名、设备、页面、配色、部件共用） |
| `DEFAULT_THEME_ID` | 空记录占位配色 id（`'default'`） |
| `DEFAULT_THEME_PACKAGE` | 内置默认包 id（`'default'`，eager 首屏零请求） |
| `DEFAULT_THEME_COLOR` | 默认配色 id（`'white'`） |
| `DEFAULT_THEME_DARK_COLOR` | 默认暗系配色 id（`'black'`） |
| `THEME_DIR_LEVELS` | 取值目录段 `['pkg','device','page','colorId']` |
| `THEME_COLORS_SEGMENT` | 配色固定字面段（`'colors'`） |
| `THEME_PARTS_SEGMENT` | 部件固定字面段（`'parts'`） |
| `THEME_COLOR_STYLE_FILE` | 附加样式文件名（`'theme.scss'`） |
| `THEME_DEF_FILE_CANDIDATES` | 定义文件形态 `['index.ts','index.js']`（并存 `.ts` 优先） |

## 明暗与系别

| 导出 | 说明 |
| --- | --- |
| `MODE_CYCLE` | 切换循环序 `['system','light','dark']` |
| `MODE_LABELS` | 明暗文案（跟随系统 / 明 / 暗） |
| `isThemeMode(v)` / `normalizeMode(raw)` | 校验 / 归一（trim+小写，非法返回 null） |
| `THEME_TONES` / `TONE_LABELS` | 系别集合与文案（白系 / 黑系） |
| `isThemeTone(v)` / `normalizeTone(raw)` | 同上，无 `system`（系别是配色自带属性） |
| `ThemeMode` / `ThemeTone` | 类型 `'system'\|'light'\|'dark'` / `'light'\|'dark'` |

## token 安全校验

```ts
import { sanitizeOverrides, isSafeTokenEntry } from 'skinsuite';

const { tokens, rejected } = sanitizeOverrides(payload);
// tokens: 通过白名单的键值对；rejected: 被拒项（"name=值前40字符"），逐条丢弃不整体拒绝
```

| 导出 | 说明 |
| --- | --- |
| `isSafeTokenName(name)` | 名字必须 `--mauth-<短横线>` |
| `isSafeTokenValue(value)` | 白名单：hex / rgb() / hsl() / 长度 / `var(--mauth-*)` / 关键字；拒 `url()`、颜色名、规则闭合字符 |
| `isSafeTokenEntry(name, value)` | 键值对校验（`--mauth-font-family` 字体栈特例放宽） |
| `sanitizeOverrides(input)` | 逐条过滤，返回 `SanitizeResult` |
| `ThemeTokenOverrides` | `Record<string, string>`（扁平、不分明暗档） |
| `ThemeTokenLayers` | `{ theme?, external? }` 注入分层 |

## 注册表（构建 + 查询）

```ts
import { buildThemeRegistry, installThemeRegistry, getThemeRecord } from 'skinsuite';
import * as virtualTheme from 'virtual:theme';   // 通常经副作用 import 自动装配

installThemeRegistry(buildThemeRegistry(virtualTheme));
```

| 导出 | 说明 |
| --- | --- |
| `buildThemeRegistry(modules, onWarn?)` | 三张加载表 → `Map<'pkg/device/page/colorId', MauthThemeRecord>`；重名先到先得并告警 |
| `installThemeRegistry(registry)` | 装入模块级单例（宿主启动时调一次；`virtual:theme` 自动装配） |
| `getThemeRecord({id, device, pkg?, page})` | 回退链：精确 → 同系别首套 → 兜底色 → 空记录 |
| `getDefaultThemeId({device, page, pkg?})` | 范围兜底色（white 优先，无则字母序第一；空范围 null） |
| `listThemes(device?)` | 当前有哪些配色（可选按设备过滤） |
| `listColorsOf(device, page, pkg)` | 某范围全部配色（按 id 去重排序） |
| `toneOfColor(id, device, page, pkg)` | 某配色的系别；未登记 null |
| `toneOfAnyScope(id)` | 某配色系别（任意登记处，路径序第一份） |
| `listColorIdsOfTone(device, page, pkg, tone)` | 某范围某系别的全部配色 id |
| `resolveThemeId(raw, device?, page?, pkg?)` | 归一化并校验外部传入的配色 id（URL / 后端下发） |
| `isKnownTheme(id, ...)` | 包装 `resolveThemeId` 返回布尔 |
| `listColorViews(device, page)` | 某设备某页下登记过配色的包集合 |
| `ThemeAssetModules` | 虚拟模块三张加载表的形态 |
| `MauthThemeMeta/Package/Color/Record` | 契约类型（文档注释即规格） |

## 设备维度 URL 参数

| 导出 | 说明 |
| --- | --- |
| `readDeviceParam(query, name, deviceKey)` | 单设备取值：专属键 → 通用键 → undefined（原样不校验；空串 = 未指定） |
| `readUrlViewIntent(query, viewParam?, devices?)` | 全设备一次读入版式意图 `{ deviceView, viewIntent }` |
| `viewParamsSnapshot(query, ...)` | `th*` 键白名单快照（不含配色键）——「仅当原始值变化才同步」的判等用 |
| `sameViewSnapshot(a, b)` | 快照判等 |
| `DEFAULT_VIEW_PARAM` / `DEVICE_SCOPED_PARAMS` | `'th'` / `['th','th_color']` |
| `DeviceScopedParam` / `DeviceViewIntent` | 类型 |

## 静默失败审计

```ts
import { parseThemeParams, collectWarnings, effectiveViewRaw } from 'skinsuite';

const params = parseThemeParams(routeQuery, { debugQuery: 'debug' }); // 触发键跟随清单配置
const warnings = collectWarnings(params, ctx);  // 人类可读警告列表（空 = 没问题）
```

| 导出 | 说明 |
| --- | --- |
| `parseThemeParams(query, { debugQuery? })` | 白名单键归位：`th` / `th_color` / `device` / 调试键 / 设备专属键；重复键进 `repeated` 带首值 |
| `effectiveViewRaw(params, urlKey)` | 某设备生效的版式原始值（专属 > 通用 > null） |
| `collectWarnings(params, ctx)` | 四类静默失败显影（未知设备 / 版式值不存在 / 其它设备专属键 / 重复键）；配色合法性**不检** |
| `WarningContext` | 判定输入全部显式注入（`hasView` / `devices` / `listViews` …），纯函数可单测 |
| `ThemeUrlParams` / `RepeatedParam` / `ParamAuditDevice` | 类型 |

## 主题域清单

```ts
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
```

| 导出 | 说明 |
| --- | --- |
| `defineThemeManifest(manifest?)` | 声明并校验清单；非法档位 / 空键名**启动即抛** |
| `resolveThemeManifest(manifest?)` | null 兜底机制默认（`url` 档），不让应用起不来 |
| `isThemeDebugVisible(debug, query)` | `off→false；always→true；url→任一元素 === value`（对齐 vue-router LocationQuery） |
| `installThemeManifest(m)` / `themeManifest()` | 清单单例装入 / 读取 |
| `ThemeManifest` / `ResolvedThemeManifest` / `ThemeDebugMode` / `ResolvedThemeDebug` | 类型 |

## 其它

| 导出 | 说明 |
| --- | --- |
| `normalizeRemoteThemeConfig(data)` | 外部下发配置形状归一（`{ theme?, mode?, tokens? }`；全空返回 null；**只归一形状，不碰网络**） |
| `RemoteThemeConfig` / `DeviceVocab` | 类型 |
