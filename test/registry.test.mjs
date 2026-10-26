/**
 * 配色注册表的行为测试 —— 针对**构建产物** dist/ 跑
 *
 * 背景（2026-10-23 索引化）：查询层从 O(n) 全表扫描改为惰性索引（WeakMap 按注册表
 * 实例缓存）。本文件锁的是**语义不变**：
 *   • findRecord 回退链（精确 → 同包 → 默认包）与"先到先得"的路径序
 *   • defaultColorIdOf 的 white 优先 / 字母序兜底
 *   • resolveThemeId 的可选段过滤
 *   • installThemeRegistry 换表后索引随之失效（新表查询不读旧索引）
 *
 * @author yijiu2025
 * @since 2026-10-23
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildThemeRegistry,
  installThemeRegistry,
  getThemeRecord,
  getDefaultThemeId,
  isKnownTheme,
  listColorIdsOfTone,
  listColorsOf,
  listColorViews,
  listThemes,
  resolveThemeId,
  toneOfAnyScope,
  toneOfColor
} from '../dist/index.js';

/* ---------------------------------------------------------------------------
 * 造表：default 包（white/black/blue）+ compact 包（只有 blue，验证跨包回退）
 * ------------------------------------------------------------------------- */
function fixtureModules() {
  const color = (id, tone, tokens) => ({ default: { meta: { id, name: id }, tone, tokens } });
  return {
    packages: {
      './default/index.ts': { default: { meta: { id: 'default', name: '默认包' } } },
      './compact/index.ts': { default: { meta: { id: 'compact', name: '紧凑包' } } }
    },
    colors: {
      './default/mobile/login/colors/black/index.ts': color('black', 'dark'),
      './default/mobile/login/colors/blue/index.ts': color('blue', 'light', { '--mauth-bg': '#0000ff' }),
      './default/mobile/login/colors/white/index.ts': color('white', 'light'),
      './compact/mobile/login/colors/blue/index.ts': color('blue', 'dark')
    },
    styles: {}
  };
}

/** 每个用例先装自己的表 —— 查询层是模块级单例，用例间必须显式换表 */
function installFixture() {
  const registry = buildThemeRegistry(fixtureModules());
  installThemeRegistry(registry);
  return registry;
}

test('buildThemeRegistry：登记四段归属 + meta.id 以目录名为准', () => {
  const registry = installFixture();
  assert.equal(registry.size, 4);
  const rec = registry.get('default/mobile/login/white');
  assert.ok(rec);
  assert.equal(rec.pkg, 'default');
  assert.equal(rec.device, 'mobile');
  assert.equal(rec.page, 'login');
  assert.equal(rec.meta.id, 'white');
  assert.equal(rec.tone, 'light');
});

test('buildThemeRegistry：meta.id 一律以目录名为准（写错 meta.id 也被纠正）', () => {
  const modules = fixtureModules();
  // 配色文件里 meta.id 写错（与目录名不一致）→ 注册表以目录名为准
  modules.colors['./default/mobile/login/colors/white/index.ts'] = {
    default: { meta: { id: 'wrong-id', name: '白' }, tone: 'light' }
  };
  const registry = buildThemeRegistry(modules);
  const rec = registry.get('default/mobile/login/white');
  assert.ok(rec, '按目录名登记');
  assert.equal(rec.meta.id, 'white'); // 纠正为目录名，wrong-id 不外泄
  // 🔴 先把本用例刚构建的表装进单例，再按目录名/写错 id 查询：此前这两个断言
  //    读的是**上一个用例 installFixture() 装的旧单例**，与本用例的 registry 解耦，
  //    既不验证纠正行为（假绿），单独运行还因单例为空而红。
  installThemeRegistry(registry);
  assert.equal(resolveThemeId('white'), 'white');
  assert.equal(resolveThemeId('wrong-id'), null);
});

test('findRecord 回退链：精确命中', () => {
  installFixture();
  const rec = getThemeRecord({ id: 'white', device: 'mobile', pkg: 'default', page: 'login' });
  assert.equal(rec.meta.id, 'white');
});

