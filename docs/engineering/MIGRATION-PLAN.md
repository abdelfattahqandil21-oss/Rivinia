# Architecture refactor — migration plan and verification gates

**Owner:** Rivinia maintainers
**Purpose:** Track architecture migration stages and verification gates.

**Status:** Phase 1 (library unit-test centralization) completed and verified on 2026-11-21. E2E and scripts phases remain unstarted. Historical governance migration reports are preserved under [the archive](../archive/repository-architecture/README.md).

## 0. Preflight, every scoped change

- Read root `AGENTS.md`, `rivinia-playbook`, nearest package rules, current docs and relevant decisions; inspect actual branch, HEAD, status, and task scope.
- Record live source/target file inventories and test counts. Check Angular targets, `tsconfig.spec.json`, imports, package scripts, CI, fixture paths, docs, skills, agent instructions, and path-sensitive tooling.
- Keep each migration independently reviewable. Do not change public APIs, runtime behavior, dependency versions, or release membership as a side effect. Protected implementation paths require explicit approval.

## Phase 1 — centralized library unit tests (complete)

The unit/component/form suites for Datepicker, HTTP, Toast, Modal, i18n, Forms, Env, Menu, Popup, Select, Table, and Theme now live under `unit-tests/<library>/`. Schematic specs use nested package folders and are run separately; the Theme pure-TypeScript suite uses `pnpm test:theme`.

| Verification | Result |
| --- | --- |
| Angular suites | 122 files / 1,659 tests passed: datepicker 18/520, http 3/48, toast 3/36, modal 7/65, i18n 37/408, forms 11/20, env 1/2, menu 8/78, popup 4/38, select 21/184, table 9/260 |
| Theme | 1 file / 11 tests passed |
| Schematics | 6 files / 45 tests passed |
| Combined inventory | 129 files / 1,715 tests passed |
| Production package builds | datepicker, http, toast, modal, i18n, forms, env, menu, popup, select, table, and theme passed |
| Architecture checks | No old package `tests/` directories; no duplicate copies; `git diff --check` passed |

The Datepicker pilot's Chromium/Firefox E2E suite passed 32 tests before the wider library move. E2E suites were not rerun for the wider move because no browser suite, fixture, or Playwright config changed. Env schematic implementation remains protected; only its explicitly authorized test files moved.

## Phase 2 — E2E consolidation (not started)

- Keep consumer fixtures under `e2e/fixtures/`; inspect `i18n`, `overlays`, `table`, `theme`, and `toast` builds and project-root references before changing ownership.
- Move browser suites into `e2e/tests/<library>/` or `integration/` only when justified. Consolidate config ownership under `e2e/configs/` while retaining necessary distinct configs. Update Playwright `testDir`, `webServer`, fixture outputs, imports, and root CLI commands together.
- Rebuild each exact fixture before browser verification. Compare discovered tests per browser before and after; cover RTL, Escape, focus restoration, small screens, and SSR where relevant.

## Phase 3 — scripts and CI organization (not started)

- Inventory root commands, shell paths, script imports, snapshots, fixtures, CI workflows, README snippets, and skills before moving tooling.
- Group executables only by real purpose: `build`, `checks`, `ci`, `release`, `smoke`, and `utils`. Do not create empty directories. Keep snapshots/fixtures with their data owner.
- Update root package scripts atomically per logical tool family; run tooling unit tests, `validate:ci`, docs/governance, and affected smoke/SSR/browser checks.
- Never run publishing executables as routine test verification; verify non-mutating behavior separately.

## Completion criteria for each future phase

- Record exact file identities, source/destination paths, target ownership, and before/after discovery counts.
- Update affected configs, package scripts, CI, docs, skills, fixtures, and path references; no stale active references or duplicate tests.
- Run `git diff --check` and all applicable builds/tests; report passed, failed, skipped, and not run separately.
- Review the diff with the owner. Earlier phases do not authorize later phases. No automatic commits, merges into `main`, pushes, tags, version bumps, or publishing.

Follow the [Git workflow](GIT-WORKFLOW.md) and [testing architecture](TESTING-ARCHITECTURE.md).
