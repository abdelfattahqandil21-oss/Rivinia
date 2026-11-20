# @rivinia/theme

[![npm version](https://img.shields.io/npm/v/@rivinia/theme.svg)](https://www.npmjs.com/package/@rivinia/theme)
[![license](https://img.shields.io/npm/l/@rivinia/theme.svg)](https://www.npmjs.com/package/@rivinia/theme)

<p align="center">
  <img src="https://raw.githubusercontent.com/abdelfattahqandil21-oss/Rivinia/theme/v2.0.0-alpha.1/assets/rivinia-abstract-mark-light.svg" alt="Rivinia" width="340" />
</p>

One semantic token contract for the whole Rivinia ecosystem: map a palette
once, and every component follows. Package version: **2.0.0-alpha.1**.

The `1.0.0` stable release follows the 1.0 release candidates; 0.x was experimental.

```css
/* your global stylesheet — that is the whole setup */
@import '@rivinia/theme';

:root {
  --rv-color-surface: #101828;
  --rv-color-text: #f4f6fa;
  --rv-color-primary: #7c9cf5;
}
```

Open a `rv-select` after that and its panel, rows, borders and focus ring use
the shared palette: components read the V2 `--rv-color-*` variables, including
the dedicated `--rv-color-focus`. The package supplies light and dark palettes;
`data-rv-theme="dark"` selects dark and `data-rv-theme="system"` opts into the
operating-system preference.
V2 semantic names are the only shared token contract; V1 names have no runtime
aliases and must be migrated.

## Why `@rivinia/theme`

- **One place, every component.** The semantic names are what select,
  menu, modal, toast and the i18n toggle read, so a rebrand is one edit.
- **Your rules win without import ordering.** The defaults live inside
  `@layer rivinia-theme`, and unlayered declarations beat layered ones — your
  `:root` mapping wins wherever it appears in the file.
- **Headless first.** Components remain usable without importing the theme;
  their component styles keep local fallbacks. Importing Theme adds the shared
  V2 defaults, which consumers can override with ordinary CSS.

## Install

```bash
npm install @rivinia/theme      # or pnpm add / yarn add / bun add
```

CSS-only consumers need no Angular peer or runtime import. Angular runtime
entry points have optional `@angular/common` and `@angular/core` peers at
`^22.1.0`; install Angular only if you use those entries. The stylesheet remains
the default package root. `sideEffects` is `["**/*.css", "**/*.scss"]`. Node
follows Angular 22 (`^22.22.3 || ^24.15.0 || >=26.0.0`), for the package
manager's engine check.

## Quick start

1. **Import it once, globally.** In your `styles.css`:
   `@import '@rivinia/theme';`. The bare specifier needs a bundler — with no
   bundler, name the file: `@import '@rivinia/theme/theme.css';`.
2. **Map your palette** on `:root`, in that same global stylesheet. Three names
   get you a branded page: `--rv-color-surface`, `--rv-color-text`, and
   `--rv-color-primary`; set `--rv-color-focus` separately when needed.
3. **Add a component and look at it.** A `rv-select` on the page now paints
   with your palette and keeps its focus ring visible in Windows High Contrast.
   Add `data-rv-theme="system"` to opt into `prefers-color-scheme`; the default
   is light.

## Two ways to use it

| Way                 | Entry                                                                  | When                                 |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| The base stylesheet | `@import '@rivinia/theme';`                                            | you set or override the semantic tokens |
| An adapter          | `@rivinia/theme/tailwind.css`, `/bootstrap.css`, `/scss`, `/theme.css` | your stack already owns the palette  |

The entries are independent files, and an adapter imports the base — pick one,
never both, or the stylesheet ships twice (measured: 3,997 B duplicated).

## Compatibility

|               | Chrome / Edge                                                    | Firefox | Safari macOS | Safari iOS |
| ------------- | ---------------------------------------------------------------- | ------- | ------------ | ---------- |
| **Supported** | 114                                                              | 125     | 17           | 18.3       |
| Angular       | CSS-only: no peer; runtime entries: `^22.1.0`                  |         |              |            |

`@layer` (99 / 97 / 15.4), `color-mix()` (111 / 113 / 16.2) and
`prefers-color-scheme` (76 / 67 / 12.1) are all above the Supported floor, so
none of them is a gap here. The second floor — CSS anchor positioning, which
makes a panel tether itself to its trigger — belongs to the popup components,
not to a stylesheet; see
[browser support](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/browser-support.md)
for both. Real
Safari has not been run, and no CI runs this matrix; the same page says what
else was never measured.

## Go further

| Topic                                                                                                          | Read                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Theming every Rivinia component — the cascade, the three levels, where an override has to live, light and dark | [docs/theme/README.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/README.md)                   |
| Semantic color, shape, spacing, and elevation tokens                                                            | [docs/theme/tokens.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/tokens.md)                   |
| Tailwind v4, Bootstrap 5.3, Sass, Less                                                                         | [docs/theme/styling-stacks.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/styling-stacks.md)   |
| What the theme restyles inside the components, and forced colours                                              | [docs/theme/component-theme.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/component-theme.md) |
| Contrast, measured pair by pair                                                                                | [docs/theme/contrast.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/contrast.md)               |
| Browser floors and what each feature is for                                                                    | [docs/browser-support.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/browser-support.md)             |
| Building and checking this package                                                                             | [docs/theme/contributing.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/docs/theme/contributing.md)       |

Release history: [CHANGELOG.md](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v2.0.0-alpha.1/projects/theme/CHANGELOG.md).
MIT licensed.

## Optional Angular runtime

The stylesheet remains the core contract and stays usable without Angular.
Angular behavior is opt-in through separate entry points; the peer dependencies
are optional for consumers who import only CSS. Runtime APIs require Angular
`^22.1.0` or later in major 22.

```ts
import { provideRiviniaTheme } from '@rivinia/theme/headless';

// Add to application providers only when using the runtime entries.
bootstrapApplication(App, {
  providers: [provideRiviniaTheme({ persist: true })], // otherwise persistence is off
});
```

`@rivinia/theme/headless` exports the signal-based
`RiviniaThemeController`, `provideRiviniaTheme`, theme mode types, and the
`RiviniaThemeToggleDirective` for native buttons. `@rivinia/theme/toggle`
exports the optional `RiviniaThemeToggleComponent` and icon-template directive.
It supports single and segmented controls, localized labels, custom icons,
variants, sizes, shapes, RTL keyboard navigation, forced colors, and reduced
motion. Its styles read the same semantic token contract as the rest of Rivinia.

The controller uses `light`, `dark`, or `system`; its default is `light`, and
system preference is opt-in with `data-rv-theme="system"`. Persistence uses
`localStorage` only when explicitly enabled. It changes only the root
`data-rv-theme` attribute and does not manage nested scopes or `dir`.

View Transitions are another opt-in: import `RiviniaThemeTransitionService`
from `@rivinia/theme/motion` and add `@rivinia/theme/motion.css` to global
styles. The service owns transition setup and cleanup; the caller owns the
update callback. Without browser support, with reduced motion, or while another
transition is active, the update runs once without animation.

For Angular workspace stylesheet setup, `ng add @rivinia/theme` registers the
existing CSS entry and creates a consumer-owned token override file. It does
not enable the Angular runtime or motion stylesheet.
