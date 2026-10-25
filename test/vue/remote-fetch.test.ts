/**
 * remote-fetch 行为测试 —— 身份参数通用化（键名不预设、空值剔除）与取数骨架口径
 *
 * 跑在 node 下，window 用 happy-dom；fetch 用可替换桩（记录 URL 与 init）。
 * 覆盖：
 *   · params 任意键名原样附到查询串（库不预设 client_id 等业务词汇）
 *   · 空串 / undefined 的参数不发送
 *   · 端点为空 = 机制关闭：直接 null，不发任何请求
 *   · 默认 credentials 'omit'（不带 cookie）
 *   · 响应经 normalizeRemoteThemeConfig 归一（非法 mode 丢弃、全空返回 null）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import {
  fetchRemoteThemeConfig,
  isRemoteThemeEnabled
} from '../../src/vue/runtime/remote-fetch';

const window = new Window({ url: 'https://app.test/login?client_id=abc' });
(globalThis as Record<string, unknown>).window = window;

/** fetch 桩：记录本次请求的 URL 与 init；响应可逐用例替换 */
let lastUrl: string | null = null;
let lastInit: Record<string, unknown> | null = null;
let respond: () => Promise<{ ok: boolean; json: () => Promise<unknown> }> = () =>
  Promise.resolve({ ok: true, json: async () => ({}) });
(globalThis as Record<string, unknown>).fetch = (...args: unknown[]) => {
  lastUrl = String(args[0]);
  lastInit = (args[1] ?? {}) as Record<string, unknown>;
  return respond();
};

test('params 任意键名原样附到查询串（库不预设业务词汇）', async () => {
  respond = () => Promise.resolve({ ok: true, json: async () => ({ theme: 'blue' }) });
  const config = await fetchRemoteThemeConfig({
    endpoint: '/api/theme',
    params: { client_id: 'abc', user_id: 'u1', app: 'posecraft' }
  });
  assert.ok(lastUrl);
  const url = new URL(lastUrl);
  assert.equal(url.origin, 'https://app.test');
  assert.equal(url.pathname, '/api/theme');
  assert.equal(url.searchParams.get('client_id'), 'abc');
  assert.equal(url.searchParams.get('user_id'), 'u1');
  assert.equal(url.searchParams.get('app'), 'posecraft');
  assert.deepEqual(config, { theme: 'blue' });
});

test('空串 / undefined 的参数不发送；不带 params 时查询串为空', async () => {
  await fetchRemoteThemeConfig({
    endpoint: '/api/theme',
    params: { keep: 'x', empty: '', gone: undefined }
  });
  assert.ok(lastUrl);
  const url = new URL(lastUrl);
  assert.equal(url.searchParams.get('keep'), 'x');
  assert.equal(url.searchParams.has('empty'), false);
  assert.equal(url.searchParams.has('gone'), false);

  await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.equal(new URL(lastUrl!).search, '');
});

test('端点为空 = 机制关闭：null 且不发任何请求', async () => {
  assert.equal(isRemoteThemeEnabled(''), false);
  assert.equal(isRemoteThemeEnabled(undefined), false);
  lastUrl = null;
  const config = await fetchRemoteThemeConfig({ endpoint: '' });
  assert.equal(config, null);
  assert.equal(lastUrl, null);
});

test('默认 credentials=omit（不带 cookie）', async () => {
  await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.equal((lastInit as { credentials?: string } | null)?.credentials, 'omit');
});

test('响应归一：非法 mode 丢弃；三字段全空返回 null', async () => {
  respond = () =>
    Promise.resolve({ ok: true, json: async () => ({ theme: 'blue', mode: 'nope' }) });
  const ok = await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.deepEqual(ok, { theme: 'blue' });

  respond = () => Promise.resolve({ ok: true, json: async () => ({ mode: 'nope' }) });
  const empty = await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.equal(empty, null);
});
