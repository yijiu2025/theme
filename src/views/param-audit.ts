/**
 * URL 主题参数的**静默失败审计**（纯函数，零 import）
 *
 * === 为什么需要它 ===
 * 主题链的失败几乎全是**静默**的：`?th=compat`（拼错）不报错，pick() 按契约落当前包；
 * `?device=phon` 不报错，分发器落兜底设备；`?th=a&th=b` 不报错，读取侧按未指定处理。
 * 踩坑的人当时唯一的线索是「怎么点都没变化」。本模块把这些静默失败变成**可判定的**
 * 问题清单（人类可读文案），由 Vue 绑定层的调试句柄（`vue/theme-debug.ts`）在 dev 下
 * 喊进 console；纯函数形态同时允许宿主 / CI 自行调用（如上线前批量体检 SSO 链接）。
 *
 * === 判定为什么敢下结论 ===
 * 版式合法性由调用方注入 `hasView`（宿主传库公开 API `pageOf(page).views.has`）——
 * 本模块**不复制 pick 逻辑**，只做「输入 → 判定 → 文案」。设备合法性用调用方传入的
 * 设备清单（来自 `registeredDevices()`）。
 * 🔴 配色合法性**不检**：生效配色 = URL 设备覆盖 + localStorage + 用户显式操作 +
 *    跨包兜底的合成结果，脱离 store 单看 URL 会误报（已知边界）。
 *
 * === 输入口径与读取侧逐字对齐 ===
 * 输入是**路由 query 对象**（`currentQuery()`，与 `readUrlViewIntent` / `readUrlIntent`
 * 同源）而不是 `location.search` 字符串 —— 审计必须判 store 真正读到的那份：
 *   · 空串 = 未指定（`?th_std=` 不顶掉 `?th=compact`，契约明文）；
 *   · 重复键（`?th=a&th=b`，router 给数组）= 单独报出，且**两种读取语义分开说**：
 *     版式键（`readUrlViewIntent` 的 `present()`）拒绝数组 ⇒ 按未指定；配色键
 *     （`readUrlIntent` 的 `URLSearchParams.get()`）只取首值 ⇒ 首值生效。文案说错
 *     一边，审计本身就成了误诊（这正是本模块要显影的那类"假线索"）。
 *
 * @author yijiu2025
 * @since 2026-10-21（第二批 #5：从 oauth21 宿主实现下沉内核）
 */

/** 地址栏里与主题相关的原始值（白名单六键；`?debug` 也在此，门控与库探针同源） */
export interface ThemeUrlParams {
  /** 通用版式键 `?th` 原始值（空串 / 数组 = 未指定，归一为 null） */
  th: string | null;
  /** 通用配色键 `?th_color` 原始值（只显影，不判定 —— 见文件头「配色不检」） */
  th_color: string | null;
  /** 设备锁定 `?device` 原始值 */
  device: string | null;
  /** 调试门控 `?debug` 原始值 */
  debug: string | null;
  /**
   * 设备专属版式键 `?th_<urlKey>` → 原始值，**键 = urlKey（不含 `th_` 前缀）**
   * （与 `effectiveViewRaw(params, urlKey)` 的查键口径一致；`th_color` /
   * `th_color_<urlKey>` 不在此表）
   */
  scoped: Record<string, string | null>;
  /**
   * 白名单键 / 设备专属键里**重复出现**的键（router 给数组 ⇒ 单独报出，见 `RepeatedParam`）
   *
   * 🔴 为什么必须显影：不列出来的话，任何「显示原始值」的地方都会显示一个假值
   *    （`URLSearchParams.get` 只取首值，而版式侧实现直接忽略整个数组）。
   */
  repeated: RepeatedParam[];
}

/** 设备清单条目（urlKey 缺省回落 id，与 `urlKeyOf` 同口径） */
export interface ParamAuditDevice {
  readonly id: string;
  readonly urlKey?: string;
}

