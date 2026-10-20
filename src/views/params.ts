/**
 * 版式 / 配色参数的**设备维度**解析 —— `?th` / `?th_color`（下划线 + 设备缩写名）
 *
 * === 参数命名（2026-10-18 定稿，统一用下划线、禁用点号）===
 *   版式：`?th`（三端通用）          `?th_<设备缩写>`（某设备专属）
 *   配色：`?th_color`（三端通用）     `?th_color_<设备缩写>`（某设备专属）
 *   设备专属键的后缀是**设备缩写名（urlKey）**，不是设备 id —— 由设备清单声明
 *   （`defineThemeDevice` 的 `urlKey`，缺省回落 `id`），内核不硬编码任何缩写。
 *
 * === 解决什么 ===
 * 同一条链接要能给三台设备各指定一套版式：
 * ```
 * /login?th=compact                             三端共用（哪端没有就自动下沉到当前包）
 * /login?th_mobile=default&th_std=compact       各端各指定（mini 走通用/包默认）
 * /login?th_mobile=default&th=default           设备专属优先，通用键兜底
 * ```
 *
 * === 取值链（每台设备各一条）===
 *   `th_<urlKey>`  →  `th`  →  （返回 undefined：由调用方走包声明 → 当前包）
 *
 * === 为什么收在内核（而不是各页文件里）===
 * 三个页面（login / register / forgot-password）各有**一份**注册表文件，但"哪个 query
 * key 属于哪台设备"这件事与页面无关 —— 抄三份必然漂移。各页的 `pick*ViewId` 只负责
 * "拿到原始值之后怎么解析（落在哪个包、是否合法）"，取哪个键这一步交给本模块。
 * 2026-09-26 抽包 Stage 1 起它住在 `skinsuite`：任何复用这套机制的前端
 * 都直接拿到这份实现，而不是再抄一遍。
 *
 * === 与配色侧同形（很重要）===
 * 配色侧（`oauth21/src/stores/theme.ts` 的 `readUrlIntent`）用同样的键形
 * （`th_color_<urlKey>` / `th_color`）与同样的"设备专属优先"链。**两侧必须同形**，
 * 否则配置者要记两套规则，`?th_color_mobile=blue&th_std=compact` 这种混搭就写不出来。
 * 但两侧读的入口不同：配色侧读 `window.location.search`（store 是全局的，不依赖路由），
 * 版式侧读**路由 query**（容器手上只有 `route.query`）—— 所以不是同一个函数，是同一套规则。
 *
 * === 本文件的两个读取形态（2026-10-20 store 化后）===
 *   · `readDeviceParam(query, name, urlKey)` —— **单设备**取一个键的值（原样，不校验）；
 *     版式 store 化前的容器/面板读取入口，仍是公开 API（宿主自建壳可用）。
 *   · `readUrlViewIntent(query, viewParam, devices)` —— **全设备一次性读入**：把 URL 上
 *     所有 `th*` 原始值解析成 `{ deviceView, viewIntent }`，供主题 store 初始化（与配色侧
 *     `readUrlIntent` 同形）。theme-scope 的 `deviceView` / `viewIntent` 由它播种。
 *     设备清单由调用方传入（`registeredDevices()`）—— 本文件保持**零 import**，
 *     与 `readDeviceParam` 的 urlKey 传入同构。 *
 * @author yijiu2025
 * @since 2026-09-26（2026-10-18 改下划线 + urlKey：`?view.` → `?th_`、`?theme.` → `?th_color_`；
 *                     2026-10-20 加 `readUrlViewIntent`：版式意图 store 化的读入半边）
 */

/** 支持设备维度的参数名（与配色侧 `readUrlIntent` 的键保持一致） */
export type DeviceScopedParam = 'th' | 'th_color';

export const DEVICE_SCOPED_PARAMS: readonly DeviceScopedParam[] = ['th', 'th_color'];

/** 版式意图的参数前缀（配合设备 urlKey 组成 `th_<urlKey>`；配色侧是 `th_color`） */
export const DEFAULT_VIEW_PARAM = 'th';

/** URL 上按设备解析出的版式意图：只记"这台设备被**显式**指定了哪套版式" */
export type DeviceViewIntent = Partial<Record<string, string>>;

/** 值"存在且非空" —— 空串 / 空数组视为**未指定**，不顶掉兜底键 */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) {
    return value.some(v => typeof v === 'string' && v.trim() !== '');
  }
  return true;
}

/**
 * 按**设备**读取版式 / 配色参数
 *
 * @param query     路由 query（`route.query`）
 * @param name      参数名（`'th'` / `'th_color'`）
 * @param deviceKey 设备**缩写名（urlKey）** —— 由调用方用 `urlKeyOf(deviceId)` 从设备清单查
 * @returns `query['<name>_<deviceKey>']` 优先；缺席或空值时退 `query[name]`；
 *          两者都没有则返回 undefined，表示"**这台设备**没有被显式指定"
 *
 * ⚠️ 只决定"取哪个键"，**不做合法性校验** —— 校验属于各页 `pick*ViewId` 与配色注册表
 *    （本函数也拿不到"当前包里有没有这套版式"）。返回值可能是数组（`?th=a&th=b`），
 *    由下游按"非字符串即非法"处理，与改前的行为一致。
 * ⚠️ 空串视为"未指定"：`?th_std=` 不该把 `?th=compact` 顶掉 ——
 *    部署方常把参数留空当作"这台设备不特殊指定"。
 * ⚠️ 缩写名是**宿主**的词汇表（本包不认识具体取值），所以这里只把它当字符串拼键；
 *    「这个缩写名认不认得」由宿主的设备清单归一（`urlKeyOf`）。
 */
