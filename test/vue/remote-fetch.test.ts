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
 *   · 危险协议拦截（javascript:/data:/file: 不发请求）
 *   · 私有 / 回环 / 链路本地主机默认拒绝（SSRF 防护），allowPrivateHosts 放行
 *   · 非 200 / 网络错误 / 超时 一律静默返回 null
 */
import { test, after } from 'node:test';
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
let respond: (init?: Record<string, unknown>) => Promise<{ ok: boolean; json: () => Promise<unknown> }> = () =>
  Promise.resolve({ ok: true, json: async () => ({}) });
(globalThis as Record<string, unknown>).fetch = (...args: unknown[]) => {
  lastUrl = String(args[0]);
  lastInit = (args[1] ?? {}) as Record<string, unknown>;
  return respond(lastInit);
};

after(() => {
  window.close();
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).fetch;
});

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

test('危险协议拦截：javascript:/data:/file: 不发请求', async () => {
  for (const endpoint of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
    lastUrl = null;
    const config = await fetchRemoteThemeConfig({ endpoint });
    assert.equal(config, null, `${endpoint} 应被拦`);
    assert.equal(lastUrl, null, `${endpoint} 不该发请求`);
  }
});

test('私有 / 回环 / 链路本地主机默认拒绝（SSRF 防护）', async () => {
  const privateEndpoints = [
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/theme',
    'http://172.16.0.1/theme',
    'http://192.168.1.1/theme',
    'http://127.0.0.1:8080/theme',
    'http://localhost:3000/theme',
    'http://[::1]/theme'
  ];
  for (const endpoint of privateEndpoints) {
    lastUrl = null;
    const config = await fetchRemoteThemeConfig({ endpoint });
    assert.equal(config, null, `${endpoint} 应被拦`);
    assert.equal(lastUrl, null, `${endpoint} 不该发请求`);
  }
});

test('allowPrivateHosts 放行私有主机', async () => {
  respond = () => Promise.resolve({ ok: true, json: async () => ({ theme: 'blue' }) });
  const config = await fetchRemoteThemeConfig({
    endpoint: 'http://localhost:3000/theme',
    allowPrivateHosts: true
  });
  assert.deepEqual(config, { theme: 'blue' });
  assert.ok(lastUrl);
});

test('公网绝对 URL 不被误拦', async () => {
  respond = () => Promise.resolve({ ok: true, json: async () => ({ theme: 'blue' }) });
  const config = await fetchRemoteThemeConfig({ endpoint: 'https://api.example.com/theme' });
  assert.deepEqual(config, { theme: 'blue' });
});

test('非 200：静默返回 null', async () => {
  respond = () => Promise.resolve({ ok: false, json: async () => ({}) });
  const config = await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.equal(config, null);
});

test('网络错误：静默返回 null', async () => {
  respond = () => Promise.reject(new Error('network down'));
  const config = await fetchRemoteThemeConfig({ endpoint: '/api/theme' });
  assert.equal(config, null);
});

test('超时：fetch 挂起超过 timeoutMs 后静默返回 null', async () => {
  respond = (init) =>
    new Promise((_, reject) => {
      const signal = (init as { signal?: AbortSignal })?.signal;
      signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const config = await fetchRemoteThemeConfig({ endpoint: '/api/theme', timeoutMs: 10 });
  assert.equal(config, null);
});
