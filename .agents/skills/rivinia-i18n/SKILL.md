---
name: rivinia-i18n
description: Maintain @rivinia/i18n locale, ICU, translation loading, switching, SSR and optional UI entry points.
metadata:
  role: maintainer
  package_scope: "@rivinia/i18n"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/i18n/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia i18n maintainer skill

**Scope:** `@rivinia/i18n` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/i18n` is the core API; current secondary entry points are `/ui` and `/select` for language controls.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Confirm current locale signals, missing-key/parameter behavior, ICU formatting, loader contracts, cache/inflight behavior and fallback rules in source and docs.
- Test Arabic plural categories, RTL changes without losing focus or pending modal edits, SSR/hydration and browser-language versus saved-preference priority.
- Keep core independent of optional UI; verify `/select` and `/ui` imports and declared `@rivinia/select` dependency before changing boundaries.
- Exercise remote loader failure, cancellation/last-wins behavior and diagnostics without leaking translation content or secrets.
- Do not duplicate `i18n-egy` behavior; follow D003 and current package evidence.

## Package verification

- Production package build: `pnpm exec ng build i18n`.
- Existing unit suite: `pnpm exec ng test i18n --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
