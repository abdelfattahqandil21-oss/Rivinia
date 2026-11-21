# Testing architecture — contract and location

**Owner:** Rivinia maintainers
**Purpose:** Define test ownership, locations and verification gates.

**Status:** Library unit suites are centralized under `unit-tests/<library>/`. Verify the live checkout before relying on counts. The previous dated testing memo is preserved in the [archive](../archive/repository-architecture/TESTING-ARCHITECTURE-LEGACY.md).

## Four distinct layers

| Gate | Owner and purpose | Authoritative execution |
| --- | --- | --- |
| Unit, component, forms | Library-owned suites under `unit-tests/<library>/`; Angular targets include the flat package specs | The configured `pnpm exec ng test <library> --watch=false` target |
| Schematics and Theme | Schematic specs under `unit-tests/<library>/schematics/`; pure-TypeScript Theme suite | `pnpm test:schematics` and `pnpm test:theme` |
| Browser / E2E | Cross-browser public behavior with actual fixtures and keyboard/geometry | Build the exact fixture, then run its configured Playwright project |
| Exact tarball consumer | Real exports/types/peers/FESM and production Angular build | Pack the approved artifact; install it in a clean external consumer |

The centralized inventory contains 129 spec files and 1,715 passing tests: 122 Angular-run files / 1,659 tests, six schematic files / 45 tests, and one Theme file / 11 tests. Package-by-package counts are recorded in the [migration plan](MIGRATION-PLAN.md).

Browser suites include Datepicker, i18n, integration, Menu, Popup, Select, Table, Theme compatibility, and Toast. Fixture apps live under `e2e/fixtures/`; configs remain at their existing paths until a separately approved migration.

## Invariants for file moves

1. Use the configured Angular target for Angular/TestBed suites. A previous raw Vitest attempt bypassed Angular setup and failed component suites at import; it is not a substitute for `pnpm exec ng test datepicker --watch=false`, which passed 520 tests in 18 files.
2. Before and after each future `git mv`, inventory spec files, test cases, browser projects, and effective Angular/TypeScript inputs. Discovery must not decline unexpectedly; an empty suite or silently skipped file is failure.
3. Keep nested schematic specs out of Angular's flat unit-test include patterns; execute them through the dedicated schematic script. Keep the Theme suite on its dedicated script.
4. No client-side layout proof from jsdom. Build the exact Angular fixture and run real Chromium/Firefox as supported; include WebKit/manual Safari per support claim. Do not rely on stale `dist` output.
5. Preserve source API boundaries. Fixtures import public package specifiers, not internal `projects/<library>/src` paths. Rebuild prerequisite library packages before fixtures when workspace aliases point to dist.
6. Clean-consumer claims require the exact packed tarball installed and production-built; a workspace package build alone is insufficient.

## Browser focus and overlay risk list

Exercise trigger focus, first-cell focus with `preventScroll` where needed, scroll-position stability, clipped-anchor dismissal, Escape topmost ownership, nested time-tray behavior, narrow/short viewport clamping, RTL/ARIA, disabled handling, keyboard access, animation, and hydration when relevant. Preserve existing assertions unless documented evidence proves them wrong.

## Release/readiness proof

A unit-test pass is not a release. Release gates require explicit owner approval and the release skill with exact artifact import/pack checks, a built consumer, docs links, required browsers, accessibility coverage, and immutable tags. See [versioning](VERSIONING.md), [browser support](../testing/browser-support.md), and [testing evidence](../testing/README.md).

**Reporting:** command, input/build commit, config/browser, result, and test counts; report `passed`, `failed`, `skipped`, and `not run` separately. No broad green check from a focused run.
