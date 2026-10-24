/**
 * Vue 绑定层测试的**构建脚本** —— 把 `test/vue/*.test.ts` 用 esbuild 打包成 node 可直跑的
 * 单文件 ESM（`.test-dist/<名>.test.js`），随后由 `node --test .test-dist/` 执行。
 *
 * === 为什么需要打包（而不是让 node 直接跑 TS）===
 *   · vue 层源码的相对 import 不带扩展名（`./theme-scope`），Node ESM 解析不了；
 *     tsc 产物也不重写说明符 —— 只有 bundler 能消化。esbuild 是 vite 的既有同族工具，
 *     devDep 显式声明（不靠 vite 的传递依赖，防 hoisting 漂移）。
 *   · 每个 test 文件独立打包 = 独立模块图：**模块级单例（registry / 设备域 / store）在
 *     测试文件之间天然隔离**——同一进程里测"换表/换 router"不再互相污染。
 *
 * === 约定 ===
 *   · 外部依赖（vue / happy-dom / skinsuite 内核 dist）不打包：测试运行时从 node_modules
 *     解析 —— 内核测试继续打 `dist/index.js`（产物行为），vue 层打**源码**（无产物层）；
 *   · 产物 `.test-dist/` 已 gitignore；`npm test` 先跑本脚本再 `node --test test/ .test-dist/`。
 *
 * @author yijiu2025
 * @since 2026-10-23（计划 docs/plans/2026-10-23-theme-routerless-overlay.md §测试基建）
 */
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(PKG_ROOT, 'test', 'vue');
const OUT_DIR = join(PKG_ROOT, '.test-dist');

mkdirSync(OUT_DIR, { recursive: true });

const entries = readdirSync(SRC_DIR)
  .filter(name => name.endsWith('.test.ts'))
  .map(name => join(SRC_DIR, name));

if (entries.length === 0) {
  console.log('[build-vue-tests] test/vue/ 下没有 *.test.ts，跳过');
  process.exit(0);
}

await build({
  entryPoints: entries,
  outdir: OUT_DIR,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  // 外部依赖运行时解析：vue / happy-dom / 内核产物（test 里 import 'skinsuite' 走 dist）
  external: ['vue', 'happy-dom', 'skinsuite', 'node:*'],
  // vue 层源码读 `import.meta.env.DEV` / `import.meta.env.VITE_*`（Vite 注入，node 下没有）：
  // 测试按 dev 语义跑（DEV: true，探针/警告生效）；VITE_* 缺省 undefined → 来源机制关闭
  define: { 'import.meta.env': '{"DEV":true}' },
  // .vue 无法在 node 侧加载：测试只覆盖 TS 逻辑（SFC 是薄壳，类型由 vue-tsc 兜）
  loader: { '.vue': 'empty' },
  logLevel: 'info'
});

console.log(`[build-vue-tests] ${entries.length} 个测试文件 → .test-dist/`);
