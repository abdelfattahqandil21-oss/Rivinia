# @rivinia/i18n V2 — Phase 1 partial sign-off

**Owner approval:** 2026-11-22 (for current Core + Naming/CLI/Docs + Toggle scope only).  
**Branch:** `i18n/v.2`  
**Baseline HEAD:** `ddecf638b859d15d91e317eb4bbefd8e68257338` (before Phase-1 commit).  
**State:** `PARTIAL_SIGNED_OFF / FROZEN_PENDING_SELECT`.  
**NOT:** whole-package `READY_FOR_DEPLOY`, release, tag, npm publication, or approval of `/select`.

## Scope signed off

- Core public API naming V2 (`translateSignal`, `displayName`, `currentLanguageInfo`, `activeDictionary`, `getLanguageInfo`, `switchLanguage`), old aliases retained temporarily as deprecated.
- Canonical CLI / ng-add / docs examples; four usage tiers (Beginner, Intermediate, Advanced, Deep).
- Two-language Toggle including managed/presentational behavior, `lang` / `dir`, focus/keyboard, icons, busy state and consumer customization.
- Current i18n Language Select source is **frozen/deferred**; tests that incidentally exercise the old Select are regression evidence, **not** its V2 sign-off.

## Confirmed new-artifact evidence — 2026-11-22

| Gate | Result |
|---|---|
| `pnpm exec ng test i18n --watch=false` | 416/416 tests, 38 files, exit 0 |
| `pnpm exec ng build i18n` | PASS; includes core, `/ui` and unchanged `/select` build |
| `pnpm run check:docs` | PASS (0 errors, 50 warnings; warnings not silently waived) |
| CSR build + Playwright Chromium/Firefox | 66/66 PASS |
| Toggle headed Playwright Chromium/Firefox | 22/22 PASS (automated; not a substitute for human visual inspection) |
| SSR smoke Chromium | 40/40 PASS |
| SSR smoke Firefox | 40/40 PASS |
| `node scripts/check-pack.mjs i18n` | PASS |
| Fresh `npm pack ./dist/i18n` + `scripts/consumer-smoke.mjs` | PASS: production build and `@rivinia/i18n`, `/ui`; `@rivinia/select` absent |
| `git diff --check` | PASS in provided terminal output |

**Fresh tarball:** `rivinia-i18n-2.0.0-alpha.1.tgz`, SHA-256 `bfac726c8ee0bc5bfd07523eef3526d370068fadf5bc27eeccbcc65dce1fd358`. This is the **post-change** packed-consumer evidence; it must not be conflated with the older independent 211/211 baseline (SHA `f1fb4382...`). No version bump or publish occurred.

## Open items and freeze rules

- **D06 (SSR + browser-only storage):** see `docs/i18n/ssr-browser-storage.md` — known limitation, not a confirmed defect.
- **i18n Language Select:** defer implementation and full-package sign-off until `@rivinia/http` → `@rivinia/theme` → `@rivinia/select` are completed and approved; then revisit `@rivinia/i18n/select`.
- Legacy API aliases, historical notes and migration guides are intentionally retained; no silent removal under this sign-off.
- No new i18n refactor/test suites without a demonstrated issue or a new owner-approved scope.
- **Deploy and Maintain:** deployment is deferred to separate explicit approval of the unified release group. Maintain records any regression and can reopen this partial approval.

## SDLC handoff

Plan: reviewed → Design: approved Phase-1 naming/usage/toggle → Build: local implementation completed → Test: above gates passed → **Partial Sign-off: approved** → Deploy: deferred → Maintain: monitor/regression. Further `/select` work resumes only after the listed dependencies.
