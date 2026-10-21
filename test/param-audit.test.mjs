/**
 * `views/param-audit` 行为测试 —— 针对**构建产物** dist/ 跑（与 theme-core.test.mjs 同口径）
 *
 * 断言挑的是"改一个字就整站错一寸"的那几条口径：
 *   • 空串 = 未指定（`?th_std=` 不能顶掉 `?th=compact`）—— 与读取侧 present() 对齐
 *   • 数组（重复键）进 repeated 且带首值 —— 版式键读取侧按未指定、配色键取首值，
 *     两种净效果不同，④ 的文案必须分开说（说错一边审计就成了误诊）
 *   • 设备专属键 > 通用键；urlKey 缺省回落 id
 *   • 四类静默失败各自报出、多问题并发不掩盖、页未注册不误报
 *
 * @author yijiu2025
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectWarnings,
  effectiveViewRaw,
  parseThemeParams
} from '../dist/index.js';

/** 造一份标准判定上下文（假 registry：default/compact 两台设备有 compact，tablet 只有 default） */
function ctx(overrides = {}) {
  const views = {
    mini: ['default', 'compact'],
    tablet: ['default'],
    mobile: ['default', 'compact'],
    standard: ['default', 'compact']
  };
  return {
    activeDevice: 'standard',
    activePage: 'login',
    packageId: 'default',
    pageRegistered: true,
    devices: [
      { id: 'mini', urlKey: 'mini' },
      { id: 'tablet', urlKey: 'tab' },
      { id: 'mobile', urlKey: 'mobile' },
      { id: 'standard', urlKey: 'std' }
    ],
    hasView: (raw, _pkg, device) => (views[device] ?? []).includes(raw),
    listViews: (device) => views[device] ?? [],
    ...overrides
  };
}

/* ---------------------------------------------------------------------------
 * parseThemeParams：解析（口径与读取侧逐字对齐）
 * ------------------------------------------------------------------------- */

test('parseThemeParams：白名单四键 + 设备专属键各自归位', () => {
  const p = parseThemeParams({ th: 'compact', th_color: 'blue', device: 'mobile', debug: 'theme', th_std: 'default' });
  assert.equal(p.th, 'compact');
  assert.equal(p.th_color, 'blue');
  assert.equal(p.device, 'mobile');
  assert.equal(p.debug, 'theme');
  assert.deepEqual(p.scoped, { std: 'default' });
  assert.deepEqual(p.repeated, []);
});

test('parseThemeParams：th_color / th_color_<urlKey> 不混进版式专属键', () => {
  const p = parseThemeParams({ th_color: 'blue', th_color_std: 'blue' });
  assert.deepEqual(p.scoped, {});
  assert.equal(p.th_color, 'blue');
});

test('parseThemeParams：空串 = 未指定（契约明文），归一为 null', () => {
  const p = parseThemeParams({ th: '', th_std: '', device: '' });
  assert.equal(p.th, null);
  assert.deepEqual(p.scoped, { std: null });
  assert.equal(p.device, null);
});

test('parseThemeParams：重复键（router 数组）进 repeated 且带首值', () => {
  const p = parseThemeParams({ th: ['a', 'b'], th_color: ['x', 'y'] });
  assert.equal(p.th, null); // 版式键读取侧按未指定，解析侧必须同口径
  assert.deepEqual(p.repeated, [
    { key: 'th', first: 'a' },
    { key: 'th_color', first: 'x' }
  ]);
});

test('parseThemeParams：重复键首值为空串 → first=null（读取侧按未指定）', () => {
  const p = parseThemeParams({ th_color: ['', 'blue'] });
  assert.deepEqual(p.repeated, [{ key: 'th_color', first: null }]);
});

test('parseThemeParams：空 query / 缺参 → 全 null（不炸）', () => {
  assert.deepEqual(parseThemeParams({}), {
    th: null,
    th_color: null,
    device: null,
    debug: null,
    scoped: {},
    repeated: []
  });
  assert.equal(parseThemeParams().debug, null);
});

test('parseThemeParams：与主题无关的键（client_id 等）被忽略', () => {
  const p = parseThemeParams({ client_id: 'abc', redirect_uri: '/cb', th: 'compact' });
  assert.equal(p.th, 'compact');
  assert.deepEqual(Object.keys(p.scoped), []);
});

/* ---------------------------------------------------------------------------
 * effectiveViewRaw：取值链（专属 > 通用 > 无）
 * ------------------------------------------------------------------------- */

test('effectiveViewRaw：专属键优先于通用键', () => {
  const p = parseThemeParams({ th: 'compact', th_std: 'default' });
  assert.equal(effectiveViewRaw(p, 'std'), 'default');
  assert.equal(effectiveViewRaw(p, 'mini'), 'compact'); // mini 无专属键 → 落通用
});

