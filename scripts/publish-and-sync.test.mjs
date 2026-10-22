/**
 * publish-and-sync 纯函数的单测（node --test）
 *
 * 宿主 lock 补丁是两次发版里最容易静默出错的一步（CRLF 配 LF 锚点会匹配 0 次、
 * 锚点不唯一会补错块），所以补丁函数单独导出、在这里逐条断言：
 *   · 命中次数不对必须抛错（不是跳过）；
 *   · CRLF 与 LF 两种行尾都要能补；
 *   · 版本 / resolved / integrity 三字段真的换了。
 *
 * 跑法：`node --test`（随库的 test script 一起跑）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { patchPackageJsonSpec, patchLockfile } from './publish-and-sync.mjs';

const OLD_SPEC = '^0.6.0';
const NEW_VERSION = '0.7.0';
const INTEGRITY = 'sha512-TESTintegrity0000000000000000000000000000000000000000000==';
const TARBALL = 'https://registry.npmjs.org/skinsuite/-/skinsuite-0.7.0.tgz';

/** 造一份最小 lock（行尾可指定）—— 只含被测结构，不依赖真实文件 */
function fakeLock(newline) {
  return [
    '{',
    '  "name": "oauth-web",',
    '  "packages": {',
    '    "": {',
    '      "dependencies": {',
    `        "skinsuite": "${OLD_SPEC}",`,
    '        "vue": "^3.5.0"',
    '      }',
    '    },',
    '    "node_modules/skinsuite": {',
    '      "version": "0.6.0",',
    '      "resolved": "https://registry.npmjs.org/skinsuite/-/skinsuite-0.6.0.tgz",',
    '      "integrity": "sha512-OLDintegrity000000000000000000000000000000000000000000=="',
    '    },',
    '    "node_modules/vue": {',
    '      "version": "3.5.13",',
    '      "resolved": "https://registry.npmjs.org/vue/-/vue-3.5.13.tgz",',
    '      "integrity": "sha512-VUEintegrity=="',
    '    }',
    '  }',
    '}',
    ''
  ].join(newline);
}

test('patchPackageJsonSpec：替换依赖 spec 并报回旧值', () => {
  const text = `{\n  "dependencies": {\n    "skinsuite": "^0.6.0",\n    "vue": "^3.5.0"\n  }\n}\n`;
  const { text: out, oldSpec } = patchPackageJsonSpec(text, NEW_VERSION);
  assert.equal(oldSpec, OLD_SPEC);
  assert.ok(out.includes(`"skinsuite": "^${NEW_VERSION}"`));
  // 只动 skinsuite 一行：vue 的 spec 原样
  assert.match(out, /"vue": "\^3\.5\.0"/);
});

test('patchPackageJsonSpec：找不到依赖声明 → 抛错（不是静默通过）', () => {
  assert.throws(() => patchPackageJsonSpec('{"dependencies":{"vue":"^3.5.0"}}', NEW_VERSION), /找不到/);
});

test('patchLockfile：CRLF 行尾下三字段全部换掉', () => {
  const { buf, oldVersion } = patchLockfile(
    Buffer.from(fakeLock('\r\n'), 'utf8'),
    OLD_SPEC,
    NEW_VERSION,
    INTEGRITY,
    TARBALL
  );
  const out = buf.toString('utf8');
  assert.equal(oldVersion, '0.6.0');
  // 根 spec
  assert.ok(out.includes(`"skinsuite": "^${NEW_VERSION}"`));
  // 三字段
  assert.ok(out.includes(`"version": "${NEW_VERSION}"`));
  assert.ok(out.includes(`"resolved": "${TARBALL}"`));
  assert.ok(out.includes(`"integrity": "${INTEGRITY}"`));
  // 旧值彻底消失
  assert.doesNotMatch(out, /0\.6\.0/);
  assert.doesNotMatch(out, /OLDintegrity/);
  // 别的包的块没被碰
  assert.match(out, /"version": "3\.5\.13"/);
  // 行尾保持 CRLF（没被规范化成 LF）：每个 \n 都属于某个 \r\n
  assert.ok(out.includes('\r\n'));
  assert.equal(out.split('\n').length, out.split('\r\n').length);
});

test('patchLockfile：LF 行尾同样能补', () => {
  const { buf } = patchLockfile(
    Buffer.from(fakeLock('\n'), 'utf8'),
    OLD_SPEC,
    NEW_VERSION,
    INTEGRITY,
    TARBALL
  );
  const out = buf.toString('utf8');
  assert.match(out, /"version": "0\.7\.0"/);
  assert.doesNotMatch(out, /OLDintegrity/);
});

test('patchLockfile：integrity 行尾带逗号（非末字段形态）也能补', () => {
  // 真实 lock 里 integrity 是 skinsuite 块的末字段（无尾逗号，上面两个用例的形态）；
  // 这里证明正则不依赖「末字段」假设 —— 块里 integrity 后面还有字段时同样能补。
  const withComma = fakeLock('\n').replace(
    /"integrity": "sha512-OLDintegrity[^"]*=="/,
    '"integrity": "sha512-OLDintegrity000000000000000000000000000000000000000000==",\n      "dev": true'
  );
  const { buf } = patchLockfile(
    Buffer.from(withComma, 'utf8'),
    OLD_SPEC,
    NEW_VERSION,
    INTEGRITY,
    TARBALL
  );
  const out = buf.toString('utf8');
  assert.ok(out.includes(`"integrity": "${INTEGRITY}"`));
  assert.match(out, /"dev": true/); // 后续字段没被弄丢
});

test('patchLockfile：根 spec 缺失 → 抛错', () => {
  const broken = fakeLock('\n').replace(`"skinsuite": "${OLD_SPEC}"`, '"skinsuite": "^0.5.9"');
  assert.throws(() => patchLockfile(Buffer.from(broken), OLD_SPEC, NEW_VERSION, INTEGRITY, TARBALL), /命中 0 次/);
});

test('patchLockfile：skinsuite 块缺失 → 抛错', () => {
  const broken = fakeLock('\n').replace(/"node_modules\/skinsuite": \{[\s\S]*?\},/, '');
  assert.throws(() => patchLockfile(Buffer.from(broken), OLD_SPEC, NEW_VERSION, INTEGRITY, TARBALL), /找不到/);
});
