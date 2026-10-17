/**
 * 主题**根目录**的解析入口（构建期，随 `skinsuite/vite` 一起发布）
 *
 * 属于主题库自带的构建能力：任何宿主（Vue / React / 任意 Vite 工程）引入
 * `skinsuite` 后，只要在 `vite.config.ts` 挂上 `themeAssets()` 插件、并把目录解析
 * 交给本文件的 `resolveThemeDir()`，就**不再需要自己写一行扫描/目录代码**。
 *
 * === 为什么走 env 而不是一份 TS 配置文件 ===
 * 目录是**部署事实**（可能整包换掉一套品牌主题、可能放在 monorepo 的另一处），
 * 写进源码就意味着换目录要改代码 + 重新 review。env 是"同一份产物服务多个部署"
 * 的既有通道，目录也走同一条：
 *
 *   ```
 *   VITE_THEME_DIR=src/theme          # 相对宿主工程根；主题**根目录**
 *   ```
 *
 * === `VITE_THEME_DIR` 指向的是「主题根目录」，不是「主题包目录」===
 * 根目录内是**三个固定子目录/文件**（约定俗成、名字固定，换根目录位置时整包跟着走）：
 *
 *   ```
 *   <根目录>/                          ← VITE_THEME_DIR（如 src/theme）
 *   ├── theme.config.ts               清单：调试开关 + 路由投影（契约 = defineThemeManifest）
 *   ├── themes/                       主题包目录（一个包 = 一种版式）
 *   │   ├── default/  ├── compact/
 *   └── views/                        版式契约目录（login.ts / registry.ts / picker.ts …）
 *   ```
 *
 * 于是「主题域」是**一个自足的目录**：换根目录位置时，主题包、清单、版式契约一起走，
 * 宿主要改的只有 `VITE_THEME_DIR` 这一个变量。
 *
 * ⚠️ `themes` 与 `views` 是**固定子目录名**（不是可配置项）：宿主的
 *    `views/*.ts` 里 `import.meta.glob('/src/theme/themes/...')` 的字面量依赖
 *    `themes` 这个名字稳定，所以插件扫描包目录时也认 `themes` 这个名字 ——
 *    两者靠「名字固定」对齐，不靠配置。
 *
 * 而**主题域自己的策略**（调试开关、路由投影）不在这里 —— 那份配置跟着主题域走，
 * 住在根目录的 `theme.config.ts`（契约见 `skinsuite` 的 `defineThemeManifest`）。
 * 分工是「宿主说根目录在哪」/「主题域说自己怎么用」，不是同一类东西。
 *
 * ⚠️ 必须用 `loadEnv()` 读，不能直接 `process.env.VITE_THEME_DIR`：
 *    vite.config 执行时 Vite 还没加载 `.env` 文件（那只在 config 解析后发生），
 *    直接读 `process.env` 在 `npm run dev` 下恒 undefined —— 于是永远回落默认值，
 *    看着能用、改 env 却不生效，属于最难发现的一类。
 *
 * @author yijiu2025
 * @since 2026-10-17
 */
import path from 'node:path';
import { loadEnv } from 'vite';

/**
 * 缺省主题根目录（相对宿主工程根）
 *
 * 留这个默认值是为了 **CI 与独立克隆**：`.env` 通常被 gitignore，全新 checkout 里
 * 没有它，此时必须仍能构建 —— 否则"没配 env 就构建失败"会把部署门槛抬高。
 * 宿主可通过 `resolveThemeDir(mode, root, { defaultDir })` 覆盖。
 */
export const DEFAULT_THEME_DIR = 'src/theme';

/** 主题根目录内、主题包的子目录名（固定约定，宿主 `views/*.ts` 的字面量 glob 依赖它稳定） */
export const THEME_PACKAGES_SUBDIR = 'themes';

/** 主题根目录内的清单文件名（插件按它找 `theme.config.ts`） */
export const DEFAULT_THEME_MANIFEST = 'theme.config.ts';

/**
 * 解析主题**根目录**为**绝对路径**
 *
 * @param mode  Vite 的 mode（development / production / test …），决定叠加哪个 `.env.<mode>`
 * @param root  以哪个目录为工程根找 `.env`，缺省 `process.cwd()`
 * @param opts  可选覆盖：`defaultDir` 缺省回落目录、`envKey` 环境变量名
 */
export function resolveThemeDir(
  mode: string,
  root: string = process.cwd(),
  opts: { defaultDir?: string; envKey?: string } = {}
): string {
  const envKey = opts.envKey ?? 'VITE_THEME_DIR';
  const defaultDir = opts.defaultDir ?? DEFAULT_THEME_DIR;
  // 第三个参数是前缀白名单：只读 VITE_ 开头的，避免把后端密钥之类带进来
  const env = loadEnv(mode, root, 'VITE_');
  const configured = (env[envKey] ?? '').trim();
  return path.resolve(root, configured || defaultDir);
}