test('effectiveViewRaw：都没有 → null', () => {
  assert.equal(effectiveViewRaw(parseThemeParams({}), 'std'), null);
});

test('effectiveViewRaw：空串专属键不顶掉通用键', () => {
  const p = parseThemeParams({ th: 'compact', th_std: '' });
  assert.equal(effectiveViewRaw(p, 'std'), 'compact');
});

test('effectiveViewRaw：未声明缩写的设备回落 id 查键（与库 urlKeyOf 同口径）', () => {
  const p = parseThemeParams({ th_weird: 'x' });
  assert.equal(effectiveViewRaw(p, 'weird'), 'x');
});

/* ---------------------------------------------------------------------------
 * collectWarnings：静默失败显影
 * ------------------------------------------------------------------------- */

test('collectWarnings：全合法 → 空', () => {
  const p = parseThemeParams({ th: 'compact', device: 'mobile', debug: 'theme' });
  assert.deepEqual(collectWarnings(p, ctx({ activeDevice: 'mobile' })), []);
});

test('collectWarnings：?device= 未知 id → 报（含已注册清单与兜底设备）', () => {
  const p = parseThemeParams({ device: 'phon' });
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /「phon」不是已注册设备/);
  assert.match(out[0], /mini \/ tablet \/ mobile \/ standard/);
  assert.match(out[0], /兜底设备「standard」/);
});

test('collectWarnings：当前设备生效的版式值不存在 → 报（带可用版式建议）', () => {
  const p = parseThemeParams({ th: 'compat' }); // 拼错：少一个 p
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /「compat」/);
  assert.match(out[0], /包「default」× 设备「standard」× 页「login」/);
  assert.match(out[0], /可用版式：default \/ compact/); // 实现按字典序给建议
  assert.match(out[0], /非法值不回退/);
});

test('collectWarnings：当前设备有合法专属键时，通用键的错值不报（生效的是专属键）', () => {
  const p = parseThemeParams({ th: 'compat', th_std: 'compact' });
  assert.deepEqual(collectWarnings(p, ctx()), []);
});

test('collectWarnings：其它设备的专属键错值 → 报（现在不渲染，切过去才静默落包）', () => {
  const p = parseThemeParams({ th_tab: 'compact' }); // tablet 只有 default
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /设备「tablet」/);
  assert.match(out[0], /可用版式：default/);
});

test('collectWarnings：非本仓设备缩写的 scoped 键跳过（不加设备名前无害）', () => {
  const p = parseThemeParams({ th_weird: 'whatever' });
  assert.deepEqual(collectWarnings(p, ctx()), []);
});

test('collectWarnings：页未注册 → 不判版式（没有 registry 就没有判据，不误报）；device 警告照出', () => {
  const p = parseThemeParams({ th: 'compat', device: 'phon' });
  const out = collectWarnings(p, ctx({ pageRegistered: false }));
  assert.equal(out.length, 1);
  assert.match(out[0], /「phon」不是已注册设备/);
});

test('collectWarnings：重复键 → 报（版式键读取侧按未指定处理）', () => {
  const p = parseThemeParams({ th: ['compact', 'default'] });
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /「th」重复定义/);
  assert.match(out[0], /按未指定处理/);
});

test('collectWarnings：th_color 重复 → 报「取首值」（配色侧 URLSearchParams.get 口径）', () => {
  const p = parseThemeParams({ th_color: ['blue', 'red'] });
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /「th_color」重复定义/);
  assert.match(out[0], /取首值「blue」/); // 说"按未指定"就是误诊：读取侧确实用了 blue
});

test('collectWarnings：th_color 重复且首值为空 → 按未指定（读取侧 get 得空串）', () => {
  const p = parseThemeParams({ th_color: ['', 'blue'] });
  const out = collectWarnings(p, ctx());
  assert.equal(out.length, 1);
  assert.match(out[0], /按未指定处理/);
});

test('collectWarnings：多类问题并发全部报出（不互相掩盖）', () => {
  const p = parseThemeParams({ th: 'compat', device: 'phon', th_tab: 'compact', th_color: ['blue', 'red'] });
  const out = collectWarnings(p, ctx());
  // device 未知 + 当前设备版式错值 + tablet 专属错值 + th_color 重复 = 4 条
  assert.equal(out.length, 4);
  assert.ok(out.some(w => w.includes('「phon」不是已注册设备')));
  assert.ok(out.some(w => w.includes('「compat」') && w.includes('设备「standard」')));
  assert.ok(out.some(w => w.includes('「compact」') && w.includes('设备「tablet」')));
  assert.ok(out.some(w => w.includes('「th_color」重复定义') && w.includes('取首值「blue」')));
});

test('collectWarnings：空串专属键不触发判定（未指定）', () => {
  const p = parseThemeParams({ th_std: '', th_tab: '' });
  assert.deepEqual(collectWarnings(p, ctx()), []);
});
