/**
 * 核心取值 / 明暗 / 系别 / 设备维度参数的行为测试 —— 针对**构建产物** dist/ 跑
 *
 * 断言挑的是"改一个字就整站错一寸"的那几条口径：
 *   • 默认配色必须是**显式**的 white / black（而不是靠字母序巧合）
 *   • mode 三态含 system；tone 只有 light / dark，**没有** system
 *   • 设备专属键 > 通用键，且**空串等于没指定**（不能把通用键顶掉）
 *
 * @author yijiu2025
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THEME_ID_RE,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PACKAGE,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_DARK_COLOR,
  THEME_TONES,
  TONE_LABELS,
  isThemeTone,
  normalizeTone,
  MODE_CYCLE,
  MODE_LABELS,
  isThemeMode,
  normalizeMode,
  DEVICE_SCOPED_PARAMS,
  DEFAULT_VIEW_PARAM,
  readDeviceParam,
  readUrlViewIntent,
  sameViewSnapshot,
  viewParamsSnapshot
} from '../dist/index.js';

test('THEME_ID_RE：目录名白名单（小写字母 / 数字 / 短横线）', () => {
  for (const ok of ['default', 'compact', 'black', 'cyan-2', 'forgot-password']) {
    assert.equal(THEME_ID_RE.test(ok), true, `应放行 ${ok}`);
  }
  // 这些值会进 data-* 属性与 CSS 属性选择器
  for (const bad of ['Default', 'default_theme', 'the mes', 'Default/', '', '主题']) {
    assert.equal(THEME_ID_RE.test(bad), false, `应拒绝 ${bad}`);
  }
});

test('兜底常量：默认配色是显式 white / black，不依赖字母序', () => {
  assert.equal(DEFAULT_THEME_COLOR, 'white');
  assert.equal(DEFAULT_THEME_DARK_COLOR, 'black');
  assert.equal(DEFAULT_THEME_PACKAGE, 'default');
  // 'default' 只是空记录占位，不是配色
  assert.equal(DEFAULT_THEME_ID, 'default');
});

test('tone：只有两系，且没有 system（系别是配色自带属性，无从"跟随系统"）', () => {
  assert.deepEqual([...THEME_TONES], ['light', 'dark']);
  assert.deepEqual(TONE_LABELS, { light: '白系', dark: '黑系' });
  assert.equal(normalizeTone(' DARK '), 'dark');
  assert.equal(normalizeTone('Light'), 'light');
  assert.equal(normalizeTone('system'), null);
  assert.equal(normalizeTone(''), null);
  assert.equal(normalizeTone(undefined), null);
  assert.equal(isThemeTone('dark'), true);
  assert.equal(isThemeTone('system'), false);
});

test('mode：三态含 system，循环顺序固定', () => {
  assert.deepEqual([...MODE_CYCLE], ['system', 'light', 'dark']);
  assert.deepEqual(MODE_LABELS, { system: '跟随系统', light: '明', dark: '暗' });
  assert.equal(normalizeMode(' SYSTEM '), 'system');
  assert.equal(normalizeMode('dark'), 'dark');
  assert.equal(normalizeMode('auto'), null);
  assert.equal(normalizeMode(null), null);
  assert.equal(isThemeMode('light'), true);
  assert.equal(isThemeMode('dark-mode'), false);
});

test('readDeviceParam：设备专属键优先于通用键', () => {
  // 键形 `?th_<设备缩写>` / `?th_color_<设备缩写>`（下划线，禁用点号）
  const q = { th_mobile: 'compact', th: 'default' };
  assert.equal(readDeviceParam(q, 'th', 'mobile'), 'compact');
  assert.equal(readDeviceParam(q, 'th', 'std'), 'default'); // 该设备没指定 → 通用键
  assert.equal(readDeviceParam({ th_color_std: 'cyan', th_color: 'black' }, 'th_color', 'std'), 'cyan');
});

test('readDeviceParam：空串 / 纯空白 / 空数组 = 未指定，不得顶掉通用键', () => {
  assert.equal(readDeviceParam({ th_std: '', th: 'compact' }, 'th', 'std'), 'compact');
  assert.equal(readDeviceParam({ th_std: '   ', th: 'compact' }, 'th', 'std'), 'compact');
  assert.equal(readDeviceParam({ th_std: [''], th: 'compact' }, 'th', 'std'), 'compact');
  // 设备专属键一旦"存在非空值就用"，原样返回（可能是对同一个 key 重复传参得到的数组）
  assert.deepEqual(readDeviceParam({ th_std: ['', 'compact'], th: 'default' }, 'th', 'std'), [
    '',
    'compact'
  ]);
});

test('readDeviceParam：没有任何指定时返回 undefined（由调用方走包声明 → ENV → 当前包）', () => {
  assert.equal(readDeviceParam({}, 'th', 'mobile'), undefined);
  assert.equal(readDeviceParam(undefined, 'th', 'mobile'), undefined);
  assert.equal(readDeviceParam({ th_mobile: '' }, 'th', 'mobile'), undefined);
});

test('DEVICE_SCOPED_PARAMS：与 DeviceScopedParam 类型一致（造链接时可直接遍历）', () => {
  assert.deepEqual([...DEVICE_SCOPED_PARAMS], ['th', 'th_color']);
});

// ---- 版式意图 store 化（2026-10-20）：URL 一次读入的读入半边 ----
// 设备清单由调用方传入（本文件零 import 的分层承诺）；用 oauth21 的真实清单形状。
const DEVICES = [
  { id: 'mini', urlKey: 'mini' },
  { id: 'tablet', urlKey: 'tab' },
  { id: 'mobile', urlKey: 'mobile' },
  { id: 'standard', urlKey: 'std' }
];

test('DEFAULT_VIEW_PARAM：版式参数前缀是 th（配色侧是 th_color，两个家族）', () => {
  assert.equal(DEFAULT_VIEW_PARAM, 'th');
});

test('readUrlViewIntent：设备专属键进 deviceView，通用键进 viewIntent（不下发）', () => {
  const { deviceView, viewIntent } = readUrlViewIntent(
    { th_std: 'compact', th_mobile: 'default', th: 'base' },
    'th',
    DEVICES
  );
  // 专属键：只记被指定的那两台
  assert.deepEqual(deviceView, { standard: 'compact', mobile: 'default' });
  // 通用键原样进 viewIntent，不复制到每台设备（与配色侧 readUrlIntent 的刻意差别）
  assert.equal(viewIntent, 'base');
});

test('readUrlViewIntent：只有通用键时 deviceView 为空、viewIntent 承载它', () => {
  const { deviceView, viewIntent } = readUrlViewIntent({ th: 'compact' }, 'th', DEVICES);
  assert.deepEqual(deviceView, {});
  assert.equal(viewIntent, 'compact');
});

test('readUrlViewIntent：空串 / 纯空白 = 未指定，不得顶掉通用键', () => {
  const { deviceView, viewIntent } = readUrlViewIntent(
    { th_std: '', th: 'compact' },
    'th',
    DEVICES
  );
  assert.deepEqual(deviceView, {});
  assert.equal(viewIntent, 'compact');
  const blank = readUrlViewIntent({ th_std: '   ', th: 'compact' }, 'th', DEVICES);
  assert.deepEqual(blank.deviceView, {});
});

test('readUrlViewIntent：重复键（vue-router 数组）视为未指定，与配色侧 get() 净效果一致', () => {
  const { deviceView, viewIntent } = readUrlViewIntent(
    { th: ['compact', 'default'] },
    'th',
    DEVICES
  );
  assert.deepEqual(deviceView, {});
  assert.equal(viewIntent, null); // 落声明档，不猜用户想要哪个
});

test('readUrlViewIntent：query 为 undefined / 空对象时全无意图', () => {
  assert.deepEqual(readUrlViewIntent(undefined, 'th', DEVICES), { deviceView: {}, viewIntent: null });
  assert.deepEqual(readUrlViewIntent({}, 'th', DEVICES), { deviceView: {}, viewIntent: null });
});

test('readUrlViewIntent：自定义前缀（宿主改 viewParam 时键形跟着走）', () => {
  const { deviceView, viewIntent } = readUrlViewIntent(
    { view_std: 'compact', view: 'base' },
    'view',
    DEVICES
  );
  assert.deepEqual(deviceView, { standard: 'compact' });
  assert.equal(viewIntent, 'base');
});

test('viewParamsSnapshot：只收 th + th_<urlKey>（白名单），配色键 th_color 不进快照', () => {
  // 🔴 回归用例：曾用 startsWith('th_') 前缀匹配，把 th_color / th_color_std 也收进来，
  //    导致"换了一条带不同配色的链接"误触发版式意图同步。白名单（urlKey）天然排除。
  const snap = viewParamsSnapshot(
    { th: 'a', th_std: 'b', th_color: 'blue', th_color_std: 'blue', appName: 'x', rnd: '1' },
    'th',
    DEVICES
  );
  assert.deepEqual(snap, { th: 'a', th_std: 'b' });
  // 不认识的 th_  ？前缀（如 th_color）一律不进
  assert.deepEqual(viewParamsSnapshot({ th_color: 'blue' }, 'th', DEVICES), {});
});

test('sameViewSnapshot：键集合或原始值任一不同即"变了"', () => {
  assert.equal(sameViewSnapshot({ th: 'a' }, { th: 'a' }), true);
  assert.equal(sameViewSnapshot({ th: 'a' }, { th: 'b' }), false);
  assert.equal(sameViewSnapshot({ th: 'a' }, { th: 'a', th_std: 'b' }), false);
  assert.equal(sameViewSnapshot({}, {}), true);
});
