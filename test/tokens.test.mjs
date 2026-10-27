/**
 * token 白名单校验的行为测试 —— 针对**构建产物** dist/ 跑
 *
 * === 为什么测 dist 而不是 src ===
 * 包对外承诺的是 `dist/index.js`（`exports` 指向它），而 `src/` 是它的输入。
 * 测 src 会漏掉一类真实事故：源码能过某个工具链、产物却不能被 Node / 浏览器解析
 * （典型就是相对 import 少了 `.js` 后缀 —— 那条约束写在 `src/index.ts` 文件头）。
 * 测 dist 顺带把"产物能被原生 ESM 加载"这个前提也一起验了。
 *
 * === 关于 url() 的那几条断言 ===
 * CSS 自定义属性是能直接改变渲染的输入：`setProperty('--mauth-bg', 'url(https://evil.test/x.png)')`
 * 会触发一次**向外域的请求**，可用于探测存活 / 追踪；写形式的 `${...}`、分号闭合规则
 * 还能注入任意样式。所以这里是**白名单**而不是黑名单过滤，非法值必须被拒。
 *
 * @author yijiu2025
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSafeTokenName,
  isSafeTokenValue,
  isSafeTokenEntry,
  sanitizeOverrides
} from '../dist/index.js';

const HEX = '#1e293b';
const RGB = 'rgb(30 41 59)';
const HSL = 'hsl(210 40% 96%)';
const LEN = '1.5rem';

test('isSafeTokenName：只放行 --mauth- 前缀的小写短横线命名', () => {
  for (const ok of ['--mauth-bg', '--mauth-body-bg', '--mauth-font-family', '--mauth-c-1']) {
    assert.equal(isSafeTokenName(ok), true, `应放行 ${ok}`);
  }
  for (const bad of [
    '--mauth-BG', // 大写
    '--mauth_body_bg', // 下划线
    '--background', // 非主题命名空间（会误伤全局 shadcn 变量）
    'mauth-bg', // 缺 --
    '--mauth-', // 空名
    '--mauth-' + 'a'.repeat(65), // 超长后缀（限长 64，超长 DoS 面）
    '',
    undefined,
    null,
    123
  ]) {
    assert.equal(isSafeTokenName(bad), false, `应拒绝 ${String(bad)}`);
  }
});

test('isSafeTokenValue：放行白名单取值形态', () => {
  for (const ok of [
    '#fff',
    '#ffffff',
    '#ffffffcc',
    RGB,
    'rgba(30,41,59,0.12)',
    HSL,
    'hsla(210 40% 96% / 0.5)',
    LEN,
    '12px',
    '100%',
    '50vh',
    '2em',
    '-4px',
    'var(--mauth-bg)',
    'transparent',
    'none',
    'currentcolor',
    '0'
  ]) {
    assert.equal(isSafeTokenValue(ok), true, `应放行 ${ok}`);
  }
});

test('isSafeTokenValue：拒绝颜色名、url() 与注入形态', () => {
  for (const bad of [
    'red', // CSS 颜色名：白名单不含，且放宽成"任意字母"会连带放行历史攻击向量
    'blue',
    'url(https://evil.test/t.png)', // 唯一的外发请求入口
    'url("https://evil.test/t.png")',
    `${HEX}; background: url(https://evil.test/t.png)`, // 分号闭合
    '12px; color: red',
    'var(--mauth-bg) 12px', // 不是单一取值
    'expression(alert(1))',
    '@import url(evil)',
    '${window.location}',
    '12px /* c */',
    '  ', // 全空白
    '',
    'x'.repeat(121), // 超长
    '\\75rl(https://evil.test/x.png)', // unicode 转义 url(（反斜杠被 FORBIDDEN_RE 拦）
    '#fff\\u0000;url(https://evil.test/x.png)', // null 字节注入
    '#fff\\n;background:url(https://evil.test/x.png)', // 换行闭合规则
    '#fff\\r;color:red', // 回车闭合
    undefined,
    null,
    42
  ]) {
    assert.equal(isSafeTokenValue(bad), false, `应拒绝 ${String(bad)}`);
  }
});

test('isSafeTokenEntry：字体族是唯一放宽的特例（允许空格/逗号/引号，写不出函数）', () => {
  assert.equal(isSafeTokenEntry('--mauth-font-family', "Inter, 'Helvetica Neue', sans-serif"), true);
  assert.equal(isSafeTokenEntry('--mauth-font-family', '"PingFang SC"'), true);
  // 同一个值换成普通 token 名就该被拒（放宽只给字体族）
  assert.equal(isSafeTokenEntry('--mauth-bg', "Inter, sans-serif"), false);
  // 含括号就写不出任何 CSS 函数包括 url()
  assert.equal(isSafeTokenEntry('--mauth-font-family', 'url(https://evil.test/f.woff2)'), false);
  assert.equal(isSafeTokenEntry('--mauth-font-family', `Inter, sans-serif; background: url(evil)`), false);
  // 引号闭合：FONT_VALUE_RE 允许引号，但分号/花括号被 FORBIDDEN_RE 兜住，写不出规则闭合
  assert.equal(isSafeTokenEntry('--mauth-font-family', '"PingFang SC"; }'), false);
  assert.equal(isSafeTokenEntry('--mauth-font-family', `"A"; background: url(evil)`), false);
});

test('sanitizeOverrides：逐条过滤而非整体拒绝，并把被拒项回给调用方', () => {
  const r = sanitizeOverrides({
    '--mauth-bg': `  ${HEX}  `, // 会被 trim
    '--mauth-radius': LEN,
    '--mauth-bg-hack': 'url(https://evil.test/t.png)', // 被拒
    '--background': '#fff', // 非主题命名空间，被拒
    '--mauth-empty': '   ', // 被拒
    '--mauth-count': 3 // 非字符串，被拒
  });

  assert.deepEqual(r.tokens, { '--mauth-bg': HEX, '--mauth-radius': LEN });
  assert.equal(r.rejected.length, 4);
  // 被拒条目保留 "名=值" 形态，便于上报告警；超长值会被截断到 40 字符
  assert.ok(r.rejected.some(x => x.startsWith('--mauth-bg-hack=url(')));
  assert.ok(r.rejected.includes('--mauth-count=3'));
});

test('sanitizeOverrides：非对象输入返回空结果而不是抛错', () => {
  for (const bad of [null, undefined, 'nope', 42]) {
    assert.deepEqual(sanitizeOverrides(bad), { tokens: {}, rejected: [] });
  }
});
