/**
 * 版式 / 配色参数的设备维度解析 —— ?th / ?th_color（下划线 + 设备缩写）
 *
 * 键形（缩写 urlKey 由宿主设备清单声明，缺省回落设备 id）：
 *   版式：?th（通用）        ?th_<urlKey>（某设备专属）
 *   配色：?th_color（通用）   ?th_color_<urlKey>（某设备专属）
 *
 * 每台设备一条取值链：专属键 → 通用键 → 未指定（由调用方走包声明 → 当前包）。
 * 同一条链接即可给多台设备各指定一套：/login?th_mobile=default&th_std=compact
 *
 * 与配色侧（theme-persistence 的 readUrlIntent）刻意同形但入口不同：配色侧读
 * location.search（store 全局、不依赖路由），版式侧读路由 query —— 不是同一个
 * 函数，是同一套规则。设备清单由调用方传入（本文件零 import）。
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
 * @param deviceKey 设备**缩写名（urlKey）** —— 由调用方从自己的设备清单查（宿主清单的 urlKey 字段）
 * @returns `query['<name>_<deviceKey>']` 优先；缺席或空值时退 `query[name]`；
 *          两者都没有则返回 undefined，表示"**这台设备**没有被显式指定"
 *
 * ⚠️ 只决定"取哪个键"，**不做合法性校验** —— 校验属于各页 `pick*ViewId` 与配色注册表
 *    （本函数也拿不到"当前包里有没有这套版式"）。返回值可能是数组（`?th=a&th=b`），
 *    由下游按"非字符串即非法"处理，与改前的行为一致。
 * ⚠️ 空串视为"未指定"：`?th_std=` 不该把 `?th=compact` 顶掉 ——
 *    部署方常把参数留空当作"这台设备不特殊指定"。
 * ⚠️ 缩写名是**宿主**的词汇表（本包不认识具体取值），所以这里只把它当字符串拼键；
 *    「这个缩写名认不认得」由宿主的设备清单归一。
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
 * 读取 URL 上的版式意图（全设备一次性读入）—— 与配色侧 readUrlIntent 同形
 *
 * 每台设备一条链：?th_<urlKey> → ?th → 无显式意图。
 * 与配色侧的两个刻意差别：
 *  ① 不做合法性校验：版式 id 合不合法取决于「当前包里有没有」，由 pick() 渲染期兜底；
 *  ② 通用键不下发到每台设备：它原样进 viewIntent，由 scope 的 deviceViewOf 兜底。
 *
 * 🔴 空串 = 未指定（?th_<urlKey>= 不能把 ?th=compact 顶掉）。
 * 🔴 重复键（router 给数组）= 未指定 —— 与配色侧只取首值的净效果一致：都落声明档，不猜。
 *
 * @param query     路由 query（单测可直接传对象，不依赖 window）
 * @param viewParam 版式参数前缀（缺省 th）
 * @param devices   设备清单（{ id, urlKey? }；urlKey 缺省回落 id）
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
  // query 是普通对象、present 只做 typeof 判断，正常不会抛 —— 不需要 try/catch。
  // 此前 try/catch 吞全部异常并返回半成品（deviceView 部分填充 + viewIntent 置 null），
  // 真实错误被静默掩盖、结果不自洽。
  const anyScope = present(query?.[viewParam]);
  for (const device of devices) {
    const scoped = present(query?.[`${viewParam}_${device.urlKey ?? device.id}`]);
    if (scoped !== null) deviceView[device.id] = scoped;
  }
  return { deviceView, viewIntent: anyScope };
}

/**
 * 取 query 里版式相关键的原始值快照（th + 各设备 th_<urlKey>）
 *
 * 供「仅当 URL 原始值变化才同步进 store」的判等用：debug 改写只碰 store 不写 URL，
 * 快照不变 ⇒ 不同步；跨页带不同 th（/login → /register）⇒ 同步。
 *
 * 🔴 键白名单 = viewParam 本身 + viewParam_<urlKey>——不能用前缀匹配，那会把配色键
 *    th_color 也收进来，「换了带不同配色的链接」会误触发版式同步。
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

/** 快照值等价：标量用 ===，数组（重复键 `?th=a&th=b`）做元素级比较 —— 引用比较会恒 false */
function valueEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

/** 两个 `th*` 快照是否等价（键集合 + 各键原始值都相同） */
export function sameViewSnapshot(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => valueEq(a[k], b[k]));
}
