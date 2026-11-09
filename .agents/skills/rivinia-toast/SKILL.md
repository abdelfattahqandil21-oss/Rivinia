---
name: rivinia-toast
description: Maintain @rivinia/toast queue, optional list UI, status-token precedence and accessible announcements.
metadata:
  role: maintainer
  package_scope: "@rivinia/toast"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/toast/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia toast maintainer skill

**Scope:** `@rivinia/toast` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/toast` exports the headless service/provider and toast types; `/ui` exports `RiviniaToastList` and its UI types.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Inspect the current queue, overflow, durations, pause/resume, action and dismissal lifecycle before changing behavior.
- Check polite/status versus assertive/error announcements and avoid announcing queued, non-visible messages prematurely.
- Recheck the known status-token precedence issue in `toast-list.css` against current docs/source; do not assume a fix or authorization from a blueprint.
- For any authorized token fix, prove standalone colors, Theme light/dark, global/scoped/instance overrides, rich-color backgrounds and sibling isolation with browser-computed styles.
- When Modal can make background content inert, route Toast through the active dialog host rather than relying on z-index; verify host ownership and cleanup.

## Package verification

- Production package build: `pnpm exec ng build toast`.
- Existing unit suite: `pnpm exec ng test toast --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
