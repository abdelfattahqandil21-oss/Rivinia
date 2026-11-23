# Rivinia Theme V2 — Phase C2: complete consumer token defaults

**Date:** 2026-11-23\
**Branch:** `theme/v.2` at `62e118b`\
**SDLC:** Plan / Design accepted from C1; Build proposed here; Test pending on user's machine.

## Problem / constraints

- Phase C1 packaged `ng add` Schematic tests passed 14/14; source `tokenStyles()` currently generates only a placeholder when no colour options are passed.
- A naïve `:root { --rv-color-primary: ... }` default sheet emitted last would erase existing unlayered app overrides and would pin light values on the root in dark/system mode.
- `styles/theme.css` is the source of truth for 20 canonical light semantic/shape/space/type/elevation tokens and dark palette overrides. An Angular runtime dependency is not required.

## C2 implementation contract

1. Generated `theme.tokens.css` carries the **full, active, editable** core defaults in a new `@layer rivinia-consumer-tokens` after `@layer rivinia-theme`. The layer is stronger than the package defaults but intentionally weaker than unlayered consumer CSS/Bootstrap rules, even when the token file is appended later.
2. Mirror `:root`/light/system light, explicit dark, and OS-dark system selectors from `theme.css`. Dark includes shared shape/space/font tokens so the output is self-contained. The generated palette must initially match the package's contrast characteristics.
3. Existing explicit `--primary-color`, `--text-color`, `--surface-color`, `--border-color` options produce an **unlayered** narrowly scoped override block after the defaults. `scope=root` preserves the previous `:root` contract (and can pin the supplied colour at the root in any mode); the other three scopes target their explicit data-attribute. A single `scope` option is not a complete palette editor; all mode blocks remain consumer-editable.
4. Existing `theme.tokens.css` is never overwritten; `angular.json`, multi-app, JSONC, invalid inputs, idempotence and no framework-install rules retain C1 behavior.
5. The schematic remains the shipped `.cjs` implementation. CSS only in the generated consumer file, no new dependency or JS Theme runtime.
6. Editing values **inside the layer** works against Theme defaults and other layered styles; to beat an unlayered Bootstrap or existing app rule, add an unlayered consumer override after the layer. This is a documented cascade property, not an import-order workaround.
7. Default values are mirrored in the schematic and kept in sync with the stylesheet by unit tests; changes to `styles/theme.css` require updating the generator and coverage in the same change.

## Test / evidence gate

- C1 14 schematics regressions still pass; Theme package checker 11 tests pass.
- C2 contract tests compare every generated token with the actual `styles/theme.css` light/dark definitions.
- Computed CSS checks in Chromium/Firefox prove light/dark/system, nested scopes, pre-existing unlayered overrides, and explicit mode-scoped overrides.
- Re-run `pnpm run build:theme`, `pnpm run check:theme`, `pnpm run check:contrast`, `pnpm run check:theme-dark`, `pnpm run check:docs`, then `git diff --check`.
- Full 9-stack/overlay and SSR tests remain future gates; do not label Theme `READY` after C2.

**Do not:** commit, merge, push, publish, bump any version, or modify `specs/popup`.
