/**
 * 主题内核的**常量与白名单** —— 设备 / 页面 / 包 / 配色的取值集合
 *
 * 这些值原先散在 `oauth21/src/theme/index.ts`，2026-09-26 抽包 Stage 1 移到这里。
 * 它们是**跨层共享的词汇表**：配色注册表、版式注册表工厂、参数读取、store、
 * 以及目录口径关卡（`.tmp-probe/verify-theme-dirs.mjs`）全部按这几个常量对齐，
 * 所以必须**只有一个来源** —— 改这里，其余各处跟着变。
 *
 * ⚠️ 本文件**零依赖**（不 import 任何东西），也不碰 DOM / 构建器 / 路由：
 *    这是 `skinsuite` 能被任意前端复用的前提（见
 *    docs/standards/theme-package-extraction.md 的「〇、一条原则」）。
 *
 * @author yijiu2025
 */

/**
 * 目录名 / id 的白名单正则
 *
 * 同时作用于**主题包名**、**配色 id**、**版式 id**、**页面名** —— 它们都会进
 * `data-*` 属性与 CSS 属性选择器，因此只允许小写字母、数字、短横线。
 * 不合规的目录**静默跳过**（一个写坏的目录不该让整页起不来），所以排查
 * "加了主题没生效"时，第一件事就是核这条正则。
 */
export const THEME_ID_RE = /^[a-z0-9-]+$/;

/**
 * 空记录（registered 目录尚未产出任何记录）的占位配色 id
 *
 * ⚠️ 它**不再**表示"默认配色"：自 2026-09-24 起黑白是各设备下**具名的正式配色**
 * （`<页面>/colors/{black,white}/`）。**默认配色**是下面的 `DEFAULT_THEME_COLOR`。
 * 这里只用于空记录占位。
 */
export const DEFAULT_THEME_ID = 'default';

/**
 * 内置默认**主题包** id
 *
 * 它用在版式侧：该包的版式由容器**静态引入**（首屏零请求），其它包才需要惰性加载。
 * 见 `theme/views/registry.ts`。
 */
export const DEFAULT_THEME_PACKAGE = 'default';

/**
 * 设备维度：**取值集合由宿主的设备清单声明**，内核不再自带一份
 *
 * === 为什么从这里搬走（2026-09-27）===
 * 内核原先写着 `THEME_DEVICES = ['mobile','standard','mini']` —— 那是**某个应用的**
 * 词汇表，不是机制的一部分。它带来的实际代价是"加一种设备要改好几处"，而其中一处
 * 在包里、另外几处在宿主（判定、容器、路由、面板），漏一处就是静默的半生效。
 * 现在：
 *   • 内核只留「设备名是个 `[a-z0-9-]` 字符串」这一条**形态**约定；
 *   • 取值集合、中文名、判定规则、容器位置，全部在宿主的设备清单里声明
 *     （本仓 = `oauth21/src/theme/devices.ts`）。
 * 内核因此可以在任何前端被复用 —— 那个前端有几台设备、叫什么，与内核无关。
 *
 * ⚠️ 内核里所有"需要知道设备取值集合"的函数都已改成**接收它**（而不是查常量）：
 *    白名单校验在宿主（`asThemeDevice`），设备维度参数读取只需要"当前设备是谁"。
 */

/**
 * 兜底**配色** id：该范围内没有更具体的指定时用它（2026-09-26 定）
 *
 * 用户口径：**默认版式 = `default` 包，默认配色 = `white`**。
 * 配色注册表先找它；只有该范围里根本没有这套色（如以后某个版式只提供一套自命名的
 * 配色）才退回「该范围 id 字母序第一」。
 *
 * ⚠️ 在它之前，兜底口径是"字母序第一"，而 `black < blue < cyan < rainbow < white`
 *    → "默认外观"实际落在**黑系**，再靠首屏系别对齐纠正成白系。"两步走"有两个坑：
 *      ① 语义撕裂：基线 SCSS 的 `:root` 是浅底，兜底却是深色配色；
 *      ② **静默事故**：新增一个比 `black` 更靠前的配色 id（如 `amber`）会改掉默认外观。
 *    写死成 `white` 后，"默认"是一个**可读的显式值**，不再依赖命名巧合。
 */
export const DEFAULT_THEME_COLOR = 'white';

/**
 * 兜底**暗系**配色 id：明暗联动切到「暗」时的标配
 *
 * 与 `DEFAULT_THEME_COLOR` 成对（用户 2026-09-25 定：切「明」→白系、切「暗」→黑系）。
 * 该范围内没有它时退回**该系别**字母序第一套，绝不跨系别硬凑。
 */
export const DEFAULT_THEME_DARK_COLOR = 'black';

