# D105 — Branch-only agent workflow and centralized test/tooling ownership

## 2026-11-21 — D105: Branch-only agent workflow and centralized test/tooling ownership
**Status:** Owner-approved *direction and Git policy*; physical migrations not automatically completed
**Scope:** Repository governance, Angular test organization, Playwright and script ownership; **not** runtime APIs, released versions or publish authorization.

## Context

The existing Rivinia checkout is the only live working repository. Earlier worktree-first recommendations caused avoidable workspace ambiguity. The owner explicitly required Git branches and direct human review before any merge into `main`. Tests currently span package-local directories and root E2E/tooling directories; the owner approved centralizing test infrastructure as a separately reviewed migration.

## Decision

1. No Git worktrees or cloned task checkouts unless the owner **explicitly names and authorizes** that operation. Use task branches inside the existing checkout.
2. No automatic commit, rebase, cherry-pick, squash, force-push, branch delete, tag, version bump, publish or push. `main` is the real integration branch and requires the owner's **direct merge request after review**.
3. Keep package production sources, manifests, entry points and changelogs under `projects/<library>/`; preserve release group ownership in `release-groups.json`.
4. Target library unit tests under `unit-tests/<library>/`, with `unit-tests/tooling/` for script tests. A test remains logically package-owned. Use configured Angular test runners and preserve test counts.
5. Target browser tests/fixtures/configs under `e2e/`; keep a minimal set of justified Playwright configs, preserving actual fixture builds and CLI contracts.
6. Target purpose-owned script subfolders (`build`, `checks`, `ci`, `release`, `smoke`, `utils`) **only where justified**. Do not create directories without files or rewrite public commands casually.
7. Preserve immutable older decisions, protect `projects/env/schematics`, and require scoped verification before each migration. The active workflow is in `docs/engineering/GIT-WORKFLOW.md`, `REPOSITORY-LAYOUT.md`, and `MIGRATION-PLAN.md`.

## Consequences / exclusions

- This decision **supersedes the worktree-first operational guidance**, but does not erase dated history.
- The 2026-11-21 user tree at `58bdae9` still had tests in `projects/datepicker/tests`; any later notes claiming a completed move need checkout-level proof. Proposed layout is not implemented merely by writing documentation.
- No API break, new package, release-group admission, version bump, merge to `main` or npm publication is implied or approved.
- Each phase produces its own diff, updated configuration, test/build/browser evidence and owner review before any Git commit.