export function readDeviceParam(
  query: Record<string, unknown> | undefined,
  name: DeviceScopedParam,
  deviceKey: string
): unknown {
  const scoped = query?.[`${name}_${deviceKey}`];
  if (isPresent(scoped)) return scoped;
  return query?.[name];
}

/**
 * 读取 URL 上的**版式**意图（全设备一次性读入）—— 与 `readUrlIntent`（配色）同形
 *
 * === 每台设备各一条取值链 ===
 *   `?th_<urlKey>`  →  `?th`  → （缺则这台设备无显式意图）
 * 即"**设备专属优先，缺了退到通用键**"，与 `readDeviceParam` 逐字同构。
 *
 * === 与配色侧 `readUrlIntent` 的两个刻意差别 ===
 *  ① **不做合法性校验**：版式 id 合不合法取决于"当前包里有没有这套版式"——渲染期
 *      知识，由 `pick()`（`registry.resolve`）兜底。与 `readDeviceParam` 口径一致
 *      （只决定"取哪个键"）。
 *  ② **通用键不下发**到每台设备：它原样进 `viewIntent`，由 scope 的 `deviceViewOf`
 *      的 `deviceView[device] ?? viewIntent` 兜底。配色侧之所以下发，是因为 `themeId`
 *      有独立的持久化 / 用户操作语义（`deviceTheme` 是"URL 覆盖层"）；版式没有持久化层。
 *
 * 🔴 **空串 = 未指定**：`?th_<urlKey>=` 不能把 `?th=compact` 顶掉（与 `readDeviceParam`
 *    的 `isPresent()`、配色侧 `present()` 同一口径）。
 * 🔴 **重复键（`?th=a&th=b`，vue-router 给数组）视为未指定**：与配色侧
 *    `URLSearchParams.get()` 只取首值的净效果一致——都落声明档，不猜用户想要哪个。
 *
 * @param query     路由 query（设备域 `currentQuery()`；单测可直接传对象，不依赖 window）
 * @param viewParam 版式参数前缀（缺省 `th`）
 * @param devices   设备清单（`{ id, urlKey? }`；调用方传 `registeredDevices()`。
 *                   `urlKey` 缺省回落 `id`，与 `urlKeyOf()` 同口径）
 */
export function readUrlViewIntent(
  query: Record<string, unknown> | undefined,
  viewParam: string = DEFAULT_VIEW_PARAM,
  devices: readonly { id: string; urlKey?: string }[] = []
): { deviceView: DeviceViewIntent; viewIntent: string | null } {
  const deviceView: DeviceViewIntent = {};
  /** 空串 / 纯空白视为**未指定** —— 与上面 `isPresent()` 同一口径（但不收数组，见上） */
  const present = (raw: unknown): string | null =>
    typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  try {
    const anyScope = present(query?.[viewParam]);
    for (const device of devices) {
      const scoped = present(query?.[`${viewParam}_${device.urlKey ?? device.id}`]);
      if (scoped !== null) deviceView[device.id] = scoped;
    }
    return { deviceView, viewIntent: anyScope };
  } catch {
    return { deviceView, viewIntent: null };
  }
}

/**
 * 取 query 里版式相关键的**原始值快照**（`th` + 各设备 `th_<urlKey>`）
 *
 * 供 theme-scope 的"仅当 URL 原始值变化才同步进 store"判等用：debug 改写只碰 store
 * （不写 URL），快照不变 ⇒ 不同步；跨页带不同 `th`（/login → /register）⇒ 同步。
 *
 * 🔴 键白名单 = `viewParam` 本身 + `viewParam_<urlKey>`（urlKey 来自设备清单）——
 *    **不能**用 `startsWith(viewParam + '_')`：那会把配色键 `th_color` /
 *    `th_color_<urlKey>` 也收进来（`color` 不是任何设备的 urlKey，白名单天然排除），
 *    导致"换了一条带不同配色的链接"误触发版式同步。
 *
 * @param query     路由 query
 * @param viewParam 版式参数前缀（缺省 `th`）
 * @param devices   设备清单（`{ id, urlKey? }`；调用方传 `registeredDevices()`）
 */
export function viewParamsSnapshot(
  query: Record<string, unknown> | undefined,
  viewParam: string = DEFAULT_VIEW_PARAM,
  devices: readonly { id: string; urlKey?: string }[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const scopedKeys = new Set(devices.map(d => `${viewParam}_${d.urlKey ?? d.id}`));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === viewParam || scopedKeys.has(key)) out[key] = value;
  }
  return out;
}

/** 两个 `th*` 快照是否等价（键集合 + 各键原始值都相同） */
export function sameViewSnapshot(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => a[k] === b[k]);
}
