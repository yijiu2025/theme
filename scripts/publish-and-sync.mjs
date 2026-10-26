/**
 * 发布 + 宿主依赖同步 —— 一条命令走完「npm publish → 等 registry 传播 → 补宿主
 * package.json/lock → dry-run 自证」
 *
 * === 为什么要有这个脚本 ===
 * 2026-10-20/21 两次发版（0.5.0 / 0.6.0）都走了同一条手工链，每步都是坑：
 *   ① `npm publish` 后 registry 有传播延迟，`npm view` 立刻查会 404，只能 sleep 盲等；
 *   ② 宿主 lock 的 skinsuite 三字段（version / resolved / integrity）+ 根 spec 要手工
 *      二进制补丁（CRLF 感知，LF anchor 首次匹配 0 次会静默不替换 —— 已踩过）；
 *   ③ 补完必须从**根仓**跑 `npm ci --dry-run --prefix oauth21` 自证（在 oauth21 目录里
 *      跑 `npm install` 会触发 npm workspace arborist bug：edgesOut null 崩溃）。
 * 三步全是「漏一步就看不出错、错了要等 CI 才发现」的形状，所以收成脚本 + 自证。
 *
 * === 用法 ===
 *   node scripts/publish-and-sync.mjs                  # 完整链（默认宿主 = ../../oauth21）
 *   node scripts/publish-and-sync.mjs --dry-run        # 不发布、不落盘：只预演宿主同步（4/5 步算补丁但跳过写盘，6 步自证跳过）
 *   node scripts/publish-and-sync.mjs --skip-publish   # 已发布过：只同步宿主
 *   node scripts/publish-and-sync.mjs --host <path>    # 覆盖宿主仓路径
 *   node scripts/publish-and-sync.mjs --publish-only   # CI 形态：只发布+自证，不同步宿主
 *   node scripts/publish-and-sync.mjs --publish-only --tag v0.7.1  # 手动重跑（优先于 GITHUB_REF）
 *   node scripts/publish-and-sync.mjs --allow-dirty    # 放行工作区有未提交改动（不推荐）
 *
 *   🔴 --publish-only 是 CI 形态：除跳过宿主同步外，还**跳过「工作区必须干净」**检查
 *      （CI 的 npm install 必然生成未跟踪的 package-lock.json，那是产物不是漏提交）。
 *      本地跑完整链时这条检查照旧生效 —— 它防的是「漏提交一块改动还看不出来」。
 *
 * === 退出码 ===
 *   0 = 全链成功（含 dry-run 自证通过）
 *   1 = 任一步失败（git 不干净 / publish 失败 / 传播超时 / 补丁锚点不唯一 / dry-run 红）
 *
 * === 文件结构 ===
 *   纯函数（patchPackageJsonSpec / patchLockfile）在文件头部、**导入即用不触发流程** ——
 *   单测（publish-and-sync.test.mjs）只导入它们；主流程收在 main() 里，仅直接运行时执行。
 *
 * @author yijiu2025
 * @since 2026-10-21
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_NAME = 'skinsuite';
/** registry 传播等待：publish 成功到 npm view 可查之间的延迟（实测 ~10-45s） */
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 180_000;

/* ---------------------------------------------------------------------------
 * 纯函数：宿主文件补丁（导出供单测；二进制读写保 CRLF）
 * ------------------------------------------------------------------------- */

/**
 * 补丁宿主 package.json 的依赖 spec：`"skinsuite": "^0.5.0"` → `"^0.7.0"`
 *
 * @returns {{ text: string, oldSpec: string }} 补丁后的文本与旧 spec
 */
export function patchPackageJsonSpec(text, newVersion) {
  const re = new RegExp(`("${PKG_NAME}": ")\\^[0-9][^"]*(")`);
  const m = re.exec(text);
  if (!m) {
    throw new Error(`package.json 里找不到 "${PKG_NAME}": "^x.y.z" 依赖声明 —— 手改过结构？`);
  }
  const oldSpec = m[0].slice(m[1].length, -m[2].length);
  return { text: text.replace(re, `$1^${newVersion}$2`), oldSpec };
}

/**
 * 补丁宿主 package-lock.json 的 skinsuite 条目（version / resolved / integrity + 根 spec）
 *
 * 🔴 CRLF 安全：整文件按 Buffer 读、正则用 `\s`（同时吃 \r\n 与 \n），不用字符串 replace
 *    （字符串 replace 在 CRLF 文件里配 LF 锚点会静默匹配 0 次 —— 2026-10-20 踩过）。
 * 🔴 两处补丁各自断言命中次数：不唯一就抛错，绝不静默跳过。
 *
 * @returns {{ buf: Buffer, oldVersion: string }} 补丁后的 Buffer 与旧版本
 */
