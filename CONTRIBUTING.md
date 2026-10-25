# 贡献指南

感谢你愿意为 skinsuite 出力。这份指南帮你少踩坑：这个包是干嘛的、哪些红线不能碰、提交与 PR 该走什么流程。**动手前花五分钟读完，尤其是「代码红线」一节**——这里的每一条都是实战踩出来的。

## 这个仓库是什么

多主题 / 多版式机制的**纯内核**（npm 包名 `skinsuite`，仓库名 theme）：目录名与默认值的白名单常量、主题包契约类型、明暗 mode 与色系 tone、CSS 变量 token 的安全校验、设备维度 URL 参数读取。

- 技术栈：纯 TypeScript（NodeNext 双形态产物 ESM + d.ts），**零运行时依赖**，`engines: node >= 18`
- 协议：[MIT](LICENSE)
- 消费者：CoreFlow 主仓的前端家族（oauth-web / retroweb / firewall / admin / posecraft）以 monorepo 源码直供或 npm 发布版两种形态使用；独立仓用户走 npm

### 一条原则

本包**不碰 DOM / 构建器 / 路由**：这是它能被任意前端（Vue / React / Node / SSR）复用的前提。构建器耦合（`import.meta.glob` / `import.meta.env`）由宿主适配器提供，业务资产（`themes/**` 的版式与配色实现）随应用走。设计契约见 [README.md](README.md)。

## 一、上手

前置依赖：Node.js 18+（建议 20+）、npm 9+。

```bash
git clone https://github.com/yijiu2025/theme.git
cd theme
npm install
npm run typecheck   # tsc 全量类型闸门
npm test            # 先构建，再针对 dist 产物跑 node --test 行为测试
```

## 二、常用命令

| 命令                | 作用                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `npm run typecheck` | `tsc -p tsconfig.json` 全量类型检查（含测试文件）                  |
| `npm run build`     | `tsc -p tsconfig.build.json` 产出 `dist/`（ESM + d.ts，NodeNext）  |
| `npm test`          | 构建 + `node --test`，针对**产物**跑行为测试                      |
| `npm run prepack`   | 发布前自动构建（`npm publish` 时触发）                            |

> 行为测试针对 `dist/` 而非 `src/` 是刻意的：这同时验证 NodeNext 的相对说明符写法没被改坏——源码直供（monorepo 形态）与 npm 版两条消费路径都不会踩到产物 bug。

## 三、代码红线

- 🔴 **零运行时依赖**：`dependencies` 必须为空。需要工具函数就自己写，这个包的卖点就是没有任何传递依赖
- 🔴 **不碰 DOM / 构建器 / 路由**：新增 `document` / `window` / `import.meta.glob` / `import.meta.env` / vue-router 引用即越界
- 🔴 **显式具名导出**：公开 API 面以 README 的表为准，`export *` 会破坏 tree-shaking 与契约稳定性
- 🔴 **鸭子类型判据必须由接口派生**（如 `Record<keyof T, …>` 再遍历）：手抄成员名会让判据静默落后于类型
- 🔴 **改包源码必须同步发版**：CI 验的是 npm 发布版，下游家族按版本消费；发版权重逢根仓 `docs/standards/git-release-rules.md`
- 注释里的跨仓引用用完整 GitHub URL（外部用户没有 CoreFlow 上下文）

## 四、提交与 PR

遵循 Conventional Commits（`<type>(<scope>): <subject>`），一个提交只做一件事：

| 类型       | 示例                                    |
| ---------- | --------------------------------------- |
| `feat`     | `feat(tokens): 新增 tone 色系校验`      |
| `fix`      | `fix(device): 修复 mini 参数空串判定`   |
| `refactor` | `refactor(index): 收拢导出到文件末尾`   |
| `docs`     | `docs: 修正 README 契约表`              |
| `test`     | `test: 补 token 白名单边界用例`         |
| `ci`       | `ci: CI 对齐家族规范骨架`               |
| `chore`    | `chore: 升级 typescript`                |

