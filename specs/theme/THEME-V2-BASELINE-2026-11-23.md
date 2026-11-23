# `@rivinia/theme` V2 — Baseline evidence and Phase C1 test plan

**Date:** 2026-11-23\
**Baseline revision:** `62e118b156ae0c56db3138d555adbe5a29b54084` (`theme/v.2`)\
**Scope:** Plan → Design → Test-first characterization. No production changes or release permission.

## Baseline evidence (user-supplied log)

- Angular `ng build theme`: PASS, four entries (root, headless, toggle, motion); 2 `ng-packagr` conflicting export-condition warnings for `./package.json` and `.`. Do not delete `exports["."].style` as a warning suppression.
- `pnpm test:theme`: **11/11 package-checker tests**; this is not broad Theme runtime coverage.
- `check:theme`: PASS, 23 files.
- `check:contrast`: PASS both default palettes; test measured semantic tokens, not all real component states.
- `check:theme-dark`: PASS (11 Chromium + 11 Firefox cases).
- `test:theme-compat`: PASS 9 isolated builds (plain, Tailwind v4, v4 no-preflight, v4 prefix, Tailwind v3, Bootstrap+Tailwind, Bootstrap, SCSS, Less). Chromium Playwright: **69 passed, 3 intentionally skipped** (Tailwind-only assertion outside applicable stacks). Firefox was not run for this nine-stack Playwright matrix.
- `check:component-theme`: PASS 6 Chromium + 5 Firefox scenarios (no-theme, dark, OS dark, token override, RTL, plus Chromium forced-colors).
- `check:docs`: 0 failures, 57 warnings, largely outside Theme.
- Git was clean except untracked `specs/popup/` drafts, which are protected.
- Builds in compatibility matrix include full consumer dependencies; **not the isolated `@rivinia/theme` cost**.

## Design issues to close (not confirmed bugs)

1. **Package exports:** `ng-packagr` warns because two source export keys contain `default` conditions that packagr replaces. Inspect the generated `dist/theme/package.json`, separately prove CSS bundler import and JS root import, and only then choose the smallest source-manifest fix.
2. **Bootstrap dual mode:** `bootstrap.css` uses unlayered `[data-bs-theme]` tokens while root Theme uses `@layer rivinia-theme` and `[data-rv-theme]`. Define a source of truth in mixed mode and test conflicts including nested scopes.
3. **`ng add`:** existing `tokenStyles()` creates only optional four overrides or a placeholder. Product goal is complete, consumer-visible token defaults; decide output contract and preservation semantics **before** extending generator. Test shipped `.cjs` idempotence, multi-app, JSONC, validation, and conflict handling.
4. **Angular runtime:** add distinct controller/toggle/motion unit tests, CSR/SSR/hydration, persistence, keyboard, accessibility, reduced-motion, concurrency, resource cleanup.
5. **Package boundaries:** CSS-only standalone packed consumer without Angular, separate headless/toggle/motion Angular consumers; raw/gzip/Brotli for actual incremental cost.

## Phase C1 characterization tests

The new `unit-tests/theme/schematics/ng-add.spec.ts` tests the real `.cjs` schematic via `SchematicTestRunner`. It is **additive**: no source code modified. Some edge cases may expose an existing defect; if tests fail, inspect the case before deciding whether production code needs a fix. Do not change the old baseline tests merely to make green numbers.

Recommended focused command:

```bash
pnpm exec vitest run unit-tests/theme/schematics/ng-add.spec.ts
```

Then run `pnpm run test:theme` to include both package-check and new schematic cases.

## Readiness

`BASELINE_PASS`; `DESIGN_IN_PROGRESS`. **Not READY**, no version change, merge, push, or publishing. Preserve `specs/popup/`.
