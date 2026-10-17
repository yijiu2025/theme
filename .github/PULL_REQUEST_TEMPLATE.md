# Pull Request

## 改动类型

- [ ] `feat` 新功能
- [ ] `fix` 缺陷修复
- [ ] `perf` 性能优化
- [ ] `refactor` 重构（行为不变）
- [ ] `test` 测试
- [ ] `docs` 文档
- [ ] `chore` 构建 / 工具 / 杂项
- [ ] `ci` CI 配置
- [ ] `revert` 回滚

## 关联 Issue

closes #<!-- issue 编号，无则删掉本节 -->

## 动机与背景

<!-- 解决什么问题；不写「是什么」，写「为什么」。 -->

## 主要改动

<!-- 按模块列，避免逐行复述 diff：
- src/tokens.ts：…
- test/tokens.test.mjs：…
-->

## 测试证据

本地跑过的命令与结果（CI 会重复一遍，但本地先绿是对 reviewer 的基本尊重）：

- [ ] `npm run typecheck`
- [ ] `npm test`（构建 + 产物行为测试）
- [ ] `npm run build`（改了构建配置 / 依赖时必跑）

## 自检清单

- [ ] `dependencies` 仍为空（零运行时依赖是本包卖点，破线即红）
- [ ] 无新增 DOM / 构建器 / 路由引用（`document` / `window` / `import.meta.glob` / `import.meta.env` / vue-router）
- [ ] 新增导出为显式具名导出，且已登记进 README 契约表
- [ ] 鸭子类型判据由接口派生（`Record<keyof T, …>` 再遍历），未手抄成员名
- [ ] 注释里的跨仓引用用完整 GitHub URL（外部用户没有 CoreFlow 上下文）
- [ ] 无新增 `any` 债务
- [ ] 提交信息遵循 Conventional Commits，一次提交只做一件事

## Breaking change

- [ ] 无破坏性变更
- [ ] 有破坏性变更（请在下方说明迁移路径，并在提交信息的 footer 写 `BREAKING CHANGE:` —— 这会触发 major 发版；下游家族按版本消费，需评估同步升级）

<!-- 迁移说明 -->

## 给 Reviewer 的提示

<!-- 你最没把握的点、希望重点看的部分；没有就删掉本节。 -->
