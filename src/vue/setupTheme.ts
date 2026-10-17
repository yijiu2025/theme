/**
 * 主题域初始化（`skinsuite/vue` 绑定层）—— **主题这件事的唯一公开入口**
 *
 * 把一个启动步骤里「主题这件事」的机制收进库，宿主只注入本应用的事实。
 *
 * === 为什么收进库 ===
 * 「初始化主题域」= 实例化主题 store（让存量 watch 立即执行）+ 建立「设备身份 → store」
 * 的同步 + dev 环境对缺失清单喊一声。这三件事里，「设备同步」的机制藏着一堆踩坑才
 * 定型的结论（见下「设备同步的三个坑」），不该让每个宿主重演。
 *
 * === 为什么是注入式、而非直接 import 路由 / store / manifest ===
 * 「设备从哪来」「写回哪个 store」「清单里有哪些路由」都是**宿主的事实**：库既不
 * import vue-router（应用世界观）、也不 import 宿主的 Pinia store（`@/` 别名是宿主
 * 路径）、更不 import 虚拟模块（`virtual:theme` 是宿主构建插件的产物）。与
 * `useParentThemeSync` 同一手法：库负责「什么时候、怎么接」，宿主负责「来源 / 目标 /
 * 清单」三个参数。
 *
 * === 设备同步的三个坑（这段逻辑必须收在库里，不能让宿主重演）===
 *   ① 必须 `watch` 而非 `router.afterEach`：首次导航时 Pinia 尚未就绪、异常被吞 →
 *      设备静默停在默认值；
 *   ② 必须 `immediate`：覆盖启动时的首次导航；
 *   ③ 必须 watch「设备取值」而非「整个路由对象」：同路由 query / hash 变化不该触发
 *      写入，否则窄视口切 `?view=` 会把设备刷错且不再纠正。
 *
 * === 本函数做了什么 ===
 *   1. 建立「设备身份」同步：`watch(deviceSource, setDevice, { immediate: true })`
 *      —— 首屏分发器挂载前的空窗有确定基线；非三页分发器路由由设备来源给定。
 *   2. dev 环境清单缺失告警：`manifestRoutes` 为空时喊一声 —— 清单缺失 = 调试开关
 *      与路由投影全部退回默认值，机制照常不崩，但"面板不出现 / 某页识别不到"这类
 *      症状在运行时几乎看不出来，dev 里留一句可归因的告警。
 *
 * ⚠️ **不负责「应用主题」**：明暗类、`data-*`、CSS 变量注入都在宿主 store 自己的
 *   `watch(immediate)` 里。本函数只负责「把 store 实例化、把设备同步接上」，调用方
 *   必须保证在 `app.mount()` 之前执行 —— 首帧才是终态，不闪基线色。
 *
 * ⚠️ 幂等性：**不幂等**。重复调用会叠加 watcher —— 它本来就该在启动时只调一次。
 *
 * ⚠️ 调用前提：`setDevice` 内部若依赖 Pinia store，调用方必须先 `app.use(pinia)`。
 *   早先把设备同步写在 `router.afterEach` 里，首次导航时 Pinia 尚未就绪、异常被吞，
 *   导致设备静默停在默认值（见上「设备同步的三个坑」①）。
 *
 * @example
 * ```ts
 * import { setupTheme } from 'skinsuite/vue';
 *
 * setupTheme({
 *   deviceSource: () =>
 *     router.currentRoute.value.meta.device === 'mobile' ? 'mobile' : 'standard',
 *   setDevice: device => themeStore.setActiveDevice(device),
 *   manifestRoutes: themeManifest.routes
 * });
 * ```
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import { watch } from 'vue';

export interface SetupThemeOptions {
  /** 当前设备身份从哪来（宿主定义；返回稳定字符串，如 'mobile' / 'standard'） */
  deviceSource(): string;
  /** 设备变化时写回哪里（宿主定义；一般落到主题 store 的 setActiveDevice） */
  setDevice(device: string): void;
  /** 生效清单里的路由投影（宿主从 `virtual:theme` 解析出的 manifest.routes） */
  manifestRoutes: readonly unknown[];
}

/**
 * 初始化主题域
 *
 * 建立「设备身份 → store」同步，并在 dev 环境对缺失清单喊一声。
 *
 * 幂等性：**不幂等**。重复调用会叠加 watcher —— 它本来就该在启动时只调一次。
 *
 * ⚠️ 必须带 `immediate`：启动时读一次当前来源，覆盖首次导航（见文件头 ① ②）。
 * ⚠️ watch 的是「来源函数的返回值」：只有真实跨设备时触发，同来源内 query / hash
 *    变化不触发（见文件头 ③）。
 */
export function setupTheme(options: SetupThemeOptions): void {
  // 设备同步：watch 来源函数的**返回值**，只有跨设备才触发（① watch 而非 afterEach、
  // ② immediate 覆盖首导航、③ watch 取值而非整个路由对象 —— 见文件头）。
  watch(options.deviceSource, options.setDevice, { immediate: true });

  // 主题目录里没有清单 = 调试开关与路由投影全部退回默认值（机制照常，不崩）。
  // 这件事在使用侧几乎看不出来（只是"面板不出现""某页识别不到"），所以在 dev 里喊一声。
  if (import.meta.env.DEV && options.manifestRoutes.length === 0) {
    console.warn(
      '[theme] 主题清单里没有 routes：调试面板将无法按路径识别页面。' +
        '请检查主题根目录（VITE_THEME_DIR）下的 theme.config.ts。'
    );
  }
}
