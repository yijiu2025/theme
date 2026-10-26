# skinsuite

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/skinsuite)](https://www.npmjs.com/package/skinsuite)
[![CI](https://github.com/yijiu2025/theme/actions/workflows/ci.yml/badge.svg)](https://github.com/yijiu2025/theme/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-yijiu2025.github.io%2Ftheme-blue)](https://yijiu2025.github.io/theme/)
[![license](https://img.shields.io/npm/l/skinsuite)](./LICENSE)
![node](https://img.shields.io/node/v/skinsuite)

Implementation library for a multi-theme / multi-layout system: a **package × device × page × color** four-segment key, light/dark mode linked to color families, safe CSS-variable token validation, and device-scoped URL parameters. Zero runtime dependencies — works with Vue, React, plain Node, or SSR.

```bash
npm install skinsuite
```

**Highlights**

- 🎨 **A theme package = layout + colors**: a new design is a new package — no business code touched; recoloring is just another color directory
- 📱 **Device vocabulary is fully host-owned**: you define mobile / desktop / mini; the library holds zero judgment, it only receives and renders
- 🔗 **URL is state**: the `?th` / `?th_color` / `?device` families; invalid values warn in dev and never lock the page
- 🌗 **Mode ≡ tone family**: switching dark = switching to the dark-family colors with dual memory slots; picking a color never flips the mode
- 🛡️ **Whitelist validation**: token names and values both gated — `url()` and rule-breaking characters rejected; every externally supplied value passes the gate
- 🧩 **Routerless / scoped / parts**: `<ThemeScope>` / `<ThemeProvider>` / `<ThemePart>` cover popovers and floating panels

Three entry points, import what you need:

| Entry | Contents |
| --- | --- |
| `skinsuite` | Pure kernel: id whitelists, `mode` / `tone`, token validation, device-scoped params (no DOM, no framework) |
| `skinsuite/vue` | Vue bindings: `createThemeState` store, `<ThemeView>` / `<ThemeRoot>` / `<ThemeScope>` / `<ThemeProvider>` / `<ThemePart>`, debug panel |
| `skinsuite/vite` | Build plugin: `themeAssets()` scans your theme directory into the `virtual:theme` module |

## Follow the official account

| | |
| --- | --- |
| <img src=".github/assets/sponsor-official-account.jpg" width="150" alt="Official account QR"> | Release notes and technical write-ups for CoreFlow, skinsuite and other open-source projects land here first — scan to follow, never miss a new version or feature. Beyond sponsoring, **following along is the most direct support**. |

---

## Quick start (Vue + Vite)

Seven steps from zero. Full tutorials live on the [docs site](https://yijiu2025.github.io/theme/) ([getting started](./docs/guide/getting-started.md)); API references in [docs/api/](./docs/api/kernel.md); the per-file responsibilities map in [docs/advanced/structure.md](./docs/advanced/structure.md).

### 1. Register the build plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { themeAssets } from 'skinsuite/vite';

export default defineConfig({
  // Zero arguments: the theme root defaults to src/theme.
  // Override with env VITE_THEME_DIR (relative to project root).
  plugins: [themeAssets(), vue()]
});
```

The plugin scans your theme directory at build time and generates the virtual module `virtual:theme` — the single data source for the whole theme system. A missing directory degrades to an empty registry (the app still boots); malformed entries are skipped with a dev-only `[theme] 扫描跳过 …` warning.

### 2. Declare your devices (device side — no skinsuite imports)

Devices are an **independent subsystem**: the device mechanics (judgment / container wiring / assembly) belong to the host (oauth21 keeps them in its `src/device/` mechanism layer). The device list file **imports nothing from the theme library** — the only coupling point to the theme side is step 4 (projecting the three vocabulary fields):

```ts
// src/view/devices.ts — device facts (host): array order = priority, LAST entry = fallback
import type { Component } from 'vue';
import { createDeviceModule, pageContainers } from '@/device';   // your device mechanism layer
import type { HostDeviceInput } from '@/device';

export const DEVICES: readonly HostDeviceInput[] = [
  {
    id: 'mobile',
    label: 'Mobile',
    urlKey: 'mobile',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'), /^index\.vue$/)
  },
  {
    id: 'standard',
    label: 'Desktop',
    urlKey: 'std',
    containers: () => pageContainers(import.meta.glob<{ default: Component }>('/src/view/web/*/Standard*.vue'), /^Standard/)
  }
];

/** Device module instance (judgment wiring + page assembly) — consumed by your page dispatchers */
export const device = createDeviceModule({ devices: DEVICES });
```

Container location convention: the **parent directory name is the page name** (`view/app/login/index.vue` → page `login`); the web family shares one glob and distinguishes devices by file-name prefix (the above is an example — globs and naming are yours). The judgment policy (viewport / UA / what `?device=` means) lives in your device mechanism layer too — nothing to do with themes. A minimal reference implementation of the device layer itself: [docs/guide/device-layer.md](./docs/guide/device-layer.md).

### 3. Create the theme directory

```
src/theme/                      ← theme root (= VITE_THEME_DIR)
├── theme.config.ts             debug switches (see below)
├── views/                      page contracts (side-effect registration)
│   └── login.ts                defineThemePage({ page: 'login' })
└── themes/
    └── default/                ← one theme package = one layout ("view")
        ├── index.ts            package definition (meta + optional views)
        └── mobile/
            └── login/
                ├── index.vue   the layout component for this (pkg, device, page)
                └── colors/
                    ├── white/  color definition: tokens + optional theme.scss
                    │   ├── index.ts
                    │   └── theme.scss
                    └── black/
                        └── index.ts
```

Real file contents:

```ts
// themes/default/index.ts — package definition (index.js also accepted)
export default {
  meta: { id: 'default', name: 'Default' },
  // Optional: per-page default view id declared by this package's colors.
  // Usually omitted — with view ≡ package, the package id IS the view id.
  views: undefined
};
```

```ts
// themes/default/mobile/login/colors/white/index.ts — color definition
export default {
  meta: { id: 'white', name: 'White' },
  tone: 'light',                    // 'light' | 'dark' — required, drives dark-mode linking
  tokens: {
    '--mauth-canvas': '#f7f8fa',    // flat CSS variables; names must match --mauth-<kebab>
    '--mauth-text': '#1f2329',
    '--mauth-primary': '#2e6ef7',
    '--mauth-radius': '8px'
  }
  // views: { login: 'compact' }    // optional per-color view override
};
```

```scss
/* themes/default/mobile/login/colors/white/theme.scss — optional stylesheet.
   Use for anything tokens cannot express: url() assets, pseudo-elements,
   keyframes. Scoped automatically via html[data-mauth-theme='white']. */
```

```ts
// views/login.ts — page contract (registers the page; no logic allowed here)
import { defineThemePage } from 'skinsuite/vue';

defineThemePage({ page: 'login' });
```

```ts
// theme.config.ts — theme-domain manifest (debug switches)
import { defineThemeManifest } from 'skinsuite';

export default defineThemeManifest({
  // 'off' | 'url' | 'always'; with 'url' the panel appears only when the
  // query below matches (default gate) — customize query/value as you like.
  debug: { enabled: 'url', query: 'debug', value: 'theme' }
});
```

Uniqueness scope of a color id is **package × device × page** — `white` may exist in every scope. Both `index.ts` and `index.js` are accepted for definitions (`.ts` wins when both exist), so JS-only hosts need no TypeScript toolchain.

### 4. Assemble the store

```ts
// src/stores/theme.ts — theme side
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import type { DeviceVocab } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import 'virtual:theme';   // side effect: installs registry + views + manifest

// The single coupling point from device side to theme side: project only the
// three vocabulary fields (id / label / urlKey) — containers and other device
// facts never enter the theme
const deviceVocab: DeviceVocab[] = DEVICES.map(({ id, label, urlKey }) => ({ id, label, urlKey }));

export const useThemeStore = defineStore('theme', () =>
  createThemeState({
    devices: deviceVocab      // vocabulary injection; the library holds no device registry
    // storageKeys, colorParam, viewParam, defaultPage, remoteParams — see options below
  })
);
```

```ts
// src/bootstrap.ts (router apps)
import { theme } from 'skinsuite/vue';
app.use(theme, { router });   // router is optional in 0.9+ (no-router apps)
```

### 5. Mount ThemeRoot at the app level (the provide point)

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { ThemeRoot, ThemeDebugPanel } from 'skinsuite/vue';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <!-- 🔴 :themeStore is required: ThemeRoot is the provide point — ThemeView and
       the debug panel take the store via inject and throw without it. The library
       never imports your Pinia store (zero pinia dependency); it only requires the
       ThemeStoreLike shape, so any object with compatible fields works. -->
  <ThemeRoot :themeStore="themeStore">
    <router-view />
  </ThemeRoot>
  <ThemeDebugPanel />
</template>
```

### 6. Render a page

```vue
<!-- src/view/app/login/index.vue — the device container (your code, your logic) -->
<script setup lang="ts">
import { ThemeView } from 'skinsuite/vue';
const ctx = { /* anything your layouts need */ };
</script>

<template>
  <!-- The container owns business logic; the layout component owns presentation. -->
  <ThemeView page="login" device="mobile" :ctx="ctx" />
</template>
```

`ThemeView` resolves the layout for `(active package, device, page)` — falls back across the registry's chain — loads the builtin package eagerly (zero-request first paint) and non-builtin packages lazily, then injects the color's tokens plus `.dark` class and `data-mauth-theme` attribute onto the scope.

### 7. Pick the device per page (dispatcher)

The library never decides "which device is this" — viewport thresholds, UA, `?device=` locks are **host policy**. The dispatcher picks containers from the device-side list (no theme involvement):

```ts
// src/view/web/login/index.vue (route component)
import { computed, defineAsyncComponent } from 'vue';
import { DEVICES } from '@/view/devices';
import { useRenderDevice } from '@/composables/useRenderDevice';   // judgment from your device mechanism

const device = useRenderDevice();   // e.g. viewport + ?device= + iframe-source rules → device id
const deviceComponents = new Map(
  DEVICES.map(d => [d.id, defineAsyncComponent(d.containers().get('login')!)])
);
const activeComponent = computed(
  () => deviceComponents.get(device.value)
    ?? deviceComponents.get(DEVICES[DEVICES.length - 1]!.id)!
);
```

Device identity reaches the theme store **only** through `<ThemeView device="…">` props. Judgment lives in the host, the library only reads and renders.

---

## URL parameters

Format is unified with underscores; device-specific keys win over generic keys; an empty value means "not specified" (never overrides the generic key).

| Param | Meaning | Chain |
| --- | --- | --- |
| `?th=<pkg>` | view (package) intent, all devices | `th_<urlKey>` → `th` → package default |
| `?th_mobile=<pkg>` | view intent for one device | same chain, per device |
| `?th_color=<id>` | color intent, all devices | `th_color_<urlKey>` → `th_color` → stored preference → scope default |
| `?th_color_std=<id>` | color intent for one device | same chain, per device |
| `?device=<id>` | device lock (host dispatcher vocabulary) | locked to that device; unknown id falls back to the last device |

Examples: `/login?th=compact`, `/login?th_mobile=default&th_std=compact` (each device its own package), `/login?th_color=blue`. Invalid values never lock anything — they are dropped with a dev warning and fall back down the chain.

Mode (light/dark) has **no** URL entry by design — it is a user preference, persisted in localStorage (`mauth:mode` / `mauth:theme`; legacy bare keys from 0.7.x are read-migrated once).

## Modes and tones

- `mode` = user intent: `'system' | 'light' | 'dark'` (`MODE_CYCLE` is the toggle order)
- `tone` = a property **each color declares**: `'light' | 'dark'`
- Switching dark = "switch to the dark-family color"; switching back restores your previous light-family color (dual memory slots). Picking a color never flips the mode — the two dimensions are orthogonal and linked one-way.

## Options & advanced usage

```ts
createThemeState({
  devices,                                  // required for device-scoped params/panel
  storageKeys: { mode: 'my:mode', theme: 'my:theme' },  // avoid same-origin collisions
  colorParam: 'brand',                      // → ?brand=<id> / ?brand_<urlKey>=<id>
  viewParam: 'layout',                      // → ?layout=<pkg> / ?layout_<urlKey>=<pkg>
  defaultPage: 'app',                       // no-router seeding: tokens resolve from first frame
  remoteParams: () => ({ client_id: '…' })  // identity params for the remote theme fetch (your keys); pairs with VITE_THEME_ENDPOINT
})
```

- **No-router apps**: `app.use(theme)` without router; wrap shells in `<ThemeScope page device>` (token-only anchoring, renders just a slot); seed `defaultPage` so tokens resolve before any view mounts.
- **Pinned-scope theming** (a popover that must keep its own colors): `<ThemeProvider page device :pkg :color-id>` — resolves via pure queries, never touches the global store.
- **Themeable widgets** (the modal/notification component itself): `<ThemePart id="confirm-modal" :ctx />` — renders the part implementation from `themes/<pkg>/<device>/parts/<id>/index.vue`; one layout per package, same law as pages.
- **Debug panel**: append `?debug=theme` in dev — inspect store state, switch colors/views, see URL-effect warnings (the trigger key is customizable via `debug.query` in `theme.config.ts`).
- **iframe embedding (parent controls the theme)**: the parent simply adds URL params to the iframe src (`?th_color=blue`, `?th=<pkg>`) — applied at first paint, locks the device, and outranks both backend config and stored preference. Runtime follow-mode uses the `THEME_CHANGE` postMessage: set `VITE_ALLOWED_PARENT_ORIGINS` (comma-separated parent-origin allowlist containing only apps that embed this page; empty = sync disabled).
- **Backend theme by identity**: set `VITE_THEME_ENDPOINT` (non-empty enables it). The request is `GET {endpoint}?{params from remoteParams}` — identity keys are yours (`remoteParams: () => ({ client_id: … })` / `{ user_id }` / `{ app }`; the library reads no URL and presumes no key names). The response is `{ theme?, mode?, tokens? }` (`theme` must be a registered color id; `tokens` pass the whitelist per entry). Timeout (default 3s) and every failure fall back silently to local colors. Priority: URL params > backend config > stored preference.
- **Kernel-only (React / Node / SSR)**: `sanitizeOverrides(payload)` for any externally-supplied CSS variables; `readDeviceParam(query, name, deviceKey)` for the device-scoped chain; `THEME_ID_RE` / defaults for validation. No DOM required.

## What is deliberately not in the package

| Not here | Provided by |
| --- | --- |
| `import.meta.glob` / bundler specifics | `skinsuite/vite` (other bundlers write their own adapter) |
| DOM / localStorage / router | Host, or `skinsuite/vue` defaults (overridable keys) |
| Device inventory | Your list + `createThemeState({ devices })` injection |
| Business assets (`themes/**`) | Your app |

## Security boundary

CSS custom properties directly alter rendering. Unvalidated `setProperty` hands outsiders two capabilities: **outbound requests** (`url()` probes / tracking) and **style injection** (rule-closing payloads). Hence whitelist-only validation: names must be `--mauth-<kebab>`; values allow `#hex` / `rgb()` / `hsl()` / lengths / `var(--mauth-*)`; color keywords, `url()`, and rule-breaking characters are rejected per-entry (`sanitizeOverrides` returns `{ tokens, rejected }` — one bad value never discards the rest). The rule of thumb: **if it needs `url()`, pseudo-elements, or keyframes, it belongs in `theme.scss`, not tokens.**

## Singleton semantics (micro-frontends)

`installThemeRegistry` / `installThemeManifest` / `installThemeViews` are module-level singletons; token injection writes to `document.documentElement`. Contract: **one JS realm + one document = one theme domain.** SPAs, iframes, and per-request SSR renders are independent. Micro-frontends sharing one module instance will overwrite each other (last registration wins, tokens cleared cross-app) — isolate modules per sub-app, or use the pure kernel and manage injection yourself. Same-origin apps share the `th` / `th_color` param namespace and localStorage keys — disambiguate via `storageKeys` / `colorParam` / `viewParam`.

---

## Development

```bash
npm run typecheck   # tsc + vue-tsc
npm run build       # tsc → dist/
npm test            # build + node:test (kernel .mjs + compiled vue tests)
```

Relative imports inside `src/` **must carry `.js` suffixes** (NodeNext compilation preserves specifiers). Exports are dual-track: `types` points at `src/` (source-of-truth typing), `import` points at `dist/` for `.` and `./vite`; `./vue` ships as source (tsc cannot compile SFCs).

During 0.x, minor versions may rename exports (explicit named exports make renames semver-minor).

## Community & support

| I want to… | Go to |
| --- | --- |
| Learn / look up APIs | [Documentation site](https://yijiu2025.github.io/theme/) (guide / api / advanced) |
| See the roadmap / version policy / FAQ | [Wiki](https://github.com/yijiu2025/theme/wiki) |
| Ask how to use it | [Discussions · Q&A](https://github.com/yijiu2025/theme/discussions/categories/q-a) |
| Propose a feature | [Discussions · Ideas](https://github.com/yijiu2025/theme/discussions/categories/ideas) (becomes an issue once agreed) |
| Report a bug | [Issue · bug report](https://github.com/yijiu2025/theme/issues/new?template=bug_report.yml) (with a minimal reproduction) |
| Report a security issue | [Private advisory](https://github.com/yijiu2025/theme/security/advisories/new) (never a public issue) |
| Contribute | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Where to ask what | [SUPPORT.md](./SUPPORT.md) |

Contributions of every kind are welcome: bug reports, docs, code. Read the "red lines" section of CONTRIBUTING first — each one was learned the hard way.

## Sponsor

If skinsuite has helped you, coffee is appreciated:

| WeChat pay (scan to transfer) | Alipay |
| --- | --- |
| <img src=".github/assets/sponsor-wechat.png" width="180" alt="WeChat QR"> | <img src=".github/assets/sponsor-alipay.png" width="180" alt="Alipay QR"> |

Every contribution goes a long way.

**About the official account (柒染靓月)**: the author's WeChat channel — release notes and technical write-ups for CoreFlow, skinsuite and other open-source projects land there first. Beyond sponsoring, **following along is the simplest way to support**: never miss a new version or feature.

## Related Projects

| Project | What it is |
| --- | --- |
| [CoreFlow](https://github.com/yijiu2025/CoreFlow) | Full-stack Node.js backend — the account & authorization service |
| [oauth-web](https://github.com/yijiu2025/oauth-web) | Enterprise identity frontend (OAuth 2.1 login / authorization), one of skinsuite's hosts |
| [RetroWeb](https://github.com/yijiu2025/retroweb) | Retrosynthesis workbench frontend (same stack, SSO-embedded) |
| [retro](https://github.com/yijiu2025/retro) | Retrosynthesis backend (Python + rdchiral / RDKit) |
| [wb-logkit](https://github.com/yijiu2025/log) | Zero-dependency logging library |

## License

[MIT](./LICENSE) © 2026 qirly
