# `@rivinia/http` — documentation index

**Scope:** Typed HTTP boundaries and optional providers. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/http/src/` plus package-owned `schematics/`.
- **Unit tests:** `unit-tests/http/`, including schematic specs.
- **Browser/integration:** HTTP mocking/consumer behavior; no dedicated E2E suite assumed.
- **Package source of truth:** [`projects/http/README.md`](../../projects/http/README.md).

## Guides

- [Api](api.md)
- [Resources](resources.md)
- [Urls And Services](urls-and-services.md)
- [Envelopes And Errors](envelopes-and-errors.md)
- [Testing](testing.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.
