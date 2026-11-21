# Rivinia documentation

**Primary navigation for the single Rivinia repository.** This directory contains public library guides, engineering contracts, test evidence, dated architecture decisions, and release history. The package README and `public-api.ts` remain the source of truth for **implemented** consumer APIs; do not infer implementation or release status from a proposal.

## Library documentation

| Library | Guide | Ownership and status |
| --- | --- | --- |
| Datepicker | [Datepicker](datepicker/README.md) | `projects/datepicker`; core plus UI |
| Env | [Environment tooling](env/README.md) | `projects/env`; protected schematics |
| Forms | [Forms](forms/README.md) | `projects/forms`; present in source, **not automatically in the synchronized release group** |
| HTTP | [HTTP](http/README.md) | `projects/http` |
| i18n | [Internationalization](i18n/README.md) | `projects/i18n`; core/UI/select |
| Menu | [Menu](menu/README.md) | `projects/menu` |
| Modal | [Modal](modal/README.md) | `projects/modal` |
| Popup | [Popup](popup/README.md) | `projects/popup`; shared overlay behavior |
| Select | [Select](select/README.md) | `projects/select` |
| Table | [Table](table/README.md) | `projects/table` |
| Theme | [Theme](theme/README.md) | `projects/theme` |
| Toast | [Toast](toast/README.md) | `projects/toast` |

These are **12 source directories**, not a claim that 12 packages are published. Verify membership in `release-groups.json` before a release or public package statement.

## Engineering and repository operations

| Need | Canonical document |
| --- | --- |
| Agent startup and task ownership | Root `AGENTS.md`, [engineering](engineering/README.md) |
| Current project layout, migration **target vs reality** | [Repository layout](engineering/REPOSITORY-LAYOUT.md) |
| Branch-only workflow and approval boundaries | [Git workflow](engineering/GIT-WORKFLOW.md) |
| Angular 22 library conventions | [Angular standards](engineering/ANGULAR-STANDARDS.md) |
| Units/E2E/fixtures and proof requirements | [Testing architecture](engineering/TESTING-ARCHITECTURE.md) |
| Library/source/test ownership | [Library ownership](engineering/LIBRARY-OWNERSHIP.md) |
| Automation and release command owners | [Tooling ownership](engineering/TOOLING-OWNERSHIP.md) |
| Documentation conventions, links and old files | [Documentation standards](engineering/DOCUMENTATION-STANDARDS.md) |
| Phased test/E2E/scripts migration | [Migration plan](engineering/MIGRATION-PLAN.md) |
| Versioning and release membership | [Versioning](engineering/VERSIONING.md) and `release-groups.json` |
| Architecture decisions | [Decision index](decisions/README.md), [stable pointer](DECISIONS.md) |
| Test evidence and browser floor | [Testing records](testing/README.md) |
| Release history (historical, not authorization) | [Release index](releases/README.md) |
| Completed audits and superseded plans | [Archive](archive/README.md) |
| Feature candidates (not approved work) | [Future library roadmap](engineering/FUTURE-LIBRARY-ROADMAP.md) |

The fixed accessibility baseline files remain under [`a11y-snapshots/`](a11y-snapshots/) because shared verification tooling may use that path. Two compatibility pointers remain at `browser-support.md` and `README-TEMPLATE.md` because original append-only decisions refer to those exact locations.

## Source-of-truth rules

1. For **what exists**, inspect the checked-out branch, files, manifests, tests, and package exports. The 2026-11-21 unit-test move is complete: current library unit suites live under `unit-tests/<library>/`; the migration plan records its verified counts. The checked-out tree remains authoritative for later changes.
2. For **what is approved**, read the current owner's instructions and root `AGENTS.md`; old RFCs and dated audit notes are evidence only.
3. For **what was released**, verify the immutable tag, registry version, and inspected tarball. An old release runbook does not approve anything.
4. For **future layout**, see the migration plan; a target tree is not evidence that files have moved.
