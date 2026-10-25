/**
 * `import.meta.env` 的兜底类型（自包含，不依赖 vite 是否安装）
 *
 * vue 层以源码形态发布，检查它的程序不一定载了 `vite/client`
 * （纯 tsc 场景、部分编辑器上下文）—— 没有这份声明，`import.meta.env.DEV`
 * 会报 TS2339（类型 "ImportMeta" 上不存在属性 "env"）。
 *
 * 声明与 `vite/client` **逐字同形**（含 any 索引签名）：两边同时在场的程序里，
 * 同名接口声明合并成超集，互不冲突；只有本声明在场时独立成立。
 * Vite 构建时 `import.meta.env.DEV` 仍由 Vite 静态替换（prod 消除逻辑不受影响）。
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  /** 主题意图来源同步读的两个约定 env（useThemeSources） */
  readonly VITE_THEME_ENDPOINT?: string;
  readonly VITE_ALLOWED_PARENT_ORIGINS?: string;
  readonly [key: string]: any;
}
