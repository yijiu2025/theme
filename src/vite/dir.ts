/**
 * 主题根目录约定的常量（构建期，随 skinsuite/vite 发布）
 *
 * 目录走 env（VITE_THEME_DIR，相对宿主工程根）：目录是部署事实（可能整包换品牌主题、
 * 可能放在 monorepo 另一处），写进源码就意味着换目录要改代码。env 是「同一份产物
 * 服务多个部署」的既有通道。
 *
 * 根目录内是三个固定名字（换根目录位置时整包跟着走）：
 *   theme.config.ts  清单（调试开关，契约 = defineThemeManifest）
 *   themes/          主题包目录（一个包 = 一种版式）
 *   views/           页面契约目录（login.ts 等，插件副作用 import 拉齐）
 *
 * 解析发生在插件的 configResolved：用 Vite 已加载的 env 读 VITE_THEME_DIR，
 * root 取权威 config.root —— 宿主零参数、无 process.cwd() 陷阱。
 * themes 与 views 是固定子目录名（不是配置项），靠「名字固定」对齐。
 */

/**
 * 缺省主题根目录（相对宿主工程根）
 *
 * 留默认值是为了 CI 与独立克隆：.env 通常被 gitignore，全新 checkout 没有它时
 * 也必须能构建。宿主可用 env VITE_THEME_DIR 覆盖。
 */
export const DEFAULT_THEME_DIR = 'src/theme';

/** 主题根目录的 env 键名（插件自解析的唯一读取键） */
export const THEME_DIR_ENV_KEY = 'VITE_THEME_DIR';

/** 主题根目录内、主题包的子目录名（固定约定，宿主 `views/*.ts` 的字面量 glob 依赖它稳定） */
export const THEME_PACKAGES_SUBDIR = 'themes';

/** 主题根目录内的版式契约目录名（`views/*.ts`，页面契约，插件副作用 import 拉齐） */
export const THEME_VIEWS_SUBDIR = 'views';

/** 主题根目录内的清单文件名（插件按它找 `theme.config.ts`） */
export const DEFAULT_THEME_MANIFEST = 'theme.config.ts';