test('findRecord 回退链：当前包没有该 id 时跨包回退默认包', () => {
  installFixture();
  // compact 包只有 blue；向 compact 要 white → 回退到 default 包的 white
  const rec = getThemeRecord({ id: 'white', device: 'mobile', pkg: 'compact', page: 'login' });
  assert.equal(rec.meta.id, 'white');
  assert.equal(rec.pkg, 'default');
});

test('getThemeRecord 回退链：id 不存在时按系别 → 兜底 → 空记录', () => {
  installFixture();
  // 不存在的 id：toneOfAnyScope 查不到 → 落该范围兜底色 white
  const fallback = getThemeRecord({ id: 'nope', device: 'mobile', pkg: 'default', page: 'login' });
  assert.equal(fallback.meta.id, 'white');
  // 完全空白的作用域：空记录兜底（id = 'default' 占位）
  const empty = getThemeRecord({ id: 'white', device: 'mobile', pkg: 'default', page: 'register' });
  assert.equal(empty.meta.id, 'default');
  assert.equal(empty.tokens, undefined);
});

test('getDefaultThemeId：显式 white 优先；没有 white 的范围退字母序第一', () => {
  installFixture();
  assert.equal(getDefaultThemeId({ device: 'mobile', page: 'login', pkg: 'default' }), 'white');
  // compact 只有 blue → 字母序第一（也是唯一）
  assert.equal(getDefaultThemeId({ device: 'mobile', page: 'login', pkg: 'compact' }), 'blue');
  // 空范围 → null
  assert.equal(getDefaultThemeId({ device: 'mobile', page: 'register' }), null);
});

test('toneOfAnyScope：跨包同名 id 时按路径序第一份（compact < default）', () => {
  installFixture();
  // blue 在 default 包是 light、在 compact 包是 dark；
  // 构建按路径字母序装入（./compact/... < ./default/...），第一份是 compact 的
  assert.equal(toneOfAnyScope('blue'), 'dark');
  assert.equal(toneOfAnyScope('black'), 'dark');
  assert.equal(toneOfAnyScope('white'), 'light');
  assert.equal(toneOfAnyScope('nope'), null);
});

test('toneOfColor / listColorIdsOfTone：作用域内按包过滤', () => {
  installFixture();
  assert.equal(toneOfColor('blue', 'mobile', 'login', 'compact'), 'dark');
  assert.equal(toneOfColor('blue', 'mobile', 'login', 'default'), 'light');
  assert.deepEqual(listColorIdsOfTone('mobile', 'login', 'default', 'light'), ['blue', 'white']);
  assert.deepEqual(listColorIdsOfTone('mobile', 'login', 'default', 'dark'), ['black']);
  assert.deepEqual(listColorIdsOfTone('mobile', 'login', 'compact', 'light'), []);
});

test('listColorsOf / listThemes / listColorViews：排序与设备过滤', () => {
  installFixture();
  assert.deepEqual(
    listColorsOf('mobile', 'login', 'default').map(m => m.id),
    ['black', 'blue', 'white']
  );
  assert.equal(listThemes().length, 4);
  assert.equal(listThemes('mobile').length, 4);
  assert.equal(listThemes('standard').length, 0);
  assert.deepEqual(listColorViews('mobile', 'login'), ['compact', 'default']);
  assert.deepEqual(listColorViews('mobile', 'register'), []);
});

test('resolveThemeId：归一 + 可选段过滤；isKnownTheme 同口径', () => {
  installFixture();
  assert.equal(resolveThemeId(' WHITE '), 'white'); // 归一：trim + 小写
  assert.equal(resolveThemeId('nope'), null);
  assert.equal(resolveThemeId('Blue', 'mobile', 'login', 'compact'), 'blue'); // compact 也有 blue
  assert.equal(resolveThemeId('white', 'mobile', 'login', 'compact'), null); // compact 没有 white
  assert.equal(resolveThemeId('white', 'standard', 'login'), null); // 设备段过滤
  assert.equal(isKnownTheme('blue'), true);
  assert.equal(isKnownTheme('blue', 'mobile', 'login', 'compact'), true);
  assert.equal(isKnownTheme('blue', 'standard'), false);
});