/**
 * 主题包目录的**结构契约** —— 「目录长什么样」的唯一来源
 *
 * === 为什么要有它（2026-10-17）===
 * 目录骨架原先是一份**隐式约定**，散在三个形态各异的实现里：
 *   • 构建插件的 `scan()`：嵌套 for 循环 + 写死的 `'colors'` 字符串
 *   • 注册表的 `colorFromKey()`：正则 `\./([^/]+)/([^/]+)/([^/]+)/colors/([^/]+)/…`
 *   • `types.ts` 的注释 ASCII 树
 * 三处各自维护对同一件事的认知。改目录结构（比如配色下再分 `tone` 层、或
 * `colors` 改名）时，只要漏改一处，就出现**静默扫不到主题**这种无从归因的脱节
 * （扫描是"读不到就跳过"，不报错）——与「设备词汇表散落四处」是同一类坑。
 *
 * 现在收敛成下面这一组常量：**段序列 + 固定字面段 + 叶子文件名**。构建插件扫描
 * 目录、注册表解析键，都从这里派生，不再各自手写。
 *
 * === 它**只**承诺「结构形态」，不承诺「取值集合」===
 * 段里 `pkg` / `device` / `page` / `colorId` 的**合法取值**（有哪些设备、有哪些包）
 * 是宿主的词汇表，内核不绑定（设备集合在宿主 `devices.ts`，包集合由文件系统决定）。
 * 这里只承诺"有这么几段、顺序如此、其中 `colors` 是固定字面段"。
 *
 * === 目录形态（唯一形态，2026-09-26 收窄后）===
 * ```
 * themes/<包>/<设备>/<页面>/colors/<配色>/{index.ts, theme.scss}
 * ```
 * 配色与版式**同级**，「版式」不是一层目录（变体版式请新建主题包）。
 * 曾支持的 6 段变体形态（`<页面>/<版式>/colors/`）已删除。
 */

/** 配色键里的**固定字面段**：`colors` 是目录结构的一部分，不是取值段 */
export const THEME_COLORS_SEGMENT = 'colors';

/** 附加样式文件名（`<配色>/theme.scss`；定义文件形态见 `THEME_DEF_FILE_CANDIDATES`） */
export const THEME_COLOR_STYLE_FILE = 'theme.scss';

/**
 * 定义文件（包定义 / 配色定义）可接受的**全部形态**，按优先级排列
 *
 * `.ts` 在前 = 两种并存时 `.ts` 优先（确定性）；`.js` 让**纯 JS 宿主**
 * （无 TS 工具链的前端）不必为写主题包引入 TypeScript——主题包定义本质是
 * 数据（meta / tone / tokens / views），`.js` 完全承载得了。
 * 扫描侧（`skinsuite/vite` 的 scan）按此清单取第一个存在的文件，键带**实际**
 * 文件名；解析侧（内核 `packageFromKey` / `parseColorKey`）同步认全部形态。
 * 🔴 两边必须同一来源：否则「扫得到但解析不出」（或反之）静默脱节。
 */
export const THEME_DEF_FILE_CANDIDATES: readonly string[] = ['index.ts', 'index.js'];

/**
 * 主题包目录的**取值目录段**（`themes/` 之下、从包到配色叶子的真实目录层）
 *
 * 与 `THEME_COLORS_SEGMENT`（固定字面段）、`THEME_DEF_FILE_CANDIDATES` /
 * `THEME_COLOR_STYLE_FILE`（叶子文件名）共同构成「目录长什么样」的完整契约。
 * 顺序即目录深度：`['pkg','device','page','colorId']` 对应
 * `themes/<pkg>/<device>/<page>/colors/<colorId>/`。
 *
 * 构建插件的 `scan()` 用它做**递归下降**（每段一层目录），注册表的 `colorFromKey()`
 * 用它拼正则（键 = `./` + 这些段，`page` 与 `colorId` 之间插入 `THEME_COLORS_SEGMENT`）。
 * 改目录结构（配色下再分层、`colors` 改名）只动这一处。
 */

/**
 * 部件目录的**固定字面段**（P1b 部件层，2026-10-23）：`themes/<包>/<设备>/parts/<部件id>/`
 *
 * 部件 = 可复用 UI 零件（弹窗 / 通知 / 悬浮窗），与页面平级但语义分开：
 *   · page  = 导航表面（一页一版式 `index.vue`，路由语义）
 *   · part  = 复用零件（`parts/<partId>/index.vue`，组合语义），同设备所有页面共用
 * 目录形态：
 * ```
 * themes/<包>/<设备>/parts/<partId>/{index.vue, colors/<配色>/{index.ts, theme.scss}}
 * ```
 * 部件配色（可选）注册进现有配色注册表，`page` 段记 `part:<partId>` 命名空间
 * （冒号对内核只是普通字符 —— page 本就是宿主词汇，不透明）。
 * 🔴 parts 必须住在**包内**（不与 default/compact 并列）：包自足性是机制根基，
 *    详见计划 docs/plans/2026-10-23-theme-routerless-overlay.md §2.3 坑 ④。
 */
export const THEME_PARTS_SEGMENT = 'parts';
export const THEME_DIR_LEVELS = ['pkg', 'device', 'page', 'colorId'] as const;