export function patchLockfile(buf, oldSpec, newVersion, integrity, tarball) {
  let data = buf;
  const count = (needle) => data.toString('utf8').split(needle).length - 1;

  // ① 根 spec（packages[""].dependencies）—— 与 package.json 的声明一致
  const oldRootSpec = `"${PKG_NAME}": "${oldSpec}"`;
  const newRootSpec = `"${PKG_NAME}": "^${newVersion}"`;
  if (count(oldRootSpec) !== 1) {
    throw new Error(`lock 里根 spec ${oldRootSpec} 命中 ${count(oldRootSpec)} 次（期望 1）`);
  }
  data = replaceCounted(data, oldRootSpec, newRootSpec);

  // ② node_modules/skinsuite 块：version → resolved → integrity 顺序锚定（resolved URL
  //    含包名，别的包的块不可能误命中）。键形 `node_modules/<包>`（lockfile v3），
  //    根 spec 那边是同名字符串值不是对象，不会被这个正则误吃。
  //    匹配到 integrity 的**收尾引号**即止（不假设它是块内最后一个字段，也不假设
  //    行尾有没有逗号 —— 两种 lock 形态都要能补）。
  const blockRe = new RegExp(
    `("(?:node_modules/)?${PKG_NAME}":\\s*\\{\\s*"version": ")[^"]*(",\\s*"resolved": ")[^"]*(",\\s*"integrity": ")[^"]*(")`
  );
  const blockStr = data.toString('utf8');
  const blockMatch = blockRe.exec(blockStr);
  if (!blockMatch) {
    throw new Error(`lock 里找不到 node_modules/${PKG_NAME} 块（version/resolved/integrity）`);
  }
  // 🔴 用全局正则匹配**所有** skinsuite 块开头计数：此前 split(blockMatch[0]) 只匹配
  //    第一个版本的具体块文本，lock 里有两个不同版本的 skinsuite 块时（文本不同）
  //    split 计数仍为 1 —— 守卫形同虚设，只补第一个、其余漏补。
  const blockHeadRe = new RegExp(`"(?:node_modules/)?${PKG_NAME}":\\s*\\{`, 'g');
  const blockCount = blockStr.match(blockHeadRe)?.length ?? 0;
  if (blockCount !== 1) {
    throw new Error(`lock 里 node_modules/${PKG_NAME} 块不唯一（命中 ${blockCount} 个，期望 1）`);
  }
  const oldVersion = /"version": "([^"]*)"/.exec(blockMatch[0])[1];
  const newBlock = blockMatch[0]
    .replace(/"version": "[^"]*"/, `"version": "${newVersion}"`)
    .replace(/"resolved": "[^"]*"/, `"resolved": "${tarball}"`)
    .replace(/"integrity": "[^"]*"/, `"integrity": "${integrity}"`);
  data = replaceCounted(data, blockMatch[0], newBlock);
  return { buf: data, oldVersion };
}

/** Buffer 级替换（保字节与行尾；调用方负责唯一性断言） */
function replaceCounted(buf, from, to) {
  const s = buf.toString('utf8');
  const idx = s.indexOf(from);
  if (idx < 0) throw new Error(`锚点未命中：${from.slice(0, 60)}`);
  return Buffer.from(s.slice(0, idx) + to + s.slice(idx + from.length), 'utf8');
}

/* ---------------------------------------------------------------------------
 * 流程辅助
 * ------------------------------------------------------------------------- */

const NPM = 'npm';
const GIT = 'git';

/**
 * 跑一个子进程
 *
 * 🔴 Windows 上 npm 是 `npm.cmd`：Node 22 起（CVE-2024-27980 修复）直接 spawn .cmd
 *    会 EINVAL，必须 `shell: true`。git 是 git.exe，不需要 shell。
 *    本脚本的 npm/git 参数都不含空格：宿主路径只进 Node 侧，唯一进命令行的路径是第 6 步
 *    的 `--prefix <相对路径>`（`relative()` 归一后的宿主相对路径，不含空格），shell 安全。
 */
function run(cmd, args, opts = {}) {
  const useShell = process.platform === 'win32' && cmd === NPM;
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: useShell, ...opts });
  if (r.error) {
    return { code: 1, stdout: r.stdout || '', stderr: String(r.error) };
  }
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function step(msg) {
  console.log(`\n── ${msg}`);
}

