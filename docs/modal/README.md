# `@rivinia/modal` — documentation index

**Scope:** Modal lifecycle, stacking and ready-made UI. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/modal/src/` and configured UI/actions entries.
- **Unit tests:** `unit-tests/modal/`, including schematic specs.
- **Browser/integration:** Shared overlay/Theme integration; browser gates require actual fixture build.
- **Package source of truth:** [`projects/modal/README.md`](../../projects/modal/README.md).

## Guides

- [Api](api.md)
- [Ready Made Ui](ready-made-ui.md)
- [Typed Modals](typed-modals.md)
- [Lifecycle And Guards](lifecycle-and-guards.md)
- [Sizing And Stacking](sizing-and-stacking.md)
- [Theming](theming.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.
