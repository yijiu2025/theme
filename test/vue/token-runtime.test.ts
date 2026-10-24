/**
 * token-runtime 作用域注入的行为测试（P1a，2026-10-23）
 *
 * 跑在 node 下，DOM 用 happy-dom。覆盖：
 *   · 缺省 target = html 根（向后兼容）
 *   · 两个 target 各自维护注入名单、互不串台、互不清除
 *   · 差集清理只动"该目标自己写过的变量名"
 *   · clearThemeTokens(el) 精确摘除 / 全局版缺省
 *
 * @author yijiu2025
 * @since 2026-10-23
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import {
  applyThemeLayers,
  clearThemeTokens,
  getInjectedTokenNames
} from '../../src/vue/runtime/token-runtime';

// document 类型用 lib.dom 的 Document（与 token-runtime 的签名一致）；
// happy-dom 的 DOM 类型与之是两套，边界处 cast 一次消歧。
let document: Document;
let window: Window;

before(() => {
  window = new Window({ url: 'https://example.test/' });
  (globalThis as Record<string, unknown>).window = window;
  document = window.document as unknown as Document;
  (globalThis as Record<string, unknown>).document = document;
});

after(() => {
  window.close(); // 清 happy-dom 内部定时器，防 node --test 卡事件循环
});

test('缺省 target = html 根（历史行为不变）', () => {
  clearThemeTokens();
  const rejected = applyThemeLayers({ theme: { '--mauth-bg': '#ffffff' } });
  assert.equal(rejected.length, 0);
  assert.equal(document.documentElement.style.getPropertyValue('--mauth-bg'), '#ffffff');
  assert.deepEqual(getInjectedTokenNames(), ['--mauth-bg']);
  clearThemeTokens();
  assert.equal(document.documentElement.style.getPropertyValue('--mauth-bg'), '');
  assert.deepEqual(getInjectedTokenNames(), []);
});

test('两个 target 互不串台：各写各的、各清各的', () => {
  const a = document.createElement('div');
  const b = document.createElement('div');
  applyThemeLayers({ theme: { '--mauth-bg': '#111111' } }, { target: a });
  applyThemeLayers({ theme: { '--mauth-text': '#222222' } }, { target: b });

  assert.equal(a.style.getPropertyValue('--mauth-bg'), '#111111');
  assert.equal(b.style.getPropertyValue('--mauth-text'), '#222222');
  // 各自名单独立：a 没有 --mauth-text，b 没有 --mauth-bg
  assert.deepEqual(getInjectedTokenNames(a), ['--mauth-bg']);
  assert.deepEqual(getInjectedTokenNames(b), ['--mauth-text']);

  clearThemeTokens(a);
  assert.equal(a.style.getPropertyValue('--mauth-bg'), '');
  // b 不受影响
  assert.equal(b.style.getPropertyValue('--mauth-text'), '#222222');
  clearThemeTokens(b);
});

test('同一 target 换配色：差集清理只动自己写过的名字', () => {
  const el = document.createElement('div');
  el.style.setProperty('--foreign', 'keep'); // 别人留在上面的
  applyThemeLayers({ theme: { '--mauth-bg': '#111111', '--mauth-text': '#222222' } }, { target: el });
  applyThemeLayers({ theme: { '--mauth-bg': '#333333' } }, { target: el });

  assert.equal(el.style.getPropertyValue('--mauth-bg'), '#333333');
  assert.equal(el.style.getPropertyValue('--mauth-text'), ''); // 上一轮有、这轮没有 → 清除
  assert.equal(el.style.getPropertyValue('--foreign'), 'keep'); // 不碰别人写的
  assert.deepEqual(getInjectedTokenNames(el), ['--mauth-bg']);
  clearThemeTokens(el);
});

test('非法值被拒且名单干净（白名单在注入边界生效）', () => {
  const el = document.createElement('div');
  const rejected = applyThemeLayers(
    { theme: { '--mauth-bg': 'url(https://evil.test/x.png)', '--mauth-text': '#222222' } },
    { target: el }
  );
  assert.equal(rejected.length, 1);
  assert.equal(el.style.getPropertyValue('--mauth-bg'), '');
  assert.equal(el.style.getPropertyValue('--mauth-text'), '#222222');
  assert.deepEqual(getInjectedTokenNames(el), ['--mauth-text']);
  clearThemeTokens(el);
});
