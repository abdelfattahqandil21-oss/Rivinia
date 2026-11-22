# @rivinia/i18n V2 — Approved naming and near-term SDLC plan

Status: **PHASE-1 IMPLEMENTATION PROPOSED / VALIDATION PENDING**. The naming direction and execution order were approved by the maintainer on 2026-11-22. Source baseline: branch `i18n/v.2`, HEAD `ddecf638b859d15d91e317eb4bbefd8e68257338` (read-only snapshot). Never overwrite `projects/i18n/tsconfig.lib.json` (`rootDir` modification) or the untracked `specs/` folder.

## Evidence baseline

Independent consumer tests: **211/211** across ten suites and a packed npm artifact with SHA-256 `f1fb4382c387deb1c4f57fea5e593272e4939e81616dd0d1ee144fcedcd9bf26`. This evidence describes the **pre-change artifact** and must never be presented as a post-change pass. Unit/schematics/CSR/SSR/toggle coverage is a separate gate.

## Named API contracts

Canonical V2: `translate()` (one-time string), `translateSignal()` (readonly reactive `Signal<string>`), `currentLanguage()` (id), `currentLanguageInfo()` (metadata), `activeDictionary()` (current visible dictionary), `getLanguageInfo(id)` (metadata lookup), `switchLanguage(id)` (configured strategy; returns `Promise<void>`), `Language.displayName` (explicit user-facing label), `detectBrowserLanguage`, `syncDocumentLanguage`, `loadOnInit`, and `resolveLanguageDisplayName` (UI-internal helper).

Migration: old `t()`, `currentLanguageObject`, `loadedTranslations`, `getLanguage`, `nativeName`, `detectBrowser`, `autoApplyDirection`, `preload` remain temporarily supported and annotated `@deprecated`. Canonical config wins on conflict. **No silent behavior change** to existing translations, cache, storage, race-handling, or SSR.

`switchLanguage()` is not a success flag: in `instant` it completes after issuing the switch (not network or deferred view transitions); in `preload-first` it awaits the dictionary attempt. The existing `setLanguageAsync()` remains for callers requiring a preload-first operation independent of the configuration. A richer switch-result API needs a separate design approval; do not invent a success promise.

## Four learning tiers

- Beginner: `provideRiviniaI18n` + `RvTranslatePipe`, default JSON files, two languages.
- Intermediate: typed `defineRiviniaI18n`, reactive `translateSignal`, signal parameters, cookie/local preference, `rv-language-toggle`.
- Advanced: loaders, fallback, missing-key telemetry, failure recovery, diagnostics, runtime formatting.
- Deep: typed keys + parity CI, custom loader contracts, SSR request isolation + TransferState, measured budgets and operational observability.

Each tier must be independently copyable and correct. No advanced dependency should enter a beginner's bundle merely because the README mentions it. Optional HTTP/Remote remain lazy and `@rivinia/select` stays out of core and Toggle bundles.

## Toggle gate (before Select)

Render exactly two languages; 0/1 render nothing, 3+ remain focusable but aria-disabled with one dev warning. Managed mode awaits `setLanguageAsync` and emits `languageChange` **only after confirmation**. Presentational mode emits the target intent synchronously. Honor `[disabled]`, busy UI, keyboard focus, RTL, consumer icon/template, accessible label and forced-colors. V2 changes prioritize `displayName`, use locale for the inner `lang` attribute, and guard overlapping double-click activation. Unit + headed Chromium/Firefox and SSR markup must pass. Do not import `@rivinia/select` in UI toggle.

## Ordered dependencies and freeze points

1. **i18n Core / Naming / Readme / Specs:** finish the staged naming migration and test from fresh local build and installed tarball.
2. **i18n Toggle:** complete API, ARIA, keyboard, accessibility and visual checks, including dark/light/RTL/mobile, then *stop* on i18n Language Select.
3. **@rivinia/http:** full separate Plan→Design→Build→Test gate, including Angular 22.3 HTTP `QUERY` support as a required design item (verify installed API before implementing).
4. **@rivinia/theme:** separate Plan→Design→Build→Test; CSS tokens/fallbacks and consumer styles must be stable before final Select styling.
5. **@rivinia/select:** complete core/optional UI dependency and independent consumer QA.
6. **Return to `@rivinia/i18n/select`:** integrate the approved Select API and Theme tokens; then close the complete i18n integration gate.

No automatic version bump, commit, push, merge, or publish. Unified deployment of all 11 libraries is a later, explicitly authorized SDLC phase.

## Open decisions / actual test gates

- D06: SSR HTML and browser-only stored language mismatch (local/session). Reproduce and choose policy before claiming hydration guarantee.
- New naming: type exports, consumer compilation, CLI generator and ng-add output must reflect `displayName`; older generated files must continue to work during migration.
- Package docs still contain historical 1.0 notes; align public docs with V2 while preserving historical change logs.
- Return to independent lab with a **fresh pack hash**. Re-run 211-case characterization (plus new naming/toggle cases); baseline hash alone doesn't certify the new code.
- UI test in headed Chromium + Firefox, focus and accessible-name checks; SSR request isolation, transfer and hydration; prevent regressions in `i18n/select` legacy consumers even though implementation is deferred.
- Post-build bundle size, initial gzip/Brotli and optional-chunk boundaries should be measured in a real consumer; observational benchmarks aren't a performance SLO.

Approval gates: `PLAN_DONE` → `DESIGN_LOCKED` → `BUILD_LOCAL` → `TESTED` → `READY_FOR_DEPLOY` only after user sign-off; `DEPLOY` deferred.
