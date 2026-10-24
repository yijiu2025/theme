/**
 * 测试运行器 —— 用**代码**展开测试文件列表，再交给 `node --test`
 *
 * === 为什么不直接在 package.json 写 glob（2026-10-24 CI 事故）===
 * `"test": "… && node --test \"test/*.test.mjs\" \".test-dist/*.test.js\""`
 * 里引号包住的 glob 要靠 **node 自己**展开——该能力 Node 21 才有。本仓
 * `engines: >=18`、CI 矩阵含 Node 20：20 按**字面路径**找文件，报
 * `Could not find '.../test/*.test.mjs'` 直接红（Node 22/24 展开正常）——
 * 典型「本机绿、CI 红」（本机 Node 24）。
 * shell 展开也不行：npm scripts 在 Windows 走 cmd、无 glob 展开。
 *
 * 于是文件列表在**这里**用 fs 展开（Node 18 起就有的能力），喂给
 * `node --test` 的是纯文件路径，任何版本行为一致。
 *
 * 口径：`test/` 顶层 `*.test.mjs`（内核/注册表/插件层）+ `.test-dist/`
 * 顶层 `*.test.js`（vue 层经 esbuild 编译的产物，见 build-vue-tests.mjs）。
 * `test/vue/*.test.ts` **不进**这里的清单——它由 build-vue-tests 编译后
 * 从 `.test-dist` 跑，Node 原生跑不了 SFC 测试。
 *
 * @author yijiu2025
 * @since 2026-10-24（CI Node 20 矩阵红：glob 语法 21+ 才支持）
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** 列目录里指定后缀的顶层测试文件（不递归） */
function testFiles(dir, suffix) {
  try {
    return readdirSync(dir)
      .filter(name => name.endsWith(suffix))
      .sort()
      .map(name => join(dir, name));
  } catch {
    // 目录不存在 = 该半边还没构建/没有此类测试，跳过而不是崩
    return [];
  }
}

const targets = [
  ...testFiles('test', '.test.mjs'),
  ...testFiles('.test-dist', '.test.js')
];

if (targets.length === 0) {
  console.error('[run-tests] 没找到任何测试文件（test/*.test.mjs / .test-dist/*.test.js）');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...targets], { stdio: 'inherit' });
process.exit(result.status ?? 1);
