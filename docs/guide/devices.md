# 设备与容器

## 设备是宿主的事实

库**零判定、零词汇、零布线工具**：「当前属于哪台设备」「有哪些设备」「容器组件在哪」全部是宿主的决定——视口阈值取 768 还是别的、UA 命中算不算、`?isMobile=true` / `?from=mini` / `?device=` 这些 URL 词汇，换个产品就变。所以：

- **取值集合 + 容器布线** → 宿主设备清单（一份声明 = 词汇 + 布线），以**词汇投影**注入 `createThemeState({ devices })`；
- **判定与装配机制** → 宿主自己的设备机制层（oauth21 = `src/device/`：`createDeviceModule` 工厂 + `pageContainers` 布线工具 + 判定纯函数）；
- 库只经 `<ThemeView device>` props **接收结果**并按设备渲染。

::: warning 别把宿主设备机制当成 skinsuite 的导出
`pageContainers` / `createDeviceModule` / `HostDeviceInput` 住在宿主 `src/device/`，**不是 `skinsuite` 的导出**——本库自 0.9 起不持有设备注册表与布线工具。设备侧与主题侧**彻底分离**：设备清单文件不 import 任何主题库的东西；注入主题 store 时用一份**词汇投影**（只取 id / label / urlKey 三字段，`containers` 等设备侧事实不进主题）：
:::

## 清单文件（宿主 `src/view/devices.ts`，2026-10-24 定稿形态）

一份声明 = **词汇 + 容器布线 + 模块装配**；`DEVICES` 数组序 = 优先级，**末条 = 兜底设备**（不写死某个设备名）：

```ts
import type { Component } from 'vue';
import { createDeviceModule, pageContainers } from '@/device';   // ← 宿主设备机制层
import type { HostDeviceInput } from '@/device';

/** 设备清单：一条 = 词汇（id/label/urlKey）+ 该设备的容器布线（序 = 优先级，末条 = 兜底） */
export const DEVICES: readonly HostDeviceInput[] = [
  {
    id: 'mini',
    label: '紧凑版',
    urlKey: 'mini',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Mini/)
  },
  {
    id: 'mobile',
    label: '手机端',
    urlKey: 'mobile',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'standard',
    label: '桌面端',
    urlKey: 'std',
    containers: () =>
      pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/*.vue'), /^Standard/)
  }
];

/** 设备模块实例（判定接线 + 页面装配）—— 页面分发器经此消费 */
export const device = createDeviceModule({ devices: DEVICES });
```

`DeviceVocab` 三个字段（主题 store 消费的部分）：

| 字段 | 用途 |
| --- | --- |
| `id` | 设备 id = 主题包内的目录名（`[a-z0-9-]`） |
| `label` | 显示名（调试面板 / 日志用） |
| `urlKey?` | URL 参数后缀（`?th_<urlKey>` / `?th_color_<urlKey>`）；缺省回落 `id` |

数据口径：容器位置约定 = **页面名是容器文件的上一级目录名**（`view/web/login/MiniLogin.vue` → 页面 `login`）；web 家族（mini / standard）共用 `view/web` 同一份 glob、靠文件名前缀区分；mobile / tablet 各自目录树以 `index.vue` 为入口。

## 判定放 utils 层（宿主）

```ts
// src/utils/device-resolve.ts（宿主侧，纯函数：query/path/视口显式入参，零 import）
export function resolveRenderDevice(
  query: Record<string, unknown>,
  path: string,
  mobile: boolean
): string | null {
  if (query.device) return query.device as string;  // ?device= 一次性锁定
  if (query.isMobile === 'true') return 'mobile';   // 显式意图
  if (query.from === 'mini') return 'mini';         // 来源标记
  if (mobile) return 'mobile';                      // 视口 + UA（调用方喂信号）
  return null;                                      // null = 落兜底设备（末条）
}
```

```ts
// src/composables/useRenderDevice.ts（薄封装：route + 视口信号 → 判定纯函数）
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { mobileViewport } from '@/utils/device';
import { resolveRenderDevice } from '@/utils/device-resolve';

export function useRenderDevice() {
  const route = useRoute();
  // route.query / mobileViewport 被 computed 自动收集 → 跨断点翻转 / 换路由即重判
  return computed(() => resolveRenderDevice(route.query, route.path, mobileViewport().value));
}
```

::: warning 库不订阅 matchMedia
「什么算变了」也是宿主口径。把视口做成宿主的响应式信号（`mobileViewport()`），判定函数的入参就是它，依赖由 computed 自动收集。
:::

## 分发器选容器（不碰主题）

分发器只做一件事：按宿主判定结果选容器组件——容器查询走**设备模块实例或清单**，主题感知交给被选中容器里的 `<ThemeView>`：

```ts
// view/web/login/index.vue（页面分发器）
import { computed, defineAsyncComponent } from 'vue';
import { DEVICES } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';

const renderDevice = useRenderDevice();   // 宿主判定 → 设备 id
const deviceComponents = new Map(
  DEVICES.map(d => [d.id, defineAsyncComponent(d.containers().get('login')!)])
);
const activeComponent = computed(
  () => deviceComponents.get(renderDevice.value)
    ?? deviceComponents.get(DEVICES[DEVICES.length - 1]!.id)!
);
```

## 容器位置约定

**页面名 = 文件上一级目录名**（宿主的容器布线工具取 glob 路径倒数第二段——oauth21 里就是 `pageContainers`）。glob 模式与文件名约定由各设备的清单条目决定：

| 设备 | glob 示例 | 实际位置约定 |
| --- | --- | --- |
| `mobile` | `/src/view/app/*/index.vue` | `view/app/<页面>/index.vue` |
| `tablet` | `/src/view/tablet/*/index.vue` | `view/tablet/<页面>/index.vue` |
| `standard` | `/src/view/web/*/Standard*.vue` | `view/web/<页面>/Standard<页面>.vue` |
| `mini` | `/src/view/web/*/Mini*.vue` | `view/web/<页面>/Mini<页面>.vue` |

::: danger standard / mini 共用 view/web/
靠文件名前缀区分设备、靠目录名区分页面。把 `StandardLogin.vue` 直接摊在 `view/web/` 下 ⇒ 页面名被算成 `web` ⇒ 该设备在这一页「没写容器」⇒ 分发器取不到（standard 是兜底，连兜底也空就 throw）。**症状**：类型检查 / lint / build 全绿（glob 是静态的、文件确实进了产物），只在运行时分发取不到容器才炸。

`import.meta.glob` 的 `*` **不跨 `/`**，`web/*/*.vue` 恰好吃「一层目录 + 一个文件」，不需要 `**`。
:::

## 设备身份怎么进主题

不靠分发器接线，靠被选中容器里的 `<ThemeView>`——它的 `device` prop 就是「本容器渲染在哪台设备上」，setup 里 `watch(immediate)` 调 `store.setActiveDevice(device)`，与 `setActivePageView` 同帧完成。**不要在容器里再手写 `setActiveDevice` / `setActivePageView`**——那些是旧版样板，`device` prop 本身就是告知。

**加一种设备**要动的三处：清单一条声明 / 判定一条分支（如需）+ 容器组件 / 主题包里加设备目录。**库零改动。**
