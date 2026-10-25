/**
 * 主题内核的常量与白名单 —— 目录契约与默认值的唯一来源
 *
 * 跨层共享（注册表 / 构建插件 / 参数读取 / store 都按这几个常量对齐），改这里其余跟着变。
 * 本文件零依赖、零 DOM、零构建器耦合。
 */

/**
 * 目录名 / id 白名单：主题包名、配色 id、版式 id、页面名共用一条
 * （它们都会进 data-* 属性与 CSS 选择器，只允许小写字母、数字、短横线）。
 * 不合规的目录静默跳过 —— 排查「加了主题没生效」先核这条正则。
 */
export const THEME_ID_RE = /^[a-z0-9-]+$/;

/** 空记录（注册表没扫到任何东西）的占位配色 id；默认配色是下面的 DEFAULT_THEME_COLOR */
export const DEFAULT_THEME_ID = 'default';

/** 内置默认包 id：该包的版式由 virtual:theme 静态引入（首屏零请求），见 vue/registry/view-registry.ts */
export const DEFAULT_THEME_PACKAGE = 'default';

/** 默认配色 id：范围内没有更具体的指定时先用它，再退「该范围字母序第一」 */
export const DEFAULT_THEME_COLOR = 'white';

/** 默认暗系配色 id：明暗联动切「暗」时的标配；范围内没有时退「该系别字母序第一」，不跨系别硬凑 */
export const DEFAULT_THEME_DARK_COLOR = 'black';

/** 配色目录的固定字面段（目录结构的一部分，不是取值段） */
export const THEME_COLORS_SEGMENT = 'colors';

/** 附加样式文件名（<配色>/theme.scss；定义文件形态见 THEME_DEF_FILE_CANDIDATES） */
export const THEME_COLOR_STYLE_FILE = 'theme.scss';

/**
 * 定义文件（包定义 / 配色定义）可接受的形态，按优先级排列：
 * 并存时 .ts 优先；.js 让纯 JS 宿主不必引入 TS 工具链。
 * 扫描侧（skinsuite/vite）与解析侧（registry 的键解析）共用这一份清单，
 * 两边必须同源，否则会出现「扫得到但解析不出」的静默脱节。
 */
export const THEME_DEF_FILE_CANDIDATES: readonly string[] = ['index.ts', 'index.js'];

/**
 * 部件目录的固定字面段：themes/<包>/<设备>/parts/<部件id>/。
 * 部件 = 可复用 UI 零件（弹窗 / 通知 / 悬浮窗），与页面平级：page 是导航表面，part 是组合零件。
 * 部件配色（可选）注册进现有注册表，page 段记 part:<部件id> 命名空间。
 * parts 必须住在包内（包自足性是机制根基）。
 */
export const THEME_PARTS_SEGMENT = 'parts';

/**
 * 主题包目录的取值目录段（顺序即深度）：
 * themes/<pkg>/<device>/<page>/colors/<colorId>/
 * 构建插件按它递归下降扫描，注册表按它拼解析正则 —— 改目录结构只动这一处。
 */
export const THEME_DIR_LEVELS = ['pkg', 'device', 'page', 'colorId'] as const;
