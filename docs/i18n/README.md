# `@rivinia/i18n` — documentation index

**Scope:** Locale, messages, loaders, direction and UI integration. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/i18n/src/` plus configured UI/select entries.
- **Unit tests:** `unit-tests/i18n/`, including schematic specs.
- **Browser/integration:** `e2e/i18n/` using `e2e/fixtures/i18n/` CSR/SSR consumer.
- **Package source of truth:** [`projects/i18n/README.md`](../../projects/i18n/README.md).

## Guides

- [Api](api.md)
- [Translating](translating.md)
- [Dictionaries](dictionaries.md)
- [Switching](switching.md)
- [Icu](icu.md)
- [Cli](cli.md)
- [Resilience](resilience.md)
- [Toggle](toggle.md)
- [Select](select.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.
