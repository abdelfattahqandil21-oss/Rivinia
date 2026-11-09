---
name: rivinia-table
description: Maintain @rivinia/table headless data contracts, pipeline, selection, spans and ready-made UI.
metadata:
  role: maintainer
  package_scope: "@rivinia/table"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/table/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia table maintainer skill

**Scope:** `@rivinia/table` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/table` exports models, sorting/filtering/pagination helpers and the headless controller; `/ui` exports the table component and cell-template directive.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Distinguish semantic static tables from interactive grids; choose ARIA roles and keyboard model from the actual UI behavior.
- Test stable/duplicate row IDs, controlled and uncontrolled sort/filter/selection, server/client paging, empty/loading/error and span validation.
- Explore resizing, row expansion, column visibility, virtualization and sticky headers as proposals unless current exports/tests prove them.
- Keep horizontal overflow within the table viewport and verify RTL, zoom, screen-reader headers and large-data performance.
- Measure core-only versus `/ui` consumer output; keep optional Select or other UI adapters out of the headless entry point.

## Package verification

- Production package build: `pnpm exec ng build table`.
- Existing unit suite: `pnpm exec ng test table --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
