# 构建插件 `skinsuite/vite`

以**编译产物**发布（`dist/vite/index.js`），类型直供源码。`vite.config.ts` 一行接入：

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { themeAssets } from 'skinsuite/vite';

export default defineConfig({
  // 目录缺省 = env VITE_THEME_DIR（含 .env.<mode>/.env.local/CLI 分层），无 env 则 src/theme
  plugins: [themeAssets(), vue()]
});
```

## `themeAssets(options?)`

| 选项 | 缺省 | 说明 |
| --- | --- | --- |
| `dir` | env `VITE_THEME_DIR` → `src/theme` | 主题**根目录**（相对 Vite root 或绝对路径）。省略时插件在 `configResolved` 用 Vite 已加载的 env 自解析——无 `process.cwd()` 陷阱 |
| `moduleId` | `'virtual:theme'` | 虚拟模块 id |
| `manifestFile` | `'theme.config.ts'` | 清单文件名；设空串则不注入清单 |

### 插件行为

1. **扫描**（构建期，Node 侧 fs）：`dir/themes/<包>/<设备>/<页面>/{index.vue, colors/<配色>/{index.ts, theme.scss}}` + `parts/<部件id>/` + `dir/views/*.ts` 声明；
2. **产出虚拟模块**：三张资产表 + `themeViews` / `themeParts` 加载表 + 清单；import 副作用自动完成全部装配（`installThemeViews` / `installThemeParts` / `installThemeRegistry` / `installThemeManifest` + 声明文件拉齐）——宿主无需 import `virtual:theme` 之外的任何声明；
3. **fail-soft**：目录不存在 → 空注册表 + 空清单（应用照常起）；写歪条目跳过，dev（serve）下 `[theme] 扫描跳过 <路径>：<原因>` 去重警告，构建期零噪音。**唯独清单写错不跳过**——`defineThemeManifest` 启动即抛；
4. **HMR**：主题目录在 root 外也会 `watcher.add`；监听 add / unlink / addDir / unlinkDir 四事件（路径归一比较 + 前缀带分隔符），失效虚拟模块 + full-reload；改已有文件内容由普通模块 HMR 自己处理。

## `virtual:theme` 的形态

```ts
declare module 'virtual:theme' {
  export const packages: Record<string, { default: MauthThemePackage }>;
  export const colors: Record<string, { default: MauthThemeColor }>;
  export const styles: Record<string, () => Promise<string>>;          // ?inline 惰性
  export const themeViews: Record<string, Record<string, Loader>>;     // 按页面分组
  export const themeParts: Record<string, Record<string, Loader>>;     // 按部件 id 分组
  export const themeManifest: ResolvedThemeManifest;                   // 恒非 null
  type Loader = () => { default: Component } | Promise<{ default: Component }>;
}
```

- 资产键相对 `themes/`（`./<包>/...` 开头）；
- 内置包（`default`）的加载器**同步返回**模块命名空间（eager 静态 import，首帧零请求）；其余包惰性 `import()` chunk；
- 类型声明随包发布，宿主 `vite-env.d.ts` 里 `import "skinsuite/vite";` 带入程序（不要用 `/// <reference types>`——解析不到子路径入口，报 TS2882）。

## 目录常量

| 导出 | 值 | 说明 |
| --- | --- | --- |
| `DEFAULT_THEME_DIR` | `'src/theme'` | 缺省主题根目录（CI 与独立克隆无 `.env` 时仍能构建） |
| `THEME_DIR_ENV_KEY` | `'VITE_THEME_DIR'` | env 键名（单一来源） |
| `THEME_PACKAGES_SUBDIR` | `'themes'` | 主题包子目录名（固定约定） |
| `THEME_VIEWS_SUBDIR` | `'views'` | 页面契约子目录名（固定约定） |
| `DEFAULT_THEME_MANIFEST` | `'theme.config.ts'` | 清单文件名 |

## 与单测共用

构建与单测两侧必须用同一份插件（否则单测的 `virtual:theme` 是空表，用例静默落默认值）。首选 vitest 的 `mergeConfig(viteConfig, …)` 继承（插件只在 vite.config 声明一次）；零参后没有可漂移的参数。
