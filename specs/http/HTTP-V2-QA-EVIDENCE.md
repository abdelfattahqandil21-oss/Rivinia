# @rivinia/http V2 — QA evidence (2026-11-23)

**Status:** `QA_PASSED_PENDING_OWNER_SIGNOFF`. No merge, commit, push, version change or npm publication authorized by this record.

- Branch: `http/v.2`; baseline HEAD: `575ed756947797c3b13785d85f3a11443230ecc2` (uncommitted Phase A working tree).
- Candidate package: `@rivinia/http@2.0.0-alpha.1`.
- Exact tarball SHA-256: `f5b2c6ab0df197467367ad5c4c154ee47bf613616f7d225dc825d4a8880813dd`.
- External lab: `~/rivinia-http-v2-labs/phase-b-20261123-100159/lab`; test evidence under `evidence/`; the external fixture was repaired for its own Angular SSR build issues without changing the HTTP production implementation.

## Verification matrix

| Gate | Result | Evidence from local console logs |
| --- | --- | --- |
| Angular unit (`pnpm exec ng test http --watch=false`) | **29/29 PASS** | 3 test files |
| Schematics (`pnpm exec vitest run unit-tests/http/schematics/ng-add/index.spec.ts`) | **5/5 PASS** | `ng add`, no duplicate providers, idempotence, legacy options rejected |
| TypeScript contracts | **PASS** | `tsc --noEmit -p projects/http/tsconfig.spec.json` |
| Schematics TypeScript | **PASS** | `tsc --noEmit -p projects/http/schematics/tsconfig.schematics.json` |
| Package build (`ng build http`) | **PASS** | Angular partial compilation and declaration output |
| Documentation check | **PASS, 0 failures** | 57 nonblocking warnings, some historical/prose |
| Package structure (`check-pack.mjs http`) | **PASS** | 10 files |
| Tarball consumer | **PASS** | exact packed install, production build, public `@rivinia/http` import; `@rivinia/i18n` and `@rivinia/theme` absent |
| Real browser Chromium | **17/17 PASS** | external packed-consumer lab, real local HTTP backend |
| Real browser Firefox | **17/17 PASS** | same backed consumer and backend |
| CSR + SSR/hydration | **PASS** | initial GET rendered, TransferState serialized, hydration reused request, no browser exceptions |
| Behavioral requests | **PASS** | 200 multilingual nested error unchanged; nested arrays; real QUERY + body + repeated params; PATCH status/ETag; native 422; HttpContext; latest filter wins |

## Bundle observation (not isolated library size)

Production consumer entry JavaScript: **266,383 bytes raw**, **83,592 bytes Gzip**, **73,624 bytes Brotli**. This is the consumer's JS bundle (includes Angular), **not** the incremental size of `@rivinia/http`; no no-library delta has been measured.

## Public API compatibility audit

- `public-api.ts` intentionally removes `RiviniaHttpConfig`, `RiviniaEnvelopePolicy`, `RiviniaHttpEnvelopeError`, `RiviniaHttpUnwrapError`, `unwrapAs`, `extractKey`, and unwrap-specific option exports.
- The application owns `provideHttpClient(...)`; `provideRiviniaHttp()` registers only the facade.
- Final `git grep` output found legacy names in historical archived decisions, migration prose and negative type/schematic tests; no production use was shown in scanned `projects`, `docs`, `unit-tests`, `e2e`, `scripts`.
- Original `rivinia-http.spec.ts` had 39 tests, the new version has 25 tests for redesigned behavior; counts are not directly comparable. Old envelope/unwrap behaviors were intentionally removed. No claim of perfect line-for-line coverage parity.

## Boundaries and open items

- `QUERY` uses Angular `HttpClient.request('QUERY', ...)` for the current Angular version. No claim about Angular 22.3-specific SSR QUERY transfer-cache semantics.
- HTTP `QUERY` support depends on server, proxy and CORS configuration.
- WebKit/Safari was **not run** in this phase; don't claim it passed.
- Framework-native `HttpErrorResponse` and application-owned business interpretation remain distinct.
- Build and tests are observed on the baseline candidate, not an npm release. Unified publication across all Rivinia packages requires separate explicit authorization.
- Await maintainer **owner sign-off**, then separately authorize any commit, merge to `main`, or push. No version bump/publish here.

## Final owner sign-off — 2026-11-23

- Status: `READY_FOR_DEPLOY`
- Owner approved HTTP V2 engineering sign-off.
- Unit: 29/29; schematics: 5/5.
- Browser/SSR: 17/17 Chromium, 17/17 Firefox.
- Typecheck, Angular build, docs and packed consumer passed.
- Merge and push to main authorized.
- npm publication and unified release remain deferred.
