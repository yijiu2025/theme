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
 * @author yijiu2025
 * @since 2026-09-26（2026-10-18 改下划线 + urlKey：`?view.` → `?th_`、`?theme.` → `?th_color_`）
 */
/** 支持设备维度的参数名（与配色侧 `readUrlIntent` 的键保持一致） */
export type DeviceScopedParam = 'th' | 'th_color';

export const DEVICE_SCOPED_PARAMS: readonly DeviceScopedParam[] = ['th', 'th_color'];

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
