# Engineering governance

**Owner:** Rivinia maintainers
**Purpose:** Index of current engineering policies and verification guides.

**Status:** Current navigation as of 2026-11-21. **Policy authority:** current owner instruction > root `AGENTS.md` > nearest `AGENTS.md` > invoked skill; decision/runbook records give additional context but do not override owner-approved current policy.

| Responsibility | Document |
| --- | --- |
| Start an agent task | Root `AGENTS.md` and [Task memory](TASK-MEMORY.md) |
| Branches; no automatic worktrees, commits, merge or push | [Git workflow](GIT-WORKFLOW.md); [worktree exceptions](WORKTREES.md) |
| Angular 22, Signals, OnPush, SSR, DI, cleanup | [Angular standards](ANGULAR-STANDARDS.md) |
| Source/test/harness/script layout | [Repository layout](REPOSITORY-LAYOUT.md) |
| Logical ownership by library | [Library ownership](LIBRARY-OWNERSHIP.md) |
| Angular unit and real-browser gates | [Testing architecture](TESTING-ARCHITECTURE.md) |
| Reorganize Unit/E2E/Scripts safely | [Migration plan](MIGRATION-PLAN.md) |
| Root executable ownership | [Tooling ownership](TOOLING-OWNERSHIP.md) |
| Public docs, relative links, historical records | [Documentation standards](DOCUMENTATION-STANDARDS.md) |
| Versions and sync release boundary | [Versioning](VERSIONING.md) |
| Release docs tied to tags | [Versioned documentation](VERSIONED-DOCUMENTATION.md) |
| Library task records / handoffs | [Task record](templates/task-record.md), [handoff](templates/handoff.md) |
| Skills and routing | [Skills routing](SKILLS-ROUTING.md), [inventory](SKILLS-INVENTORY.md), [matrix](SKILLS-REFERENCE-MATRIX.md) |
| Changelog boundaries | [Changelog policy](CHANGELOG-POLICY.md), [engineering changelog](CHANGELOG.md) |
| Durable, append-only decisions | [Decision log](../decisions/README.md) |

**Do not reuse stale snapshots:** historical release-group membership, npm dist-tags, audit branch names, E2E paths, and test counts embedded in old records describe *their dated state*, not the current workspace. The current `release-groups.json`, manifests, and current test targets win. Historical 2026-11-03 governance RFC: [archive](../archive/repository-architecture/RFC-ENGINEERING-GOVERNANCE.md).
