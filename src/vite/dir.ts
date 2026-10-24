/**
 * 主题**根目录**约定的常量（构建期，随 `skinsuite/vite` 一起发布）
 *
 * === 目录为什么走 env ===
 * 目录是**部署事实**（可能整包换掉一套品牌主题、可能放在 monorepo 的另一处），
 * 写进源码就意味着换目录要改代码 + 重新 review。env 是"同一份产物服务多个部署"
 * 的既有通道，目录也走同一条：
 *
 *   ```
 *   VITE_THEME_DIR=src/theme          # 相对宿主工程根；主题**根目录**
 *   ```
 *
 * === `VITE_THEME_DIR` 指向的是「主题根目录」，不是「主题包目录」===
 * 根目录内是**三个固定子目录/文件**（约定俗成，换根目录位置时整包跟着走）：
 *
 *   ```
 *   <根目录>/                          ← VITE_THEME_DIR（如 src/theme）
 *   ├── theme.config.ts               清单：调试开关（契约 = defineThemeManifest）
 *   ├── themes/                       主题包目录（一个包 = 一种版式）
 *   │   ├── default/  ├── compact/
 *   └── views/                        声明目录（devices.ts 设备声明 + login.ts 等页面契约）
 *   ```
 *
 * 于是「主题域」是**一个自足目录**：换根目录位置时，主题包、清单、声明一起走。
 *
 * === 解析发生在哪 ===
 * `themeAssets()` 插件在 `configResolved` 里用 Vite 已加载的 env（`config.env`，含
 * `.env.<mode>` / `.env.local` / CLI `--env-dir` 分层）读 `VITE_THEME_DIR`，root 取
 * 权威 `config.root` —— 宿主零参数、零 loadEnv 仪式，也没有 `process.cwd()` 陷阱
 * （0.9.0 起，见 plugin.ts）。
 *
 * ⚠️ `themes` 与 `views` 是**固定子目录名**（不是可配置项）：构建插件扫包目录与
 *    声明目录都认这两个名字 —— 靠「名字固定」对齐，不靠配置。
 *
 * 而**主题域自己的策略**（调试开关、路由投影）不在这里 —— 那份配置跟着主题域走，
 * 住在根目录的 `theme.config.ts`（契约见 `skinsuite` 的 `defineThemeManifest`）。
 * 分工是「宿主说根目录在哪」/「主题域说自己怎么用」，不是同一类东西。
 *
 * @author yijiu2025
 * @since 2026-10-17
 * @since 2026-10-24（`resolveThemeDir` 移除：唯一宿主 oauth21 已零参接入，机制层
 *            不再保留手工 loadEnv 仪式 —— 目录解析只在插件的 configResolved 一处发生）
 */

/**
 * 缺省主题根目录（相对宿主工程根）
 *
 * 留这个默认值是为了 **CI 与独立克隆**：`.env` 通常被 gitignore，全新 checkout 里
 * 没有它，此时必须仍能构建 —— 否则"没配 env 就构建失败"会把部署门槛抬高。
 * 宿主可用 env `VITE_THEME_DIR` 覆盖。
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