流程：从 `main` 切短支线（`feat/*` / `fix/*` / `chore/*` …）→ 小步提交 → 推送开 PR → CI 绿 → 合并（merge commit 保留拓扑）→ 删支线。**禁止直推 `main`**（受分支保护）。

PR 标题同样要符合 Conventional Commits——squash 合并时它会成为 main 上的提交信息。

## 五、发版

版本源是 git tag（`vX.Y.Z`，annotated），`package.json` 的 `version` 单向跟随。判据（按推送包含的提交类型）：

| 提交类型                                          | 版本递增 |
| ------------------------------------------------- | -------- |
| 破坏性变更（`!:` 或 footer `BREAKING CHANGE:`）    | major    |
| 含 `feat`                                         | minor    |
| 仅 `fix` / `perf`                                 | patch    |
| 仅 `docs` / `test` / `chore` / `ci` / `refactor`  | 不发     |

细则（含敏感词自查）见根仓 [git-release-rules.md](https://github.com/yijiu2025/CoreFlow/blob/main/docs/standards/git-release-rules.md)。

## 六、报告问题与社区讨论

### 去哪说（分流表）

| 情况 | 去处 |
| --- | --- |
| 疑似缺陷，有可复现代码 | [Issue · 缺陷报告](https://github.com/yijiu2025/theme/issues/new?template=bug_report.yml) |
| 功能建议 / 新能力想法 | **先**开 [Discussion · 想法](https://github.com/yijiu2025/theme/discussions/categories/想法)——讨论清楚要不要、什么形态，再转成 issue 排期 |
| 使用方法提问（接入 / 设计为什么这样） | [Discussion · Q&A](https://github.com/yijiu2025/theme/discussions/categories/q-a) |
| 已上线功能的公告与变更 | 维护者发 [Discussion · 公告](https://github.com/yijiu2025/theme/discussions/categories/公告) |
| 安全漏洞 | **勿开公开 issue / 讨论**，走私密报告，见 [SECURITY.md](SECURITY.md) |
| 下游应用的具体表现 | 到对应应用仓（如 [CoreFlow](https://github.com/yijiu2025/CoreFlow/issues)），这里只管库本身 |

一句话判据：**Issue = 维护者要做的事**（修 bug、做功能）；**Discussion = 大家在聊的事**（提问、想法、公告）。拿不准就先开 Discussion。

### 好 bug 报告的三要素

issue 模板已经把这些做成必填项，开之前自己先过一遍：

1. **现象与期望**：发生了什么、期望是什么——分开写，不要只说「不对」；
2. **最小复现**：npm 版给 `import` 语句 + 调用行（带实际输出注释）；源码直供给文件路径 + 片段。能三行复现的不要贴三十行；
3. **环境**：`skinsuite` 版本（npm 版 / 源码直供）、消费形态、Node 版本——两种消费路径的排查方向不同，模板会问。

### 标签语义

| 标签 | 含义 |
| --- | --- |
| `bug` | 可复现缺陷（带复现代码才打） |
| `enhancement` | 已确认要做的新能力（从 Discussion 转来的提案带 `from:discussion`） |
| `docs` | 文档问题 |
| `question` | 补充信息后才能分流的 issue（分流后改打 bug / 关闭转 Discussion） |

### 维护者口径

- 无响应时限承诺，尽量一周内首次回复；带最小复现的 `bug` 优先；
- 缺信息（无复现 / 无版本）的 issue 打 `question` 并指出缺什么，**两周无补充**礼貌关闭（欢迎补充后重开）；
- Discussion 的 `Q&A` 被采纳的答案点「Mark as answer」，沉淀成可检索的知识库。

社区行为准则见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。更多背景（路线图 / 版本政策 / 本规范的 wiki 版）见 [Wiki](https://github.com/yijiu2025/theme/wiki)。