/* ---------------------------------------------------------------------------
 * 主流程（仅直接运行时执行；导入本模块只拿纯函数）
 * ------------------------------------------------------------------------- */

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const flagVal = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };

  const DRY_RUN = flag('--dry-run');
  const SKIP_PUBLISH = DRY_RUN || flag('--skip-publish');
  const ALLOW_DIRTY = flag('--allow-dirty');
  const HOST_ARG = flagVal('--host');
  /** --publish-only 下显式指定 tag（手动重跑用；优先于 GITHUB_REF） */
  const TAG_ARG = flagVal('--tag');
  /**
   * CI 形态：只走 1~3 步（发布 + 等 registry 传播自证），跳过 4~6 步的宿主同步。
   * 为什么必须有这个开关：本仓是**独立仓**（yijiu2025/theme），CI checkout 里既没有
   * oauth21 也没有根仓 —— 没有它，脚本开头的宿主存在性检查就会直接 fail。
   * 而且跨仓提交（改宿主的 package.json + lock）本就不该由 CI 代劳。
   */
  const PUBLISH_ONLY = flag('--publish-only');

  const pkg = JSON.parse(readFileSync(join(CORE_ROOT, 'package.json'), 'utf8'));
  const VERSION = pkg.version;
  console.log(`skinsuite 发布同步：${PKG_NAME}@${VERSION}${DRY_RUN ? '（dry-run：不发布）' : ''}`);

  // 宿主仓：默认 <core>/../../oauth21（packages/theme-core 是 submodule，宿主在根仓）
  // 用 resolve 而非 join：--host 给绝对路径时 join 会把绝对路径当子段拼到 CORE_ROOT 下，
  // 产生错误路径、存在性检查误报「宿主仓不存在」；resolve 对绝对路径原样返回。
  const HOST = HOST_ARG ? resolve(CORE_ROOT, HOST_ARG) : join(CORE_ROOT, '..', '..', 'oauth21');
  const REPO_ROOT = join(HOST, '..'); // 根仓（npm ci --dry-run 必须从这里跑）
  if (PUBLISH_ONLY) {
    console.log('--publish-only：只发布 + 自证，不碰宿主（宿主同步需本地 --skip-publish 续跑）');
  } else {
    if (!existsSync(join(HOST, 'package.json'))) {
      fail(`宿主仓不存在：${HOST}（用 --host 指定）`);
    }
    const hostPkg = JSON.parse(readFileSync(join(HOST, 'package.json'), 'utf8'));
    if (!/oauth/i.test(hostPkg.name ?? '')) {
      fail(`宿主 package.json name 不是 oauth*（实际 ${hostPkg.name}）—— 认错仓了？`);
    }
    console.log(`宿主：${HOST}`);
  }

  /* ---- 1. git 预检 -------------------------------------------------------- */
  step('1/6 git 预检');
  {
    const { code, stdout } = run(GIT, ['-C', CORE_ROOT, 'status', '--porcelain']);
    if (code !== 0) fail(`git status 失败（${CORE_ROOT} 不是 git 仓？）`);
    /**
     * 🔴 CI 形态（--publish-only）**不做**「工作区必须干净」检查 —— 实测 v0.7.1
     * 首次触发就红在这一步：库仓按规范不提交 lock，而 CI 的 `npm install` 必然生成
     * 未跟踪的 package-lock.json —— 于是「脏」的是构建产物，不是漏提交的代码。
     *
     * 这条检查的意义只在本地成立：本地漏提交 ⇒ 发出去的包少一块改动，且事后看不出来。
     * CI 里源码就是 tag 指向的那份（checkout 即权威），压根不存在「漏提交」这个状态，
     * 拦它只会把构建产物误判成人的失误。
     */
    if (PUBLISH_ONLY) {
      if (stdout.trim()) {
        console.log(`  CI 形态：跳过「工作区必须干净」检查（脏的是 install 产物，非漏提交）\n${stdout}`);
      }
    } else if (stdout.trim() && !ALLOW_DIRTY) {
      fail(`库工作区有未提交改动，先 commit（确认要用 --allow-dirty 才放行）：\n${stdout}`);
    } else if (stdout.trim()) {
      console.log('  ⚠️ 工作区有未提交改动（--allow-dirty 放行）');
    }
    // tag 检查只在**真要发布**时做：--skip-publish 的正当用途就是「publish 成功但
    // 宿主同步失败，重跑同步」，那种情况下 tag 必然已存在（不该拦）。
    if (PUBLISH_ONLY) {
      // 🔴 CI 由 tag push 触发 ⇒ tag 必然已存在，所以判据要**反过来**：
      //    不查「tag 是否已存在」，而是要求「tag 名 == package.json 版本」。
      //    这条是「npm latest == 源码版本」的自动化守卫 —— 打错 tag（tag v0.7.1
      //    但包里是 0.7.0）会在这里红，而不是等消费者装到错版本才发现。
      //    用 GITHUB_REF 而非 `git tag`：shallow checkout 下本地 tag 可能不全。
      const ref = process.env.GITHUB_REF || '';
      const m = /^refs\/tags\/(.+)$/.exec(ref);
      const tagName = TAG_ARG || (m && m[1]);
      if (!tagName) {
        fail('--publish-only 需要 tag：由 tag push 触发（GITHUB_REF=refs/tags/vX.Y.Z），' +
          '或用 --tag v<版本> 显式指定（手动重跑）');
      }
      if (tagName !== `v${VERSION}`) {
        fail(`tag ${tagName} 与 package.json 版本 ${VERSION} 不一致（期望 v${VERSION}）`);
      }
      console.log(`  tag ${tagName} == package.json ${VERSION} ✅`);
    } else if (!SKIP_PUBLISH) {
      const { stdout: tags } = run(GIT, ['-C', CORE_ROOT, 'tag']);
      if (tags.split('\n').includes(`v${VERSION}`)) {
        fail(`本地已有 tag v${VERSION} —— 版本号没升？`);
      }
      const { code: rc, stdout: remoteTags } = run(GIT, ['-C', CORE_ROOT, 'ls-remote', '--tags', 'origin', `v${VERSION}`]);
      if (rc === 0 && remoteTags.trim()) {
        fail(`远端已有 tag v${VERSION} —— 这个版本发布过了？`);
      }
      if (rc !== 0) console.log('  ⚠️ 远端 tag 查询失败（网络？），跳过该项检查');
    } else {
      console.log('  跳过 tag 检查（--skip-publish / --dry-run）');
    }
    // CI 形态下工作区本来就脏（install 产物），这里再喊「干净」就是假信号
    if (!PUBLISH_ONLY) console.log('  干净 ✅');
  }

  /* ---- 2. npm publish ----------------------------------------------------- */
  step('2/6 npm publish');
  if (SKIP_PUBLISH) {
    console.log('  跳过（--dry-run / --skip-publish）');
  } else {
    // 🔴 provenance（SLSA 声明）只在 OIDC 环境（GitHub Actions）下可生成 —— 本地
    //    npm login 的 token 发布会因「provenance requires OIDC」失败。所以按 OIDC
    //    环境变量条件加 --provenance：CI 带声明，本地 token 发布不带（照旧可用）。
    const oidc = !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const publishArgs = oidc ? ['publish', '--provenance'] : ['publish'];
    const { code, stdout, stderr } = run(NPM, publishArgs, { cwd: CORE_ROOT });
    const tail = (stdout + stderr).split('\n').filter(Boolean).slice(-4).join('\n');
    if (code !== 0) fail(`npm publish 失败：\n${tail}`);
    console.log(`  已发布 ${PKG_NAME}@${VERSION}${oidc ? '（含 provenance 声明）' : '（本地 token 发布，无 provenance）'} ✅\n${tail.split('\n').map(l => '  ' + l).join('\n')}`);
  }

  /* ---- 3. 等 registry 传播，拿 integrity ----------------------------------- */
  step('3/6 等 registry 传播（拿 dist.integrity）');
  let dist = null;
  if (DRY_RUN) {
    // dry-run：registry 上必须已有这个版本（发布过的），直接取
    const { code, stdout, stderr } = run(NPM, ['view', `${PKG_NAME}@${VERSION}`, 'dist.integrity', 'dist.tarball', '--json']);
    if (code !== 0) fail(`dry-run 需要 registry 上已有 ${PKG_NAME}@${VERSION}（npm view 失败）：\n${stderr.trim()}`);
    dist = JSON.parse(stdout);
  } else {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const { code, stdout } = run(NPM, ['view', `${PKG_NAME}@${VERSION}`, 'dist.integrity', 'dist.tarball', '--json']);
      if (code === 0) {
        dist = JSON.parse(stdout);
        break;
      }
      if (Date.now() >= deadline) {
        fail(`等 registry 传播超时（${POLL_TIMEOUT_MS / 1000}s）—— publish 显示成功但 ` +
          `npm view ${PKG_NAME}@${VERSION} 仍不可查。稍后重跑本脚本加 --skip-publish 续上。`);
      }
      process.stdout.write(`  …传播中（已等 ${Math.round((Date.now() - (deadline - POLL_TIMEOUT_MS)) / 1000)}s）\r`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  const integrity = dist['dist.integrity'] ?? dist.integrity;
  const tarball = dist['dist.tarball'] ?? dist.tarball;
  if (!integrity || !tarball) fail(`npm view 返回缺字段：${JSON.stringify(dist)}`);
  console.log(`  integrity: ${integrity}`);

  /* ---- 3.5 publish-only：到此为止（4~6 步是跨仓提交，不自动化） ---------- */
  if (PUBLISH_ONLY) {
    console.log(`
════════════════════════════════════════
  已发布并自证：${PKG_NAME}@${VERSION}（registry 可查，integrity 已取）
  宿主同步属**跨仓提交**，不在 CI 里做 —— 本地续跑：
    node scripts/publish-and-sync.mjs --skip-publish
════════════════════════════════════════`);
    process.exit(0);
  }

  /* ---- 4. 补丁宿主 package.json ------------------------------------------- */
  step('4/6 补丁宿主 package.json');
  const hostPkgPath = join(HOST, 'package.json');
  const hostPkgText = readFileSync(hostPkgPath, 'utf8');
  const patched = patchPackageJsonSpec(hostPkgText, VERSION);
  if (patched.text === hostPkgText) {
    console.log(`  "skinsuite": "${patched.oldSpec}"（无变化）`);
  } else if (DRY_RUN) {
    console.log(`  [dry-run 不落盘] 将把 "skinsuite": "${patched.oldSpec}" → "^${VERSION}"`);
  } else {
    writeFileSync(hostPkgPath, patched.text, 'utf8');
    console.log(`  "skinsuite": "${patched.oldSpec}" → "^${VERSION}" ✅`);
  }

  /* ---- 5. 补丁宿主 package-lock.json -------------------------------------- */
  step('5/6 补丁宿主 package-lock.json（CRLF 安全）');
  const lockPath = join(HOST, 'package-lock.json');
  if (!existsSync(lockPath)) fail(`宿主 lock 不存在：${lockPath}`);
  const lockBuf = readFileSync(lockPath);
  const lockPatched = patchLockfile(lockBuf, patched.oldSpec, VERSION, integrity, tarball);
  if (lockPatched.buf.equals(lockBuf)) {
    console.log(`  node_modules/skinsuite: ${lockPatched.oldVersion}（无变化）`);
  } else if (DRY_RUN) {
    console.log(`  [dry-run 不落盘] 将把 node_modules/skinsuite: ${lockPatched.oldVersion} → ${VERSION}（version/resolved/integrity）`);
  } else {
    writeFileSync(lockPath, lockPatched.buf);
    console.log(`  node_modules/skinsuite: ${lockPatched.oldVersion} → ${VERSION}（version/resolved/integrity）✅`);
  }

  /* ---- 6. dry-run 自证（从根仓跑） ---------------------------------------- */
  step('6/6 npm ci --dry-run 自证（从根仓跑）');
  if (DRY_RUN) {
    console.log('  跳过（dry-run：未落盘，无需自证）');
  } else {
    const prefix = relative(REPO_ROOT, HOST).split(sep).join('/');
    const { code, stdout, stderr } = run(NPM, ['ci', '--dry-run', '--prefix', prefix], { cwd: REPO_ROOT });
    const tail = (stdout + stderr).split('\n').filter(Boolean).slice(-3).join('\n');
    if (code !== 0) fail(`npm ci --dry-run 未通过（lock 可能没补对）：\n${tail}`);
    console.log(`  ${tail} ✅`);
  }

  if (DRY_RUN) {
    console.log(`
════════════════════════════════════════
  dry-run 完成：${PKG_NAME}@${VERSION} 未发布、未落盘，仅预演了宿主同步（4/5 步补丁计算）
  真实同步请用 --skip-publish 续跑：
    node scripts/publish-and-sync.mjs --skip-publish
════════════════════════════════════════`);
  } else {
    console.log(`
════════════════════════════════════════
  全链完成：${PKG_NAME}@${VERSION} 已发布，宿主依赖已同步并自证
  宿主改动（未提交，交给你审）：
    ${hostPkgPath}
    ${lockPath}
  下一步：git add/commit/push 宿主仓；库仓记得 commit + tag v${VERSION} + push
════════════════════════════════════════`);
  }
  process.exit(0);
}

// 仅「node scripts/publish-and-sync.mjs」直接运行时走流程；被 import（单测）时不触发
const invokedAsMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  main();
}
