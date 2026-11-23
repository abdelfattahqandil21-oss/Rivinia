# Rivinia library readiness

[POPUP-READINESS:START]
- @rivinia/popup: **READY_FOR_DEPLOY**; baseline ca20c2b; fingerprint 9e76be0d961c9eeb58eb38b10c51e64e204968f0f785dc00fec52165f9d3709e; [QA](release-v2/POPUP-QA-EVIDENCE.md); [handoff](release-v2/POPUP-HANDOFF.md).
[POPUP-READINESS:END]

<!-- RIVINIA-I18N-PHASE1-START -->
## i18n — V2 partial readiness (2026-11-22)

| Segment | State | Evidence / next action |
|---|---|---|
| `@rivinia/i18n` Core + naming + CLI + docs | `PHASE1_SIGNED_OFF` | 416 unit; 66 CSR E2E; fresh packed consumer |
| `@rivinia/i18n/ui` Language Toggle | `PHASE1_SIGNED_OFF` | 22 headed browser tests; 80 SSR/hydration checks across browsers |
| `@rivinia/i18n/select` | `DEFERRED` | Return after HTTP → Theme → `@rivinia/select` |
| Whole `@rivinia/i18n` | `NOT_READY_FOR_DEPLOY` | Requires deferred Select integration and final approval |
| D06 SSR with local/session preferences | `KNOWN_LIMITATION` | `docs/i18n/ssr-browser-storage.md`; no client-storage hydration guarantee |

Owner-approved partial sign-off recorded in `specs/i18n/V2-PHASE1-CLOSURE.md`.
<!-- RIVINIA-I18N-PHASE1-END -->

<!-- RIVINIA-HTTP-V2-QA:START -->
## HTTP — V2 candidate verification (2026-11-23)

| Segment | State | Evidence / next action |
| --- | --- | --- |
| `@rivinia/http` generic transport and TypeScript API | `QA_PASSED` | 29/29 unit, compile-time types; Angular build |
| `@rivinia/http` `ng add` | `QA_PASSED` | 5/5 schematics; schema TS check |
| `@rivinia/http` standalone consumer / SSR / browser | `QA_PASSED` | exact packed tarball; 17/17 Chromium, 17/17 Firefox; CSR, SSR & hydration |
| Final owner review | `READY_FOR_DEPLOY` | Owner-approved 2026-11-23; QA evidence: [HTTP-V2-QA-EVIDENCE](../../specs/http/HTTP-V2-QA-EVIDENCE.md) |
| Unified npm deployment | `NOT_AUTHORIZED` | No package publication or version bump |

Owner-approved HTTP V2 final QA sign-off. Merge/push to main authorized. Unified npm deployment remains unauthorized.
<!-- RIVINIA-HTTP-V2-QA:END -->

<!-- RIVINIA-THEME-V2-QA:START -->
## Theme V2 — owner-approved readiness (2026-11-23)

- `@rivinia/theme`: **READY_FOR_DEPLOY**
- C4–C9 QA gates passed; Angular Visual Lab validated.
- [QA evidence](release-v2/THEME-V2-QA-EVIDENCE.md)
- [SDLC handoff](release-v2/THEME-V2-HANDOFF.md)
- Optional Motion bundle optimization deferred.
- Unified npm deployment: **NOT_AUTHORIZED**.
<!-- RIVINIA-THEME-V2-QA:END -->
