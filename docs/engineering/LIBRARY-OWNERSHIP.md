# Library ownership and verification matrix

**Status:** Unit-test centralization was completed and verified on `refactor/arch` on 2026-11-21. This table identifies **logical owners**; inspect the current checkout before relying on paths or counts.

| Library | Production implementation | Unit tests | Browser/integration owner | Documentation |
| --- | --- | --- | --- | --- |
| datepicker | `projects/datepicker/src`, `ui` | `unit-tests/datepicker` (18 files) | `playwright.datepicker.config.ts`; shared Theme fixture | [Guide](../datepicker/README.md) |
| env | `projects/env/src` + protected schematics | `unit-tests/env` (3 files, including schematics) | Schematic integration | [Guide](../env/README.md) |
| forms (private) | `projects/forms/src`, `select` | `unit-tests/forms` (11 files) | No independent browser-suite claim | [Guide](../forms/README.md) |
| http | `projects/http/src` + schematic | `unit-tests/http` (4 files, including schematics) | Consumer/HTTP tests as applicable | [Guide](../http/README.md) |
| i18n | `projects/i18n/src`, `select` and configured UI entries | `unit-tests/i18n` (38 files, including schematics) | `e2e/i18n`, `e2e/fixtures/i18n` | [Guide](../i18n/README.md) |
| menu | `projects/menu/src`, `ui` and configured entries | `unit-tests/menu` (8 files) | `e2e/menu`, `e2e/fixtures/overlays` | [Guide](../menu/README.md) |
| modal | `projects/modal/src` and UI entries | `unit-tests/modal` (8 files, including schematics) | Shared overlays and theme/integration coverage | [Guide](../modal/README.md) |
| popup | `projects/popup/src` | `unit-tests/popup` (4 files) | `e2e/popup`, shared overlays | [Guide](../popup/README.md) |
| select | `projects/select/src`, `ui` and configured entries | `unit-tests/select` (21 files) | `e2e/select`, `e2e/fixtures/overlays` | [Guide](../select/README.md) |
| table | `projects/table/src`, `ui` | `unit-tests/table` (9 files) | `e2e/table`, `e2e/fixtures/table` | [Guide](../table/README.md) |
| theme | `projects/theme/src`, styles and configured entries | `unit-tests/theme` (1 file) | Theme browser tests and `e2e/fixtures/theme` | [Guide](../theme/README.md) |
| toast | `projects/toast/src`, `ui` | `unit-tests/toast` (4 files, including schematics) | `e2e/toast`, `e2e/fixtures/toast` | [Guide](../toast/README.md) |

Counts are a navigation aid, not a measure of coverage. Angular targets discover flat package specs; nested schematic specs and the Theme suite use their dedicated root scripts. See [testing architecture](TESTING-ARCHITECTURE.md).

**Release boundary:** The synchronized group is defined by `release-groups.json` and currently has eleven members. `forms` is a source project but is not automatically admitted to that group. A secondary entry is a package API boundary, not automatically a network chunk.

**Shared ownership:** `e2e/` browser tests and harnesses are testing infrastructure, while package behavior belongs to its library; `scripts/` owns cross-repository verification; `docs/engineering/` owns governance; `.agents/skills/` owns routing; `docs/decisions/` is append-only; release docs remain version/history-specific. The env schematic implementation remains protected; only its authorized test files moved.

The unit-test path migration is complete. Any future E2E or tooling migration must update targets, scripts, CI, docs, and path-sensitive tooling while preserving discovery counts. Consult the [migration plan](MIGRATION-PLAN.md) and [Git workflow](GIT-WORKFLOW.md).
