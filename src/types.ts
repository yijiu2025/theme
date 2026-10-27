/**
 * 主题包契约类型 —— 目录形态与公开数据形状
 *
 * 目录形态（唯一形态）：
 *   themes/<包>/<设备>/<页面>/{index.vue, colors/<配色>/{index.ts, theme.scss}}
 * 一个主题包 = 一种版式：换版式就新建包，页面下没有「版式」这层目录。
 * 设备段是宿主词汇（[a-z0-9-] 形态即可），内核不绑定具体设备集合。
 * 配色 id 的唯一性作用域 = 同包 × 同设备 × 同页面；跨设备 / 跨包 / 跨页面可以同名
 * （取一份配色时这三段必然同时给出，歧义在入口就被消解）。
 *
 * 值怎么给：颜色 / 圆角 / 间距 → tokens（过白名单校验）；必须写 url()、伪元素、
 * keyframes 的 → theme.scss（构建期受信代码，不走运行期校验）。
 */
import type { ThemeTone } from './scheme.js';
import type { ThemeTokenOverrides } from './tokens.js';

/** 设备维度取值：宿主的词汇表，内核只认「[a-z0-9-] 字符串」这条形态约定 */
type ThemeDevice = string;

/** 配色的元信息（列表展示与日志用，不参与渲染） */
export interface MauthThemeMeta {
  /**
   * 配色 id = 目录名，只允许 [a-z0-9-]（会进 data-mauth-theme 属性选择器）。
   * 唯一性作用域 = 同包 × 同设备 × 同页面。
   */
  id: string;
  /** 显示名 */
  name: string;
  /** 一句话描述，便于部署方挑选 */
  description?: string;
  /** 主色/强调色（面板色卡预览用；渲染以 tokens 为准） */
  preview?: { primary: string; accent: string };
  author?: string;
}

/** 主题包定义（themes/<包>/index.ts 的默认导出） */
export interface MauthThemePackage {
  meta: MauthThemeMeta;
  /**
   * 包级版式声明（可选）：页面名 → 版式 id。版式 id ≡ 主题包名，合法取值只有
   * 本包自己的名字或另一个包的名字（跨包切版式）。配色里的 views 只覆盖那一套配色。
   * 写错 / 未登记一律回退当前包，不会白屏；URL 版式参数（?th）优先级更高。
   */
  views?: Record<string, string>;
  /**
   * 覆盖范围声明（可选）：包可以只覆盖部分设备 / 页面，其余回退 default 包。
   * devices / pages 缺省 = 全部；requiredColors 缺省 = ['black','white']。
   * 只影响宿主的目录口径关卡校验，不改变运行时行为；声明的范围只能 ≤ 实际目录。
   */
  coverage?: {
    devices?: string[];
    pages?: string[];
    requiredColors?: string[];
  };
}

/**
 * 一套配色的定义（colors/<配色>/index.ts 的默认导出）
 *
 * tokens 是一组扁平值、不分明暗档：每套配色自带完整底色，选谁就是谁。
 * 需要深色品牌色就另加一个 tone: 'dark' 的颜色目录，不要写 { light, dark } 两档。
 * 若把 --mauth-header-bg 设为 transparent，必须同时声明 --mauth-canvas
 * （页面之外的画布色），否则该色由浏览器内核决定，真机与电脑不一致。
 */
export interface MauthThemeColor {
  meta: MauthThemeMeta;
  /**
   * 明暗系别：'light' 白系 / 'dark' 黑系，决定夜间模式如何联动。
   * 必填 —— 系别判错只会「不联动、不报错」，现象极隐蔽，宁可构建期变红。
   */
  tone: ThemeTone;
  tokens?: ThemeTokenOverrides;
  /** 该配色专属的版式声明（覆盖包级声明）；一般不必写，见 MauthThemePackage.views */
  views?: Record<string, string>;
}

/** 注册表里一条已解析好的配色记录 */
export interface MauthThemeRecord {
  /** 所属主题包 id（= themes/<包>/ 目录名）；版式只在当前包内查找 */
  pkg: string;
  /** 所属设备（= themes/<包>/<设备>/ 目录名） */
  device: ThemeDevice;
  /**
   * 所属页面（= themes/<包>/<设备>/<页面>/ 目录名）。配色与版式同级，
   * 同一个颜色 id 在不同页面各有一份是正常且必要的。
   */
  page: string;
  meta: MauthThemeMeta;
  /** 明暗系别（参与联动逻辑，所以不塞进只用于展示的 meta） */
  tone: ThemeTone;
  /** token（未做安全校验 —— 校验在注入时统一做） */
  tokens: ThemeTokenOverrides | undefined;
  /** 版式声明（页面名 → 版式 id）；未声明为 undefined */
  views: Record<string, string> | undefined;
  /** 附加样式的惰性加载器；无 theme.scss 时为 undefined */
  loadStyle: (() => Promise<string>) | undefined;
}

/** 设备词汇（注入式清单的一台设备）：id / label / urlKey，数组序 = 优先级、末条 = 兜底 */
export interface DeviceVocab {
  /** 设备 id = 主题包内的目录名，只允许 [a-z0-9-] */
  id: string;
  /** 显示名（调试面板 / 日志用） */
  label: string;
  /**
   * URL 参数后缀（`?th_<urlKey>` / `?th_color_<urlKey>`）；缺省回落 id。
   * 🔴 保留字：不能是 `color`、不能以 `color_` 开头 —— 它们分别是配色通用键
   *    （`?th_color`）与配色设备键（`?th_color_<urlKey>`）的固定形态，占用后版式键
   *    （`?th_<urlKey>`）会与配色键互相顶掉，无从归因。
   */
  urlKey?: string;
}
