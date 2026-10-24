/**
 * createThemeState 无路由 / defaultPage 播种的行为测试（P0 ③，2026-10-23）
 *
 * 覆盖：
 *   · defaultPage 播种：没有 <ThemeView>/<ThemeScope> 时 activePage 已有值，
 *     token 从首帧就能解析（此前 activePage 空串 → 零注入）
 *   · 无 defaultPage 时行为不变（activePage 空串）
 *   · dispose() 收全可调用、不抛（watcher 停止的回归在宿主 HMR 场景，这里锁调用面）
 *
 * @author yijiu2025
 * @since 2026-10-23
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
// 🔴 必须从**源码相对路径** import（随本测试一起打包）——bundle 内的 createThemeState
//    读的是被打包的 registry 单例；从 'skinsuite'（dist）装表装的是另一个实例，两不相通。
import { buildThemeRegistry, installThemeRegistry } from '../../src/registry';
import type { ThemeAssetModules } from '../../src/registry';

import { createThemeState } from '../../src/vue/store/create-theme-state';
import { getInjectedTokenNames } from '../../src/vue/runtime/token-runtime';

let window: Window;

before(() => {
  window = new Window({ url: 'https://example.test/' });
  (globalThis as Record<string, unknown>).window = window;
  (globalThis as Record<string, unknown>).document = window.document;
  (globalThis as Record<string, unknown>).localStorage = window.localStorage;
});

after(() => {
  // 🔴 happy-dom 的 matchMedia 等内部定时器会让 node --test 等事件循环排空而卡住——
  //    关闭窗口清掉它们。dispose 摘监听是 store 侧职责，这里是测试环境的收尾。
  window.close();
});

/** 一张含 app 页面的最小注册表（default 包 / standard 设备 / app 页 / white 配色） */
function installAppRegistry() {
  const modules: ThemeAssetModules = {
    packages: { './default/index.ts': { default: { meta: { id: 'default', name: '默认包' } } } },
    colors: {
      './default/standard/app/colors/white/index.ts': {
        default: {
          meta: { id: 'white', name: '白' },
          tone: 'light',
          tokens: { '--mauth-bg': '#ffffff', '--mauth-text': '#0f172a' }
        }
      }
    },
    styles: {}
  };
  installThemeRegistry(buildThemeRegistry(modules));
}

test('defaultPage 播种：无 ThemeView 也首帧解析 token', async () => {
  installAppRegistry();
  const state = createThemeState({ defaultPage: 'app', storageKeys: { mode: 'm1', theme: 't1' } });
  try {
    // 🔴 createThemeState 返回**裸 ref**（pinia 才会解包），断言必须读 .value——
    //    直接 assert.equal(ref, '') 失败时 assert 会 inspect 整个 RefImpl 的 Dep 循环图，
    //    node 的 util.inspect 会卡死（本文件踩过，见 probe 记录）。
    assert.equal(state.activePage.value, 'app');
    assert.equal(state.activeDevice.value, '');
    state.setActiveDevice('standard');
    assert.equal(state.activeDevice.value, 'standard');
    // vue watch 默认 flush 'pre' 异步调度：等一个宏任务让 watcher 队列跑完
    await new Promise(resolve => setTimeout(resolve, 50));
    // 生效记录 = getThemeRecord({ id:'default', device:'standard', pkg:'default', page:'app' })
    // 回退链 → 该范围兜底色 white → tokens 注入 html 根
    assert.deepEqual([...getInjectedTokenNames()].sort(), ['--mauth-bg', '--mauth-text']);
  } finally {
    state.dispose();
  }
});

test('无 defaultPage：activePage 空串（历史行为不变）', () => {
  const state = createThemeState({ storageKeys: { mode: 'm2', theme: 't2' } });
  try {
    assert.equal(state.activePage.value, '');
  } finally {
    state.dispose();
  }
});

test('dispose() 可调用且不抛（收全各层 stop 句柄后的调用面回归）', () => {
  installAppRegistry();
  const state = createThemeState({ defaultPage: 'app', storageKeys: { mode: 'm3', theme: 't3' } });
  assert.doesNotThrow(() => state.dispose());
  // 二次 dispose 不炸（幂等性——各层 cleanup 都有 no-op 兜底）
  assert.doesNotThrow(() => state.dispose());
});
