---
name: rivinia-popup
description: Maintain @rivinia/popup shared positioning and dismissal primitives without UI coupling.
metadata:
  role: maintainer
  package_scope: "@rivinia/popup"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/popup/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia popup maintainer skill

**Scope:** `@rivinia/popup` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/popup` currently exports `bindPopupDismissal`, `computePopupPosition`, constants and geometry/dismissal types; it has no UI component entry point.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Keep the core independent of UI CSS, framework-specific widgets and consumer business decisions.
- Prove outside-pointer dismissal, Escape/focus policy, touch scroll versus tap, visual viewport resize/scroll and anchor repositioning in real browsers.
- Cover clipped/offscreen anchors, RTL, nested top-layer popovers, cleanup and SSR/browser guards.
- Do not remove inline geometry or anchor-positioning `!important` rules without branch-specific browser evidence.
- Build Popup before Select/Menu and their harnesses; test dependent adapters without importing package source across boundaries.

## Package verification

- Production package build: `pnpm exec ng build popup`.
- Existing unit suite: `pnpm exec ng test popup --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
