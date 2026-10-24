/**
 * device-domain 无路由回退的行为测试（P0 ④，2026-10-23）
 *
 * 覆盖：
 *   · 未装 router 时 currentQuery() 读 location.search（一次性快照），
 *     重复键折叠成数组（与 vue-router LocationQuery 同形）
 *   · 装了 router 后 currentQuery() 走路由 query（既有行为不回退）
 *
 * 模块级单例（routerRef / routerlessQuery）随本文件独立打包隔离 —— 用例间顺序敏感，
 * 用例内自包含（先回退、后装 router，只升不降）。
 *
 * @author yijiu2025
 * @since 2026-10-23
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import { currentQuery, installThemeDomain } from '../../src/vue/device-domain';
import type { DeviceDomainRouter } from '../../src/vue/device-domain';

let window: Window;

before(() => {
  window = new Window({ url: 'https://example.test/' });
  (globalThis as Record<string, unknown>).window = window;
});

after(() => {
  window.close(); // 清 happy-dom 内部定时器，防 node --test 卡事件循环
});

test('未装 router：读 location.search 一次性快照，重复键折叠为数组', () => {
  window.location.href = 'https://example.test/?th=compact&th=a&th=b&client_id=42';

  const q = currentQuery();
  // 单键 → 字符串
  assert.equal(q.client_id, '42');
  // 重复键 → 数组（与 vue-router 同形；readUrlViewIntent 的 present() 拒绝数组 ⇒ 按未指定）
  assert.ok(Array.isArray(q.th));
  assert.deepEqual([...(q.th as string[])].sort(), ['a', 'b', 'compact']);
  // 一次性快照：同一次装配期内再读是同一份对象（无路由就没有响应性，快照语义）
  assert.equal(currentQuery(), q);
});

test('装了 router 后：currentQuery 走路由 query（既有行为，不回退 location.search）', () => {
  const fakeRouter: DeviceDomainRouter = {
    currentRoute: {
      value: { query: { th: 'router-value' }, path: '/x', fullPath: '/x?th=router-value' }
    }
  };
  installThemeDomain({ router: fakeRouter });
  assert.equal(currentQuery().th, 'router-value');
});
