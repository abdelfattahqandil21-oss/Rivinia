---
name: rivinia-select
description: Maintain @rivinia/select controller/UI contracts, selection behavior, forms, keyboard and popup integration.
metadata:
  role: maintainer
  package_scope: "@rivinia/select"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/select/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia select maintainer skill

**Scope:** `@rivinia/select` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/select` exports the headless controller/provider and types; `@rivinia/select/ui` exports the Select component, its current UI types and position helper aliases.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Preserve open/query/focus/active-row/scroll state after a pick, especially for multi-select; derive expected state from current contract and regression tests.
- Test single and multi modes, required/clear/tags, groups, disabled options, controlled values, filtering, no-results and out-of-order async data.
- Verify actual Angular Forms integration through the current `@angular/forms` peer and public component contract; do not invent custom-trigger/template exports.
- Check listbox ARIA, keyboard navigation, Arabic/RTL, touch scroll, viewport positioning and scoped CSS variables under supported stacks.
- Keep Popup as a package dependency via its public export; measure eager versus optional UI bundle effects before adding entry points.

## Package verification

- Production package build: `pnpm exec ng build select`.
- Existing unit suite: `pnpm exec ng test select --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
