# 设备与容器

## 设备是宿主的词汇表

库**零判定、零词汇**：「当前属于哪台设备」是业务口径——视口阈值取 768 还是别的、UA 命中算不算、`?isMobile=true` / `?from=mini` / `?device=` 这些 URL 词汇，换个产品就变。所以：

- **取值集合**（有哪些设备、叫什么）→ 宿主清单声明，`createThemeState({ devices })` 注入；
- **判定**（怎么知道当前是哪台）→ 宿主分发器（utils 纯函数 + 薄 composable）；
- **容器布线**（哪台设备用哪些组件）→ 宿主清单自持；
- 库只经 `<ThemeView device>` props **接收结果**并按设备渲染。

## 清单文件（宿主 `src/view/devices.ts`）

```ts
import type { Component } from 'vue';
import type { DeviceVocab } from 'skinsuite/vue';

export interface HostDeviceDef extends DeviceVocab {
  containers: ReadonlyMap<string, () => Promise<{ default: Component }>>;  // 页面 → 容器
}

/** glob 结果 → 「页面名 → 加载器」表：路径倒数第二段 = 页面名 */
function containerMap(glob: Record<string, () => Promise<{ default: Component }>>) {
  const map = new Map<string, () => Promise<{ default: Component }>>();
  for (const [path, loader] of Object.entries(glob)) {
    const page = path.split('/').at(-2);
    if (page) map.set(page, loader);
  }
  return map;
}

// 数组序 = 优先级；最后一条是兜底设备（库只认顺序，不认设备名）
export const DEVICES: readonly HostDeviceDef[] = [
  { id: 'mobile', label: '手机端', urlKey: 'mobile',
    containers: containerMap(import.meta.glob('/src/view/app/*/index.vue')) },
  { id: 'standard', label: '桌面端', urlKey: 'std',
    containers: containerMap(import.meta.glob('/src/view/web/*/Standard*.vue')) }
];
```

`DeviceVocab` 三个字段：

| 字段 | 用途 |
| --- | --- |
| `id` | 设备 id = 主题包内的目录名（`[a-z0-9-]`） |
| `label` | 显示名（调试面板 / 日志用） |
| `urlKey?` | URL 参数后缀（`?th_<urlKey>` / `?th_color_<urlKey>`）；缺省回落 `id` |

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

```ts
// view/web/<page>/index.vue（页面分发器）
import { computed, defineAsyncComponent } from 'vue';
import { deviceIds, fallbackDevice, resolveContainerOf } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';

const device = useRenderDevice();
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'login'))])
);
const activeComponent = computed(() => {
  const fallback = fallbackDevice();
  return deviceComponents.get(device.value ?? fallback) ?? deviceComponents.get(fallback)!;
});
```

## 容器位置约定

**页面名 = 文件上一级目录名**（`containerMap` 取 glob 路径倒数第二段）。glob 模式与文件名约定由各设备的清单条目决定：

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