test('installThemeRegistry 换表：新表查询不读旧索引（索引失效）', () => {
  installFixture();
  // 旧表：default 包有 blue（light），compact 包也有 blue（dark）
  assert.equal(toneOfColor('blue', 'mobile', 'login', 'default'), 'light');
  assert.equal(listThemes().length, 4);
  // 换一张删掉了 default 包 blue 的表
  const modules = fixtureModules();
  delete modules.colors['./default/mobile/login/colors/blue/index.ts'];
  installThemeRegistry(buildThemeRegistry(modules));
  // 新表查询不读旧索引：default 的 blue 消失（toneOfColor 回退链也找不到），
  // 全表与 toneOfAnyScope 只剩 compact 的 blue
  assert.equal(toneOfColor('blue', 'mobile', 'login', 'default'), null);
  assert.equal(toneOfAnyScope('blue'), 'dark');
  assert.equal(listThemes().length, 3);
});

/* ---------------------------------------------------------------------------
 * 部件配色（P1b，2026-10-23）：parts 形状的键 → page 段记 `part:<id>` 命名空间
 * ------------------------------------------------------------------------- */

test('buildThemeRegistry：部件配色键解析为 page = part:<id> 命名空间', () => {
  const modules = {
    packages: { './default/index.ts': { default: { meta: { id: 'default', name: '默认包' } } } },
    colors: {
      './default/standard/parts/confirm-modal/colors/black/index.ts': {
        default: { meta: { id: 'black', name: '黑' }, tone: 'dark', tokens: { '--mauth-bg': '#000' } }
      },
      './default/standard/parts/confirm-modal/colors/white/index.ts': {
        default: { meta: { id: 'white', name: '白' }, tone: 'light', tokens: { '--mauth-bg': '#fff' } }
      }
    },
    styles: {
      './default/standard/parts/confirm-modal/colors/black/theme.scss': async () => '.x{}'
    }
  };
  const registry = buildThemeRegistry(modules);
  installThemeRegistry(registry); // 🔴 查询函数读模块级单例，必须装入
  assert.equal(registry.size, 2);

  const black = registry.get('default/standard/part:confirm-modal/black');
  assert.ok(black, '部件配色以 part:<id> 页段登记');
  assert.equal(black.page, 'part:confirm-modal');
  assert.equal(black.tone, 'dark');
  assert.equal(typeof black.loadStyle, 'function'); // 部件 theme.scss 正常挂上

  // 查询链原样可用：getThemeRecord 用 part: 页段解析
  const rec = getThemeRecord({
    id: 'black',
    device: 'standard',
    pkg: 'default',
    page: 'part:confirm-modal'
  });
  assert.equal(rec.meta.id, 'black');
  assert.equal(toneOfAnyScope('black'), 'dark');
  // 范围兜底：white 是显式默认色
  assert.equal(getDefaultThemeId({ device: 'standard', page: 'part:confirm-modal', pkg: 'default' }), 'white');
});

test('buildThemeRegistry：页面形态键不受 parts 解析器影响（先页面后部件）', () => {
  const modules = {
    packages: { './default/index.ts': { default: { meta: { id: 'default', name: '默认包' } } } },
    colors: {
      './default/standard/parts/colors/white/index.ts': {
        default: { meta: { id: 'white', name: '白' }, tone: 'light' }
      }
    },
    styles: {}
  };
  const registry = buildThemeRegistry(modules);
  // `./pkg/dev/parts/colors/x/…`：页面名真叫 `parts` 的病理键 → 按页面形态归档（page='parts'）
  const rec = registry.get('default/standard/parts/white');
  assert.ok(rec);
  assert.equal(rec.page, 'parts'); // 不是 part:colors 命名空间
});

test('buildThemeRegistry：index.js 形态的键与 index.ts 同权（纯 JS 宿主）', () => {
  const registry = buildThemeRegistry({
    packages: {
      './jspkg/index.js': { default: { meta: { id: 'jspkg', name: 'JS 包' } } }
    },
    colors: {
      './jspkg/mobile/login/colors/white/index.js': {
        default: { meta: { id: 'white', name: '白' }, tone: 'light' }
      }
    },
    styles: {}
  });
  const rec = registry.get('jspkg/mobile/login/white');
  assert.ok(rec, 'index.js 的包/配色键应正常解析登记');
  assert.equal(rec.pkg, 'jspkg');
  assert.equal(rec.tone, 'light');
});
