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
  DEFAULT_THEME_PAGE,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_DARK_COLOR,
  BASE_VIEW_ID,
  THEME_TONES,
  TONE_LABELS,
  isThemeTone,
  normalizeTone,
  MODE_CYCLE,
  MODE_LABELS,
  isThemeMode,
  normalizeMode,
  DEVICE_SCOPED_PARAMS,
  readDeviceParam
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
  assert.equal(DEFAULT_THEME_PAGE, 'login');
  // 'default' 只是空记录占位，不是配色
  assert.equal(DEFAULT_THEME_ID, 'default');
  // 'base' 是版式工厂的逻辑 id，永远不该出现在配色键里
  assert.equal(BASE_VIEW_ID, 'base');
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
  const q = { 'view.mobile': 'compact', view: 'default' };
  assert.equal(readDeviceParam(q, 'view', 'mobile'), 'compact');
  assert.equal(readDeviceParam(q, 'view', 'standard'), 'default'); // 该设备没指定 → 通用键
  assert.equal(readDeviceParam({ 'theme.standard': 'cyan', theme: 'black' }, 'theme', 'standard'), 'cyan');
});

test('readDeviceParam：空串 / 纯空白 / 空数组 = 未指定，不得顶掉通用键', () => {
  assert.equal(readDeviceParam({ 'view.standard': '', view: 'compact' }, 'view', 'standard'), 'compact');
  assert.equal(readDeviceParam({ 'view.standard': '   ', view: 'compact' }, 'view', 'standard'), 'compact');
  assert.equal(readDeviceParam({ 'view.standard': [''], view: 'compact' }, 'view', 'standard'), 'compact');
  // 设备专属键一旦"存在就用"，原样返回（可能是对同一个 key 重复传参得到的数组）
  assert.deepEqual(
    readDeviceParam({ 'view.standard': ['', 'compact'], view: 'default' }, 'view', 'standard'),
    ['', 'compact']
  );
});

test('readDeviceParam：没有任何指定时返回 undefined（由调用方走包声明 → ENV → 当前包）', () => {
  assert.equal(readDeviceParam({}, 'view', 'mobile'), undefined);
  assert.equal(readDeviceParam(undefined, 'view', 'mobile'), undefined);
  assert.equal(readDeviceParam({ 'view.mobile': '' }, 'view', 'mobile'), undefined);
});

test('DEVICE_SCOPED_PARAMS：与 DeviceScopedParam 类型一致（造链接时可直接遍历）', () => {
  assert.deepEqual([...DEVICE_SCOPED_PARAMS], ['view', 'theme']);
});
