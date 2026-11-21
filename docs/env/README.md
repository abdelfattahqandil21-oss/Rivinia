# `@rivinia/env` — documentation index

**Scope:** Environment inspection and explicit schematic workflows. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/env/src/` contracts plus protected `projects/env/schematics/`.
- **Unit tests:** `unit-tests/env/`, including schematic specs; the Env schematic implementation remains protected.
- **Browser/integration:** Schematic plans/apply/revert need consumer-oriented verification.
- **Package source of truth:** [`projects/env/README.md`](../../projects/env/README.md).

## Guides

- [Scaffolding](scaffolding.md)
- [Explicit Workflow](explicit-workflow.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.
