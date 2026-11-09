# Repository engineering changelog

**Owner:** Rivinia maintainers
**Purpose:** dated record of repository architecture and workflow changes, separate from npm package histories.

## 2026-11-09 — Package maintainer skills and documentation guidance

- Added one package-scoped maintainer skill for each current library under `.agents/skills/`, plus exact 1.0.4 compatibility sidecars. The checklists were adapted to current public entry points and clearly separate implemented APIs from proposals.
- Updated the skill inventory, reference matrix, routing and AI-skill policy; added a feature-first consumer guide and a candidate-only future library roadmap. Merged useful documentation/release guidance into the existing AI-skill policy; skipped the ZIP's generic README and task-specific Codex directive to avoid duplicating repository policy.
- Rebuilt all eleven packages at `66e7cd3b0dfb17fd7b655998f4e9a61f7bc9de6a`; all builds passed. Unit suites passed: Popup 12, Select 166, Menu 66, Theme 11, Datepicker 470, Env 2, HTTP 40, Modal 55, Toast 35, Table 210, i18n 376 (1,443 total). Theme uses `pnpm run test:theme`; its `ng test --no-watch` target rejects the `watch` option.
- `pnpm check:skills`, `pnpm check:governance`, `pnpm check:readmes`, `pnpm check:pack` and `pnpm check:docs` passed; the documentation check reported 41 existing prose warnings and zero failures. Fresh dry-run and actual local npm packs for all eleven 1.0.4 dist packages contained no `.agents/skills`, `SKILL.md`, compatibility sidecars or source ZIP.
- No package source, public exports, package dependencies, versions, release tags or registry artifacts changed. No publish, push or merge occurred.

## 2026-11-03 — governance foundation

- Added version-aware package ownership, release group, documentation, AI skill, testing, task memory, worktree and changelog policies.
- Added root and directory-scoped agent instructions, a maintainer skill update, public-safe task templates and a consistency gate.
- Added release-group, version-aware skill compatibility and immutable documentation-link/snapshot checks with positive and negative fixtures.
- Rebuilt popup prerequisites before mutation verification: the clean control passed 24 tests and all 18 behavior mutants were killed.
- Refreshed the root package table to the verified `1.0.0-rc.2` npm `latest` state for the four-package release group.
- Organized repository documentation by responsibility and release lifecycle, retaining compatibility pointers for previous paths; strengthened the package README checker to fail on missing local links.
- Added a ten-library ownership map and colocated the i18n-owned app, Playwright suites, and SSR smoke under `projects/i18n/testing/` while retaining the independent `i18n-e2e` Angular project and its output paths.
- Moved package-owned i18n, Menu, Select, Table, and theme specifications under each package's `specifications/` directory; kept one cross-library index and compatibility pointers for historical links.
- Added `consumer:smoke`, a temporary Angular consumer workflow that installs exact packed tarballs, checks selected public imports/optional-peer absence, records versions and SHA-256, and cleans up after success or failure.
- Verified the i18n move from an empty `dist/`: select/i18n production builds, 376 unit tests, CSR/SSR builds, 36 SSR checks, 96 browser tests (Chromium, Chrome, Firefox), API-surface test, docs/governance/skills/README checks, and a 20-file i18n pack with no harness files.
- No runtime, public API, package version, release tag or registry state changed.
- Evidence: `docs/engineering/MIGRATION-PLAN.md`; task details remain in the task owner's private journal.
