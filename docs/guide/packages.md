# 主题包 · 配色 · 版式

## 一个主题包 = 一种版式

🔴 **换版式就新建包**：`<页面>/` 下**只有** `index.vue` 与 `colors/`，没有「版式」这层目录。曾支持过的 `<页面>/<版式>/colors/` 形态已删除——换版式要复制整套配色，两套必然漂移。

```
themes/
├── default/              ← 版式 A（三端住这里）
│   ├── mobile/<页面>/…
│   └── standard/<页面>/…
└── compact/              ← 版式 B（目录名即包 id 即版式 id）
    └── mobile/<页面>/…
```

版式查找范围 = **当前包 × 当前设备**。跨包兜底回 `default` 包（内置包，eager 静态引入，首屏零请求）。

## 包定义（`themes/<包>/index.ts`）

```ts
import type { MauthThemePackage } from 'skinsuite';

const pkg: MauthThemePackage = {
  meta: {
    id: 'default',            // = 目录名（[a-z0-9-]）
    name: '默认版式',
    description: '一句话描述，便于部署方挑选',
    preview: { primary: '#1e293b', accent: '#2563eb' }  // 可选：面板色卡
  },
  views: { register: 'compact' }  // 可选：包级版式声明（页面名 → 版式 id）
};

export default pkg;
```

- `views` 声明的是「该包所有设备、所有配色共用的默认版式」。value 是**另一个包的名字**（跨包切版式）或本包名；写错 / 未登记一律回退**当前包**，不会白屏。URL `?th` 参数优先级更高（联调可单次覆盖）。
- 配色里的 `views` 只覆盖那一套配色。
- 包定义不再充当「默认配色」——黑白是实体配色目录，与 blue/cyan 平级。

### coverage（覆盖范围声明，可选）

```ts
coverage: {
  devices: ['mobile'],           // 缺省 = 全部设备
  pages: ['register'],           // 缺省 = 全部页面
  requiredColors: ['black', 'white']  // 缺省 = ['black','white']
}
```

只影响**宿主的目录口径关卡校验**，不改变运行时行为；声明范围只能 ≤ 实际目录。

## 配色定义（`colors/<配色>/index.ts`）

```ts
import type { MauthThemeColor } from 'skinsuite';

const color: MauthThemeColor = {
  meta: { id: 'white', name: '白' },   // id = 目录名
  tone: 'light',                        // 🔴 必填：'light' 白系 | 'dark' 黑系
  tokens: {
    '--mauth-bg': '#ffffff',
    '--mauth-text': '#1f2937',
    '--mauth-header-bg': 'transparent'
  },
  views: { login: 'compact' }           // 可选：单配色级版式覆盖
};

export default color;
```

### tokens 的语义

- **一组扁平值**，**不分明暗档**——每套配色自带完整底色，选谁就是谁。需要深色品牌色就**另加一个 `tone: 'dark'` 的颜色目录**（如 `navy`），不要写 `{ light, dark }` 两档。
- 名字必须 `--mauth-<短横线>`；取值过白名单（hex / rgb() / hsl() / 长度 / `var(--mauth-*)` / 关键字；**拒 `url()` 与 CSS 颜色名**）。
- 若把 `--mauth-header-bg` 设为 `transparent`，必须同时声明 `--mauth-canvas`（页面之外的画布色），否则该色由浏览器内核决定，真机与电脑不一致。

### theme.scss（可选样式表）

放 token 表达不了的东西：背景图（`url()`）、伪元素、keyframes。自动带 `html[data-mauth-theme='<id>']` 前缀作用域；构建期受信代码，不走运行期校验；惰性加载（`?inline` 动态 import，不进首屏包）。

## 配色 id 的唯一性作用域

**同包 × 同设备 × 同页面**。跨设备 / 跨包 / 跨页面**可以同名**——`mobile/login/colors/black` 与 `standard/login/colors/black` 并存是正常且必要的（两套各自独立的配色）。取一份配色时这三段必然同时给出，歧义在入口就被消解。同范围内重名按路径排序先到先得并告警，不静默覆盖。

## 解析回退链

`getThemeRecord({ id, device, pkg, page })` 的完整回退链（高 → 低）：

1. 精确四段键；
2. 同包同系别（同 tone）首套；
3. 该范围兜底色：先显式默认 `white`（`DEFAULT_THEME_COLOR`），没有才退该范围 id 字母序第一；
4. 空记录（注册表没扫到任何东西时）。

「默认」是一个**可读的显式值**（`white` / `black` 成对），不依赖字母序巧合——新增 `amber` 这类排在 black 前面的 id 不会改掉默认外观。

## 纯 JS 宿主

包定义与配色定义接受 `index.ts` / `index.js`（并存 `.ts` 优先）：定义本质是数据（meta / tone / tokens / views），`.js` 完全承载得了。无 TS 工具链的前端不必为此引入 TypeScript。
