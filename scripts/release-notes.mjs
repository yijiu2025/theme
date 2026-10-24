/**
 * 发布说明抽取 —— 从 CHANGELOG.md 取指定版本的段落（GitHub Release 的 body 来源）
 *
 * 用法：`node scripts/release-notes.mjs <版本号>`（如 0.10.1；tag 名去 v 后传入）。
 * 抽取规则（按行扫描，不用正则 —— lookahead 的 `\s*$` 与 `$` 行尾语义组合会在
 * 段首空行处产生空捕获，2026-10-24 实测）：`## <版本>` 行起、下一个 `## ` 行前的
 * 全部内容；找不到段落时退出码 1 —— 发布流水线里 body 缺失应该响亮失败，
 * 而不是发出空 Release。
 *
 * @author yijiu2025
 * @since 2026-10-24（release-npm.yml 增加 github-release job：打 tag → npm 发布 → 同步建 GitHub Release）
 */
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('用法: node scripts/release-notes.mjs <版本号>（如 0.10.1）');
  process.exit(1);
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const start = lines.findIndex(line => line.startsWith(`## ${version}`));
if (start < 0) {
  console.error(`CHANGELOG.md 里没有 ${version} 的段落 —— 先补 CHANGELOG 再发版`);
  process.exit(1);
}
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith('## ')) {
    end = i;
    break;
  }
}

const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
  console.error(`CHANGELOG.md 里 ${version} 的段落为空 —— 先补 CHANGELOG 再发版`);
  process.exit(1);
}

process.stdout.write(body + '\n');