/**
 * 重复定义的参数（键 + 路由数组首值）
 *
 * 🔴 为什么带首值：读取侧对重复键的两种语义不同（见 `ThemeUrlParams.repeated`），
 *    ④ 类警告要按首值分流文案 —— 版式键说「按未指定」，配色键说「取首值「blue」」。
 */
export interface RepeatedParam {
  readonly key: string;
  /** 路由数组首元素（空串 / 非字符串归一为 null） */
  readonly first: string | null;
}

/** 判定的外部输入（全部显式传入 —— collectWarnings 因此是纯函数，可单测） */
export interface WarningContext {
  activeDevice: string;
  activePage: string;
  packageId: string;
  /** 当前页是否已注册（未注册页没有 registry 就没有判据 —— 不判，不误报） */
  pageRegistered: boolean;
  /** 设备清单（id + urlKey；调用方传 `registeredDevices()`） */
  devices: readonly ParamAuditDevice[];
  /** 版式「有无」判定（注入库 `pageOf(page).views.has`；测试用假实现） */
  hasView(raw: string, pkg: string, device: string): boolean;
  /** 某设备可用的版式 id 清单（警告里给「可换成」建议；没有就给 []） */
  listViews(device: string): string[];
}

/* ---------------------------------------------------------------------------
 * 实现
 * ------------------------------------------------------------------------- */

/** 设备专属版式键：`th_<后缀>`，但排除配色键（`th_color` / `th_color_<urlKey>`） */
function isScopedViewKey(key: string): boolean {
  const suffix = key.startsWith('th_') ? key.slice(3) : '';
  if (suffix === '') return false;
  return suffix !== 'color' && !suffix.startsWith('color_');
}

/** 白名单键（重复判定用；设备专属键另行判定） */
function isWhitelistKey(key: string): boolean {
  return key === 'th' || key === 'th_color' || key === 'device' || key === 'debug';
}

/**
 * 解析路由 query → 主题白名单键的原始值
 *
 * 与读取侧逐字对齐的口径：空串 = 未指定（`?th_std=` 不顶掉 `?th=compact`）；
 * 数组（重复键）进 `repeated` 并带首值（版式键读取侧按未指定、配色键取首值，
 * 两种语义在 collectWarnings 的④里分开说）。
 *
 * @param query 路由 query（`currentQuery()`；单测可直接传对象，不依赖 window）
 */
export function parseThemeParams(query: Record<string, unknown> = {}): ThemeUrlParams {
  const scoped: Record<string, string | null> = {};
  const repeated: RepeatedParam[] = [];

  /** 字符串且非空 → 原值；空串 / 非字符串（含数组）→ null */
  const present = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value : null;

  for (const [key, value] of Object.entries(query)) {
    // 重复键只对白名单键显影（业务键如 client_id 重复不归主题管）
    if (Array.isArray(value) && (isWhitelistKey(key) || isScopedViewKey(key))) {
      repeated.push({ key, first: present(value[0]) });
    }
    if (isScopedViewKey(key)) scoped[key.slice(3)] = present(value);
  }

  return {
    th: present(query.th),
    th_color: present(query.th_color),
    device: present(query.device),
    // debug 留原值（含空串）：门控判等 `=== 'theme'`，与库探针读取口径一致
    debug: typeof query.debug === 'string' ? query.debug : null,
    scoped,
    repeated
  };
}

/**
 * 某设备**生效**的 URL 版式原始值：专属键 `th_<urlKey>` > 通用键 `th` > 无
 *
 * 与 `readUrlViewIntent` 的取值链同口径（专属优先、空串未指定）；这里只做
 * 「取哪个值」，合法性判定在 collectWarnings。
 *
 * @param urlKey 设备缩写名（未声明缩写的设备回落 id，与库 `urlKeyOf` 同口径）
 */
export function effectiveViewRaw(params: ThemeUrlParams, urlKey: string): string | null {
  return params.scoped[urlKey] ?? params.th ?? null;
}

