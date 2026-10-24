/**
 * `skinsuite/vite` 插件层测试 —— 钩子级驱动（configResolved / resolveId / load）
 *
 * 为什么不起真 vite dev server：插件的全部行为 = 纯函数 + fs 扫描 + 字符串生成，
 * 用最小真实形状驱动钩子（正是宿主 vite 做的调用序列）就能覆盖全部分支，快且零依赖；
 * 宿主侧端到端由 oauth21 的 theme store 用例（27 例）+ e2e 关卡兜底。
 *
 * fixture 在 `os.tmpdir()` 运行期生成、不入库（防 fixture 漂移）；每个用例新建
 * （mkdtemp 唯一），互相不串。主题域建在 `<root>/src/theme`（= DEFAULT_THEME_DIR），
 * 与真实宿主同构，toSpecifier 产出 `/src/theme/...` 说明符可如实断言。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { themeAssets, DEFAULT_THEME_DIR } from '../dist/vite/index.js';

const VIRTUAL = '\0virtual:theme';

/** 建一个最小可扫主题域；put(rel, content) 相对主题根写文件（自动建目录） */
function makeProject() {
  const root = mkdtempSync(join(tmpdir(), 'skinsuite-vite-'));
  const base = join(root, DEFAULT_THEME_DIR);
  const put = (rel, content = '') => {
    const file = join(base, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  // 内置包 default：包定义 + mobile/login 版式 + white 配色（带 scss）
  put('themes/default/index.ts', 'export default {}');
  put('themes/default/mobile/login/index.vue', '<template><div/></template>');
  put('themes/default/mobile/login/colors/white/index.ts', 'export default { tone: "light" }');
  put('themes/default/mobile/login/colors/white/theme.scss', ':root{}');
  // 非内置包 compact：只给版式（覆盖惰性分支）
  put('themes/compact/index.ts', 'export default {}');
  put('themes/compact/mobile/login/index.vue', '<template/>');
  // 声明 + 清单
  put('views/devices.ts', 'export const devices = [];');
  put('theme.config.ts', 'export default {};');
  return { root, base, put };
}

/** 驱动钩子：configResolved（最小真实形状）→ 返回插件实例 */
function drive({ root, env = {}, command = 'build', options = {} }) {
  const plugin = themeAssets(options);
  plugin.configResolved({ root, env, command });
  return plugin;
}

test('resolveId：认领 virtual:theme，其余放行', () => {
  const plugin = themeAssets();
  assert.equal(plugin.resolveId('virtual:theme', undefined), VIRTUAL);
  assert.equal(plugin.resolveId('skinsuite', undefined), null);
});

test('零参 + env：产出含包/配色/声明/清单，返回 { code, map } 形态', () => {
  const { root } = makeProject();
  const out = drive({ root, env: { VITE_THEME_DIR: DEFAULT_THEME_DIR } }).load(VIRTUAL);
  assert.equal(out.map, null);
  assert.match(out.code, /import \{ default as __manifest \} from "\/src\/theme\/theme\.config\.ts";/);
  assert.match(out.code, /"\.\/default\/index\.ts": __packages\d+/);
  assert.match(out.code, /"\.\/default\/mobile\/login\/colors\/white\/index\.ts": __colors\d+/);
  assert.match(out.code, /import "\/src\/theme\/views\/devices\.ts";/);
});

test('env 缺席：回落默认目录 src/theme（同一 fixture 直接命中）', () => {
  const { root } = makeProject();
  const code = drive({ root, env: {} }).load(VIRTUAL).code;
  assert.match(code, /"\.\/default\/index\.ts": __packages\d+/);
});

test('目录不存在：EMPTY_MODULE —— 空表但装配副作用完整，应用照常起', () => {
  const root = mkdtempSync(join(tmpdir(), 'skinsuite-empty-'));
  const out = drive({ root, env: { VITE_THEME_DIR: 'no-such-dir' } }).load(VIRTUAL);
  assert.match(out.code, /export const packages = \{\};/);
  assert.match(out.code, /installThemeRegistry\(buildThemeRegistry\(\{ packages, colors, styles \}\)\);/);
  assert.doesNotMatch(out.code, /views\/devices/);
});

test('显式 dir 优先于 env：dir 命中、env 指向不存在也被无视', () => {
  const { root } = makeProject();
  const plugin = drive({
    root,
    env: { VITE_THEME_DIR: 'no-such-dir' },
    options: { dir: DEFAULT_THEME_DIR }
  });
  assert.match(plugin.load(VIRTUAL).code, /"\.\/default\/index\.ts": __packages\d+/);
});

test('加载表形态：内置包 eager 同步返回、外置包惰性 import、styles ?inline', () => {
  const { root } = makeProject();
  const code = drive({ root, env: {} }).load(VIRTUAL).code;
  // 内置包：静态 import 收进 __viewN，表内同步返回（ViewRegistry.builtin() 依赖）
  assert.match(code, /^ {4}"\.\/default\/mobile\/login\/index\.vue": \(\) => __view\d+,$/m);
  // 外置包：动态 import
  assert.match(code, /^ {4}"\.\/compact\/mobile\/login\/index\.vue": \(\) => import\("/m);
  // 样式惰性：?inline 动态 import 后取 default
  assert.match(code, /\?inline"\)\.then\(__m\d+ => __m\d+\.default\)/);
});

test('写歪目录：dev(serve) 去重警告、build 零噪音', () => {
  const { root, base, put } = makeProject();
  // 写歪两处：配色只有 scss 没有定义文件；页面目录没有版式组件
  put('themes/default/mobile/login/colors/broken/theme.scss', ':root{}');
  mkdirSync(join(base, 'themes/default/mobile/orphan'), { recursive: true });

  const capture = fn => {
    const msgs = [];
    const orig = console.warn;
    console.warn = msg => msgs.push(msg);
    try {
      fn();
    } finally {
      console.warn = orig;
    }
    return msgs.filter(m => String(m).includes('[theme] 扫描跳过'));
  };

  // dev：两次 load（模拟 watch 失效重建）→ 同一问题只喊一次
  const devPlugin = drive({ root, env: {}, command: 'serve' });
  const warns = capture(() => {
    devPlugin.load(VIRTUAL);
    devPlugin.load(VIRTUAL);
  });
  assert.equal(warns.length, 2, `应有且仅有 2 条（去重后），实际：${warns.join(' | ')}`);
  assert.ok(warns.some(m => m.includes('colors/broken')), '应含写歪配色');
  assert.ok(warns.some(m => m.includes('default/mobile/orphan')), '应含孤儿页面目录');

  // build：零噪音
  const buildPlugin = drive({ root, env: {}, command: 'build' });
  assert.equal(capture(() => buildPlugin.load(VIRTUAL)).length, 0);
});

test('index.js 形态：纯 JS 宿主的包/配色定义被扫到（键带实际文件名）', () => {
  const { root, put } = makeProject();
  put('themes/jspkg/index.js', 'export default { meta: {} };');
  put('themes/jspkg/mobile/login/index.vue', '<template/>');
  put('themes/jspkg/mobile/login/colors/white/index.js', 'export default { tone: "light" };');
  const code = drive({ root, env: {} }).load(VIRTUAL).code;
  assert.match(code, /"\.\/jspkg\/index\.js": __packages\d+/);
  assert.match(code, /"\.\/jspkg\/mobile\/login\/colors\/white\/index\.js": __colors\d+/);
});

test('.ts 与 .js 并存时 .ts 优先（清单序即优先级）', () => {
  const { root, put } = makeProject();
  put('themes/both/index.ts', 'export default {};');
  put('themes/both/index.js', 'export default {};');
  put('themes/both/mobile/login/index.vue', '<template/>');
  put('themes/both/mobile/login/colors/white/index.ts', 'export default { tone: "light" };');
  put('themes/both/mobile/login/colors/white/index.js', 'export default { tone: "light" };');
  const code = drive({ root, env: {} }).load(VIRTUAL).code;
  assert.match(code, /"\.\/both\/index\.ts": __packages\d+/);
  assert.doesNotMatch(code, /"\.\/both\/index\.js"/);
  assert.match(code, /"\.\/both\/mobile\/login\/colors\/white\/index\.ts": __colors\d+/);
  assert.doesNotMatch(code, /colors\/white\/index\.js/);
});
