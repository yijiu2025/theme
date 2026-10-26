# 发布流程

发布不只是 `npm publish`——宿主的 `package.json` / lock 还要同步到新版本。这三步历史上全是手工、每步都踩过坑（registry 传播延迟盲等、lock 补丁 LF/CRLF 锚点静默不替换、`npm install` 撞 workspace arborist bug），已全部收进一个脚本：

```bash
cd packages/theme-core
npm run publish:sync          # = node scripts/publish-and-sync.mjs
```

## 脚本六步（任一步失败即退出码 1）

| 步 | 做什么 | 失败意味着 |
| - | ------ | ---------- |
| 1 | git 预检（工作区干净、本地/远端无同号 tag） | 版本没升或有未提交改动 |
| 2 | `npm publish` | 发布失败（输出末尾 4 行带回显） |
| 3 | 轮询 `npm view` 等 registry 传播，拿 `dist.integrity` | 超时 180s（可 `--skip-publish` 续跑） |
| 4 | 补宿主 `package.json` 的 `"skinsuite": "^x.y.z"` | 锚点不唯一 / 找不到（手改过结构） |
| 5 | 补宿主 lock 三字段（version / resolved / integrity，CRLF 安全） | 同上，补错块会比不补更糟 |
| 6 | 从根仓跑 `npm ci --dry-run --prefix <宿主>` 自证 | lock 没补对 |

常用变体：

```bash
node scripts/publish-and-sync.mjs --dry-run        # 不发布、不落盘：只预演宿主同步（4/5 步算补丁不写盘）
node scripts/publish-and-sync.mjs --skip-publish   # 发布成功但同步失败后重跑同步
node scripts/publish-and-sync.mjs --host <path>    # 换宿主仓（可绝对路径）
node scripts/publish-and-sync.mjs --allow-dirty    # 放行未提交改动（不推荐）
node scripts/publish-and-sync.mjs --publish-only   # CI 形态：只发布 + 自证，跳过宿主同步（跨仓提交留给本地）
node scripts/publish-and-sync.mjs --publish-only --tag v0.7.1  # 手动重跑（tag 优先于 GITHUB_REF）
```

> `--publish-only` 是 CI 形态：除跳过宿主同步外，也**跳过「工作区必须干净」**检查（CI 的
> `npm install` 必生成未跟踪 lock，那是产物不是漏提交）；本地完整链这条检查照旧生效。

## CI 发布（推 tag 即发）

`.github/workflows/release-npm.yml`：推 `v*` tag 即发布到 npm，`workflow_dispatch` 可填 tag 手动重跑。

- **认证走 Trusted Publishing（OIDC）**，仓库不持有长期 token；npmjs 侧一次性配置见 workflow 头部注释；
- **OIDC 前置校验**：npm ≥ 11.5.1 且 node ≥ 22.14.0——版本不足时 OIDC 静默不生效，最后以 401 收场且报错指不到真因，宁可前置红；
- 打 tag 同时自动建 GitHub Release（正文取自 CHANGELOG 对应版本段，`scripts/release-notes.mjs` 抽取；缺失响亮失败）；
- **版本源是 git tag**，`package.json` 单向跟随——不要反过来拿它的 version 推版本号。

## 发布后清单

- [ ] 库仓 `git tag v<x.y.z>` 已推（推 tag 可能极慢或零输出，用 `git ls-remote --tags origin` 核实，不信退出码）；
- [ ] GitHub Release 已建（缺失时重跑 workflow 会自动补建）；
- [ ] 宿主那两处改动（脚本会列出路径）提交推送由人决定——CI 的 `npm ci` 认 lock，不认工作区；
- [ ] `npm view skinsuite version` 核对线上版本。

## 文档站部署

`docs/` 由 VitePress 构建，push 到 main（`docs/**` 或 README 变更）时 `.github/workflows/docs-pages.yml` 自动构建并部署 GitHub Pages，地址 `https://yijiu2025.github.io/theme/`。首次启用需在仓库 Settings → Pages → Source 选「GitHub Actions」。
