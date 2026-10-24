# skinsuite

[English](./README.md) | [简体中文](./README.zh-CN.md)

Implementation library for a multi-theme / multi-layout system: a **package × device × page × color** four-segment key, light/dark mode linked to color families, safe CSS-variable token validation, and device-scoped URL parameters. Zero runtime dependencies — works with Vue, React, plain Node, or SSR.

```bash
npm install skinsuite
```

Three entry points, import what you need:

| Entry | Contents |
| --- | --- |
| `skinsuite` | Pure kernel: id whitelists, `mode` / `tone`, token validation, device-scoped params (no DOM, no framework) |
| `skinsuite/vue` | Vue bindings: `createThemeState` store, `<ThemeView>` / `<ThemeRoot>` / `<ThemeScope>` / `<ThemeProvider>` / `<ThemePart>`, debug panel |
| `skinsuite/vite` | Build plugin: `themeAssets()` scans your theme directory into the `virtual:theme` module |

---

## Quick start (Vue + Vite)

Six steps from zero. A complete working sample lives in [docs/onboarding.md](./docs/onboarding.md); every public API's call chain is documented in [docs/usage-and-flows.md](./docs/usage-and-flows.md); the per-file responsibilities map lives in [docs/structure.md](./docs/structure.md).

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

### 2. Declare your devices

Devices are **your** vocabulary (`mobile` / `standard` / `mini` / `tablet` …) — the library never hardcodes device names. One list serves both the store (vocabulary) and your page dispatchers (container wiring):

```ts
// src/view/devices.ts — array order = priority, LAST entry = fallback device
import type { Component } from 'vue';
import { THEME_ID_RE } from 'skinsuite';
import { pageContainers } from 'skinsuite/vue';
import type { DeviceContainerLoader } from 'skinsuite/vue';

export interface HostDeviceDef {
  id: string;        // = directory name inside each theme package
  label: string;     // shown in the debug panel
  urlKey: string;    // URL param suffix: ?th_<urlKey> / ?th_color_<urlKey>
  containers: ReadonlyMap<string, DeviceContainerLoader>;  // page → component
}

export const DEVICES: readonly HostDeviceDef[] = [
  {
    id: 'mobile',
    label: 'Mobile',
    urlKey: 'mobile',
    containers: pageContainers(
      import.meta.glob<{ default: Component }>('/src/view/app/*/index.vue'),
      /^index\.vue$/,
      THEME_ID_RE
    )
  },
  {
    id: 'standard',
    label: 'Desktop',
    urlKey: 'std',
    containers: pageContainers(
      import.meta.glob<{ default: Component }>('/src/view/web/*/Standard*.vue'),
      /^Standard/,
      THEME_ID_RE
    )
  }
];

export const deviceIds = (): string[] => DEVICES.map(d => d.id);
export const fallbackDevice = (): string => DEVICES[DEVICES.length - 1]?.id ?? '';
```

Container location convention: the **parent directory name is the page name** (`view/app/login/index.vue` → page `login`).

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
// src/stores/theme.ts
import { defineStore } from 'pinia';
import { createThemeState } from 'skinsuite/vue';
import { DEVICES } from '@/view/devices';
import 'virtual:theme';   // side effect: installs registry + views + manifest

export const useThemeStore = defineStore('theme', () =>
  createThemeState({
    devices: DEVICES          // vocabulary injection; the library holds no device registry
    // storageKeys, colorParam, viewParam, defaultPage — see options below
  })
);
```

```ts
// src/bootstrap.ts (router apps)
import { theme } from 'skinsuite/vue';
app.use(theme, { router });   // router is optional in 0.9+ (no-router apps)
```

### 5. Render a page

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

### 6. Pick the device per page (dispatcher)

The library never decides "which device is this" — viewport thresholds, UA, `?device=` locks are **host policy**. Typical dispatcher:

```ts
// src/view/web/login/index.vue (route component)
import { useRenderDevice } from '@/composables/useRenderDevice';   // your judgment
import { deviceIds, fallbackDevice, resolveContainerOf } from '@/view/devices';

const device = useRenderDevice();   // e.g. viewport + ?device= + iframe-source rules → device id
const deviceComponents = new Map(
  deviceIds().map(id => [id, defineAsyncComponent(resolveContainerOf(id, 'login'))])
);
const activeComponent = computed(
  () => deviceComponents.get(device.value) ?? deviceComponents.get(fallbackDevice())!
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
  defaultPage: 'app'                        // no-router seeding: tokens resolve from first frame
})
```

- **No-router apps**: `app.use(theme)` without router; wrap shells in `<ThemeScope page device>` (token-only anchoring, renders just a slot); seed `defaultPage` so tokens resolve before any view mounts.
- **Pinned-scope theming** (a popover that must keep its own colors): `<ThemeProvider page device :pkg :color-id>` — resolves via pure queries, never touches the global store.
- **Themeable widgets** (the modal/notification component itself): `<ThemePart id="confirm-modal" :ctx />` — renders the part implementation from `themes/<pkg>/<device>/parts/<id>/index.vue`; one layout per package, same law as pages.
- **Debug panel**: append `?debug=theme` in dev — inspect store state, switch colors/views, see URL-effect warnings.
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

## License

[MIT](./LICENSE) © 2026 qirly