/** 版式值警告文案（带「可换成」建议 —— 机检要说缺什么，不只是说错了） */
function viewWarning(raw: string, device: string, ctx: WarningContext): string {
  const options = ctx.listViews(device);
  const hint = options.length > 0 ? `；可用版式：${options.join(' / ')}` : '';
  return (
    `URL 版式值「${raw}」在 包「${ctx.packageId}」× 设备「${device}」× 页「${ctx.activePage}」下不存在` +
    ` —— pick() 落当前包「${ctx.packageId}」（契约：非法值不回退）${hint}`
  );
}

/**
 * 汇总当前 URL + store 状态下的一切主题静默失败 → 人类可读警告列表（空 = 没问题）
 *
 * 检四类（都是「不报错、只是不生效」的静默失败）：
 *   ① `?device=` 未知 id —— 分发器静默落兜底设备，锁定不生效；
 *   ② 当前设备生效的版式值（专属 > 通用）在 包×设备×页 下不存在 —— pick() 落当前包；
 *   ③ 其它设备的专属版式键同样不存在 —— 现在不渲染，切到那台设备才静默落包，提前报；
 *   ④ 白名单键重复定义 —— 读取侧两种语义（版式键按未指定 / 配色键取首值），
 *      不显影的话快照会显示一个假值。
 *
 * 明确**不检**的：配色合法性（作用域微妙，见文件头）、通用键对其余设备的解析
 * （部署方常有意只保一端；快照里看得到原始值）。
 */
export function collectWarnings(params: ThemeUrlParams, ctx: WarningContext): string[] {
  const out: string[] = [];

  // ① 设备锁定：未知 id 由分发器 Map 落末条（宿主 device-resolve 口径）
  const deviceRaw = params.device;
  if (deviceRaw !== null && !ctx.devices.some(d => d.id === deviceRaw)) {
    const fallback = ctx.devices[ctx.devices.length - 1]?.id ?? '（清单为空）';
    out.push(
      `?device=「${deviceRaw}」不是已注册设备（${ctx.devices.map(d => d.id).join(' / ') || '无'}）` +
        ` —— 分发器会静默落兜底设备「${fallback}」，锁定不生效`
    );
  }

  if (ctx.pageRegistered) {
    const activeUrlKey =
      ctx.devices.find(d => d.id === ctx.activeDevice)?.urlKey ?? ctx.activeDevice;

    // ② 当前设备生效值（判据与 pick 逐字同构：resolve(raw, 当前包, 当前设备)）
    const raw = effectiveViewRaw(params, activeUrlKey);
    if (raw !== null && !ctx.hasView(raw, ctx.packageId, ctx.activeDevice)) {
      out.push(viewWarning(raw, ctx.activeDevice, ctx));
    }

    // ③ 其余设备的专属键（非本仓设备缩写的键跳过 —— 将来加设备前无害）
    for (const [key, value] of Object.entries(params.scoped)) {
      if (value === null || key === activeUrlKey) continue;
      const device = ctx.devices.find(d => (d.urlKey ?? d.id) === key);
      if (!device) continue;
      if (!ctx.hasView(value, ctx.packageId, device.id)) {
        out.push(viewWarning(value, device.id, ctx));
      }
    }
  }

  // ④ 重复键（版式键按未指定、配色键取首值 —— 读取侧两种语义，文案分开说）
  for (const { key, first } of params.repeated) {
    if (key === 'th_color' && first !== null) {
      // 配色侧 readUrlIntent 走 URLSearchParams.get()：只取首值，说"未指定"就是误诊
      out.push(
        `参数「${key}」重复定义 —— 读取侧取首值「${first}」，其余值被忽略，请只留一个值`
      );
    } else {
      // 版式侧 readUrlViewIntent 的 present() 拒绝数组（首值为空串的配色键同此）
      out.push(`参数「${key}」重复定义 —— 读取侧按未指定处理（落包声明档），请只留一个值`);
    }
  }

  return out;
}
