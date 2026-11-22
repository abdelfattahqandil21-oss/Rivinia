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
