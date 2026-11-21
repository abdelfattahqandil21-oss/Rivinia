# `@rivinia/select` — documentation index

**Scope:** Selection, search, state, menus and accessible UI. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/select/src/` and configured UI/headless entries.
- **Unit tests:** `unit-tests/select/`.
- **Browser/integration:** `e2e/select/`, shared overlays and popup conformance.
- **Package source of truth:** [`projects/select/README.md`](../../projects/select/README.md).

## Guides

- [Api](api.md)
- [Headless](headless.md)
- [Forms](forms.md)
- [Variants](variants.md)
- [Composed Controls](composed-controls.md)
- [Recipes](recipes.md)
- [Accessibility](accessibility.md)
- [Theming](theming.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.

## Package-owned design records

- [Select ownership](../../projects/select/specifications/select-ownership.md)
- [Select variants](../../projects/select/specifications/select-variants.md)
- [Select multi-summary](../../projects/select/specifications/select-multi-summary.md)
