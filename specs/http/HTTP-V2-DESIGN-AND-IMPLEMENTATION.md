# @rivinia/http V2 — phase A, transport-first contract

**Status:** Phase A and independent Phase B QA passed; **pending maintainer sign-off**. No commit, merge, push, publish, or release approval.
**Source baseline:** `575ed756947797c3b13785d85f3a11443230ecc2` (`http/v.2`).
**Related components:** Angular HttpClient, httpResource. No dependency on Rivinia i18n, theme, toast or select.

## Decisions approved for implementation discussion

| ID | Decision | Rationale |
| --- | --- | --- |
| H01 | Raw body fidelity | HTTP 200 may carry any nested business response; no auto-unwrapping/flattening |
| H02 | Native errors | Keep `HttpErrorResponse` and successful-body domain results distinguishable |
| H03 | No business normalization | `error.ar`, `error.en`, array-of-arrays remain consumer-owned |
| H04 | HTTP pipeline ownership | Angular owns providers, interceptors, backends and auth; no `httpFeatures` forwarding |
| H05 | Generic transport escape hatch | `request()` supports methods, observe modes, response types, progress and headers |
| H06 | QUERY compatibility | Use `HttpClient.request('QUERY')` at Angular 22.2; do not promise Angular 22.3 SSR transfer caching |
| H07 | Thin reactive GET | `getResource()` preserves Angular's resource/cancellation API; `parse` explicitly app-owned |
| H08 | No hidden policies | No retry, cache engine, base-url rewriting, validation, translation, global toasts |

## Breaking changes

The `unwrap`, `unwrapKey`, `envelope` options and `RiviniaHttpConfig` policy are removed from the public API. `RiviniaHttpEnvelopeError`, `RiviniaHttpUnwrapError`, `unwrapAs` and `extractKey` are removed. `provideRiviniaHttp()` no longer takes arguments and does not call `provideHttpClient()`. This is intentionally **not backwards compatible** with earlier alpha usage.

## Executed verification and evidence

The following gates ran on the user's current local V2 candidate (branch `http/v.2`, baseline HEAD `575ed75`):

- 29/29 Angular HTTP unit tests; 5/5 schematic tests; TypeScript library-contract and schematic typechecks.
- `ng build http`, `check:pack`, and `check:docs` (0 failures, 57 warnings).
- Fresh exact `2.0.0-alpha.1` tarball installed and production-built by an independent Angular consumer; the package does not require i18n or Theme.
- External Phase B CSR + SSR/hydration consumer on a real local backend: **17/17 Chromium and 17/17 Firefox**; native QUERY, PATCH/ETag, 422, HttpContext, 200 business-error body, nested arrays, and filter race assertions passed.
- Exact tarball SHA-256: `f5b2c6ab0df197467367ad5c4c154ee47bf613616f7d225dc825d4a8880813dd`.
- Bundle observation is of the entire consumer; **not** an isolated HTTP size measurement.

Full record: [HTTP V2 QA evidence](HTTP-V2-QA-EVIDENCE.md). WebKit was not tested; owner approval is still required.

### Decision history supersession

Earlier historical ADRs D007, D010, D011 and D012 describe unwrap/envelope defaults or forwarding `httpFeatures`. They remain historical evidence and **do not define the V2 contract**. H01–H08 above supersede those earlier design choices for this candidate. D015's removal of global `baseUrl` remains consistent with this V2 direction. No historical files are rewritten.

## Risks / explicit exclusions

- `QUERY` is uncommon in some proxies and requires explicit CORS method allowance. It may not be SSR transfer-cached on Angular 22.2.
- `joinUrl` is a slash-boundary helper, not a full URL resolver for fragments and query strings.
- Generics are compile-time-only; runtime validators belong to consuming projects.
- Resource `parse` is optional and can throw via native resource errors; no automatic validation is claimed.
- Built-in Angular fetch backend can differ from XHR for progress events.
- `getResponse`/`postResponse` kept as convenience aliases in Phase A; revisit only if measured API maintenance cost justifies their removal.
- Full browser/SSR + npm-packed consumer evidence is pending; no library readiness sign-off yet.
