# Theme V2 — C4 Test-first Runtime Gate (2026-11-23)

State: **NOT YET RUN**. Baseline: `theme/v.2` at `62e118b` with C1–C3 working-tree changes. No production code modified in C4.

## What these tests target

- **Headless controller:** server-safe signal behavior; post-render persisted mode restoration; OS preference changes; listener cleanup.
- **UI toggle:** native button / radiogroup semantics; single mode cycle; RTL keyboard direction; no implicit motion when `transitionOrigin` is absent.
- **Motion:** reduced-motion synchronous fallback; native View Transition update; cleanup preserving prior inline styles; API-absent fallback; overlapping requests.

These tests are an initial **component/runtime unit gate**; they do not prove real SSR/hydration or measure optional motion tree shaking. Those need a packed Angular consumer with browser / SSR evidence after this phase.

## Run

```sh
pnpm run build:theme
pnpm exec vitest run unit-tests/theme/runtime --reporter=verbose
pnpm run test:theme
pnpm exec tsc --noEmit -p projects/theme/tsconfig.lib.json
pnpm run check:theme
pnpm run check:docs
git diff --check
git status --short --branch
```

**Do not declare C4 passed until all runtime tests run on the user's actual Angular 22.2.3 checkout.** The script was only validated as a guarded, additive file generator in a separate environment without `node_modules`. If a test reveals an Angular test-harness issue, distinguish that from a real library defect before editing production code.

Historical C3: 34/34 Chromium/Firefox cascade characterization; package exports cleaned, `ng-packagr` warnings gone; consumer CSS build passed. Bootstrap Adapter mode ownership remains consumer-controlled. Do not silently alter this in C4.

Policy: no git commit/merge/push/publish/version bump; do not touch `specs/popup/`.
