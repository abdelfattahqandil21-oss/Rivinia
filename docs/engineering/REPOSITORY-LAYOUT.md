# Repository layout: observed vs planned

**Evidence baseline:** user-supplied `git ls-files` tree on `refactor/arch` at `58bdae9`, 2026-11-21. It contained 1,112 tracked/unignored files. The unit-test centralization has since been verified in the current checkout; inspect actual paths before any further migration.

## Current *observed* owners

```text
Rivinia/
  projects/<library>/src/             publishable library core/source
  projects/<library>/{ui,...}/        real secondary entries where configured
  unit-tests/<library>/               package-owned unit/component/form tests (centralized)
  unit-tests/<library>/schematics/    schematic specs for packages that have them
  e2e/<library>/                      browser suites; cross-component suites
  e2e/fixtures/{i18n,overlays,table,theme,toast}/
  e2e/configs/{i18n,toast}.config.ts  existing central configs
  playwright*.config.ts              additional current root configs
  scripts/*.mjs                       currently top-level executable tools
  scripts/tests/                      current tooling tests
  scripts/fixtures/                   shared expected data and consumer template
  docs/                               documentation, decision records, release history
```

`projects/forms` is present but not automatically a member of the synchronized eleven-package release group. Do not conflate source directories, packages, and secondary entry points.

## Remaining owner-approved targets

```text
Rivinia/
  projects/<library>/                package implementation + manifests
  unit-tests/tooling/                script verification tests
  e2e/tests/<library>/               browser specs
  e2e/tests/integration/             cross-library behavior
  e2e/configs/                       consolidated justified Playwright configs
  e2e/fixtures/                      real Angular consumer harness apps
  e2e/support/                       shared Playwright-only helpers
  scripts/build/                     build orchestration
  scripts/checks/                    quality/contract gates
  scripts/ci/                        CI orchestration
  scripts/release/                   release preparation and publishing
  scripts/smoke/                     SSR/consumer/prod proof
  scripts/utils/                     actual shared helpers only
```

The E2E and scripts paths above are targets, not evidence that those migrations are complete. **Never create empty placeholders for appearance**; add a folder only when it owns files/behavior. Preserve old commands until their references in package.json, CI, skills, docs, AGENTS and task scripts are explicitly migrated and tested. Env schematic implementation remains protected; only its test files were moved with explicit authorization.

## Package vs repository test ownership

A test belongs logically to its package regardless of physical directory; the `ng test <package>` builder remains the authoritative Angular unit runner. Browser fixtures test public consumer contracts, not internal compiler-only behavior. Cross-library integration is owned by `e2e/tests/integration/` only **when actually moved**.

See [migration plan](MIGRATION-PLAN.md), [testing contracts](TESTING-ARCHITECTURE.md), and [library ownership](LIBRARY-OWNERSHIP.md).
