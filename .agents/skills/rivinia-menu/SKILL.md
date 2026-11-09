---
name: rivinia-menu
description: Maintain @rivinia/menu action-menu semantics, focus, nesting, touch, RTL and popup integration.
metadata:
  role: maintainer
  package_scope: "@rivinia/menu"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/menu/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia menu maintainer skill

**Scope:** `@rivinia/menu` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/menu` exports the controller/service and models; `@rivinia/menu/ui` exports the rendered menu component, item directive and position helper.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Distinguish action menus from navigation links; do not impose `menu` roles on ordinary site navigation.
- Audit current item roles and states, disabled items, roving focus, Escape/Tab, pointer versus touch, nested popovers and focus restoration.
- Check outside dismissal, touch scrolling, RTL placement and viewport changes through the declared `@rivinia/popup` public dependency.
- Inspect projected content and actual view encapsulation before changing selectors or claiming consumer CSS hooks.
- Build the Popup dependency before Menu UI/browser harnesses; do not alter Select selection behavior from this skill.

## Package verification

- Production package build: `pnpm exec ng build menu`.
- Existing unit suite: `pnpm exec ng test menu --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
