# 设备机制层（宿主参考示例）

设备机制（判定 / 容器布线 / 模块装配）是**宿主的子系统**——skinsuite 不提供它，也不规定实现。其它章节示例里的 `@/device` 导入（`createDeviceModule` / `pageContainers` / `HostDeviceInput`）指的就是这一层。本页给一份**最小参考实现**：可以照抄，也可以只借鉴形状。生产实现的完整版见 oauth21 的 `src/device/`（多了分发器装配与判定接线）。

## 它住在哪、管什么

```
src/device/          ← 纯机制层：类型 + 纯工具 + 装配工厂
├── types.ts         契约（HostDeviceInput / DeviceModule）
├── tools.ts         pageContainers（glob → 页面名 → 加载器）
└── runtime.ts       createDeviceModule（清单 → 可消费实例）

src/view/devices.ts  ← 宿主事实：只有设备清单与实例（零主题库 import，见[设备与容器](/guide/devices)）
src/utils/           ← 判定纯函数 + 薄 composable（视口 / UA / ?device= 语义）
```

三层纪律：**机制层零宿主事实**（不认识 mobile / standard）、**清单零机制逻辑**（只有事实）、**两侧零主题库依赖**（主题侧只拿词汇投影）。

## 参考实现

### `types.ts` —— 契约

```ts
import type { Component } from 'vue';

/** 容器加载器：懒加载某页面在某设备上的容器组件 */
export type DeviceContainerLoader = () => Promise<{ default: Component }>;

/** 一台设备的声明（宿主事实的形状） */
export interface HostDeviceInput {
  /** 设备 id = 主题包内目录名（[a-z0-9-]） */
  id: string;
  /** 显示名（调试面板 / 日志用） */
  label: string;
  /** URL 参数后缀（?th_<urlKey> / ?th_color_<urlKey>）；缺省回落 id；🔴 不能是 color / color_ 开头（配色键固定形态） */
  urlKey?: string;
  /** 页面 → 容器加载器。函数形态 = 惰性构建，模块求值期不扫 glob */
  containers: () => ReadonlyMap<string, DeviceContainerLoader>;
}

/** 装配后的设备模块实例（页面分发器消费的公开面） */
export interface DeviceModule {
  readonly devices: readonly HostDeviceInput[];
  /** 兜底设备 id = 清单末条（数组序 = 优先级） */
  readonly fallbackId: string;
  /** 全部设备 id（按优先级序） */
  ids(): string[];
  /** 某设备某页的容器加载器；未知设备落兜底，兜底也没有则 null */
  resolveContainer(id: string, page: string): DeviceContainerLoader | null;
}
```

### `tools.ts` —— 容器布线纯工具

```ts
import type { DeviceContainerLoader } from './types';

/**
 * glob 结果 → 「页面名 → 容器加载器」表。
 * 页面名 = 路径倒数第二段（view/app/login/index.vue → login）；
 * fileRe 按文件名前缀区分共用目录的设备家族（view/web 下 Mini* / Standard*）。
 */
export function pageContainers(
  glob: Record<string, DeviceContainerLoader>,
  fileRe?: RegExp
): ReadonlyMap<string, DeviceContainerLoader> {
  const map = new Map<string, DeviceContainerLoader>();
  for (const [path, loader] of Object.entries(glob)) {
    const parts = path.split('/');
    if (fileRe && !fileRe.test(parts.at(-1) ?? '')) continue;
    const page = parts.at(-2);
    if (page) map.set(page, loader);
  }
  return map;
}
```

::: warning 容器摊平会静默丢页面
`view/web/StandardLogin.vue`（不进 `<页面>/` 子目录）的页面名会被算成 `web`——该设备在这一页等于「没写容器」。`import.meta.glob` 的 `*` 不跨 `/`，一层目录 + 一个文件正好。
:::

### `runtime.ts` —— 装配工厂

```ts
import type { DeviceContainerLoader, DeviceModule, HostDeviceInput } from './types';

/**
 * 清单（宿主事实）→ 可消费实例。判定不在这——判定纯函数 + useRenderDevice
 * 是宿主的另一个模块；分发器拿判定结果到本实例查容器。
 */
export function createDeviceModule(options: {
  devices: readonly HostDeviceInput[];
}): DeviceModule {
  const devices = options.devices;
  const fallbackId = devices.at(-1)?.id ?? '';   // 末条 = 兜底，不写死设备名
  const byId = new Map(devices.map(d => [d.id, d]));

  return {
    devices,
    fallbackId,
    ids: () => devices.map(d => d.id),
    resolveContainer(id: string, page: string): DeviceContainerLoader | null {
      const d = byId.get(id) ?? byId.get(fallbackId);
      return d?.containers().get(page) ?? null;
    }
  };
}
```

## 与主题侧的边界

| 关注点 | 设备侧（本层 + 清单 + 判定） | 主题侧（skinsuite） |
| --- | --- | --- |
| 设备词汇 | 定义（清单） | 经词汇投影消费（`createThemeState({ devices })`） |
| 判定 | 判定纯函数 + `useRenderDevice` | 不判定，经 `<ThemeView device>` 接收结果 |
| 容器 | 布线 + 装配 + 分发器选容器 | 不管容器，按收到的 device 渲染版式 |
| URL 参数 | `?device=` 语义与锁定 | `?th` / `?th_color` 族（库内机制） |

两侧唯一耦合点 = 主题侧的词汇投影：`DEVICES.map(({ id, label, urlKey }) => ({ id, label, urlKey }))`。

## 判定接线（本层的另一半）

判定是**纯函数 + 薄 composable**，与装配解耦：

```ts
// src/utils/device-resolve.ts —— 纯函数：事实入参，零 import（口径随产品）
export function resolveRenderDevice(
  query: Record<string, unknown>,
  path: string,
  mobile: boolean
): string | null {
  if (query.device) return query.device as string;  // ?device= 一次性锁定
  if (query.isMobile === 'true') return 'mobile';
  if (mobile) return 'mobile';
  return null;                                      // null = 落兜底设备
}
```

```ts
// src/composables/useRenderDevice.ts —— 薄封装：route + 视口信号喂给纯函数
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { resolveRenderDevice } from '@/utils/device-resolve';

export function useRenderDevice() {
  const route = useRoute();
  return computed(() => resolveRenderDevice(route.query, route.path, mobileViewport().value));
}
```

分发器把判定结果与模块实例接起来：

```ts
// view/web/login/index.vue（页面分发器）
import { computed, defineAsyncComponent } from 'vue';
import { device } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';

const renderDevice = useRenderDevice();
const deviceComponents = new Map(
  device.ids().map(id => {
    const loader = device.resolveContainer(id, 'login');
    return [id, loader ? defineAsyncComponent(loader) : null];
  })
);
const activeComponent = computed(
  () => deviceComponents.get(renderDevice.value)
    ?? deviceComponents.get(device.fallbackId)!
);
```

::: tip 视口是宿主的响应式信号
库不订阅 `matchMedia`——「什么算变了」也是宿主口径。把视口做成 `mobileViewport()` 之类的响应式信号，判定纯函数的入参就是它，依赖由 computed 自动收集。
:::
