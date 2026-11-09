---
name: rivinia-modal
description: Maintain @rivinia/modal lifecycle, guards, stack ownership, focus and optional ready-made UI.
metadata:
  role: maintainer
  package_scope: "@rivinia/modal"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/modal/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia modal maintainer skill

**Scope:** `@rivinia/modal` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/modal` exports the manager/provider and lifecycle/configuration types; `@rivinia/modal/ui` exports the dialog, host, header/footer directives and scroll-lock utility.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Inspect native dialog behavior, active stack policy, backdrop/top-layer inertness, initial/final focus, Escape, explicit close and guard lifecycle.
- Keep the currently exported lifecycle/guard contracts distinct from proposed action registries, footer layouts, form adapters or workflow APIs.
- Test nested dialogs, async close races, route/component destruction, dirty-form decisions and interaction with active Toast hosts.
- Compare Reactive, template-driven and Signal Forms using Angular-native contracts first; do not add a forms dependency to basic Modal without measured need.
- Treat Angular `@boundary` as experimental only after checking installed Angular types and testing its actual scope; it does not handle async business errors.

## Package verification

- Production package build: `pnpm exec ng build modal`.
- Existing unit suite: `pnpm exec ng test modal --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
