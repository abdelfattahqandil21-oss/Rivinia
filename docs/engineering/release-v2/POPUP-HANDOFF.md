# Popup SDLC handoff

Status: **READY_FOR_DEPLOY**

Plan: shared headless positioning and dismissal for Rivinia consumers.

Design: connected API with legacy compatibility; per-document dismissal coordinator and rAF scheduling.

Build: independent translate and scale containing blocks; runtime RTL dir observer; nested Escape and native modal visibility handling.

Test: consult POPUP-QA-EVIDENCE.md; source fingerprint 9e76be0d961c9eeb58eb38b10c51e64e204968f0f785dc00fec52165f9d3709e; HEAD ca20c2b.

Deploy: deferred until all 11 libraries are signed off and unified prerelease approved.

Maintain: preserve regression tests, revalidate after dependent changes; rotation, edge collisions and device virtual keyboard remain risk items.

Current worktree:
M e2e/fixtures/overlays/src/app/pages/overlay-lifecycle.ts
 M projects/popup/src/lib/connection/auto-update.ts
 M projects/popup/src/lib/dismissal/dismissal-coordinator.ts
 M projects/popup/src/lib/platform/visibility.ts
 M projects/popup/src/lib/positioning/dom-positioning.ts
 M unit-tests/popup/connection.spec.ts
 M unit-tests/popup/geometry.spec.ts
?? e2e/popup/fixed-containing-block.spec.ts
?? e2e/popup/native-modal.spec.ts
?? specs/

## Final verification
Packed consumer and repeated teardown regression passed. Prior intermittent rAF assertion retained as maintenance debt.
