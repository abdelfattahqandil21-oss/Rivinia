# `@rivinia/datepicker` — documentation index

**Scope:** Calendar, date, time, and date+time UX. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** Core calendar and parsing logic in `projects/datepicker/src/`; date/time/calendar UI in `projects/datepicker/ui/`.
- **Unit tests:** `unit-tests/datepicker/` (18 specs; run with `pnpm exec ng test datepicker --watch=false`).
- **Browser/integration:** `e2e/datepicker/` and the Theme fixture.
- **Package source of truth:** [`projects/datepicker/README.md`](../../projects/datepicker/README.md).

## Guides

- [Overview](overview.md)
- [Installation](installation.md)
- [Quick Start](quick-start.md)
- [Api](api.md)
- [Headless](headless.md)
- [Forms](forms.md)
- [Date And Time](date-and-time.md)
- [Keyboard And Rtl](keyboard-and-rtl.md)
- [Time Zones And Dst](time-zones-and-dst.md)
- [Layout](layout.md)
- [Theming](theming.md)
- [Accessibility](accessibility.md)
- [Formatting](formatting.md)
- [Scope And Limits](scope-and-limits.md)
- [Design Notes](design-notes.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.
