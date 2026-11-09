---
name: rivinia-datepicker
description: Maintain @rivinia/datepicker calendar, time and date-time behavior, formatting, zones and UI.
metadata:
  role: maintainer
  package_scope: "@rivinia/datepicker"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/datepicker/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia datepicker maintainer skill

**Scope:** `@rivinia/datepicker` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/datepicker` exports date/time models, pure helpers, calendar state and providers. `@rivinia/datepicker/ui` exports calendar, datepicker, datetimepicker and time-row components.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Keep civil dates, wall-clock times, instants and time-zone resolution distinct; inspect the current date/time model and explicit gap/overlap behavior.
- Cover locale week start, Arabic/Persian numerals, 12/24-hour cycles, optional seconds, steps, min/max and date-specific disabled times.
- Preserve draft-versus-commit behavior and the actual keyboard/ARIA contract of calendar and time controls.
- Do not invent a standalone time-only entry point; `RiviniaTimeRowComponent` is currently exported from `/ui`.
- Exercise DST gap/overlap using IANA zones, SSR guards, RTL, narrow viewports, scoped theme and native popovers.

## Package verification

- Production package build: `pnpm exec ng build datepicker`.
- Existing unit suite: `pnpm exec ng test datepicker --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
