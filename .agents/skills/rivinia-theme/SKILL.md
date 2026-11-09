---
name: rivinia-theme
description: Maintain @rivinia/theme CSS token contract, framework adapters, cascade and scoped inheritance.
metadata:
  role: maintainer
  package_scope: "@rivinia/theme"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/theme/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia theme maintainer skill

**Scope:** `@rivinia/theme` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/theme` is CSS-only: its package exports theme.css, Tailwind and Bootstrap adapters, and the SCSS entry. It exports no TypeScript runtime API.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Read current theme/component token definitions and docs; never hardcode a semantic-token count or claim a component token without locating it.
- Prove light/dark/system and explicit override behavior at root and nested scopes, including native dialogs/popovers and `color-scheme`.
- Review cascade layers, component-local aliases, Tailwind v4 utilities/prefixing, Bootstrap 5 variables/Reboot, SCSS and LESS using a real consumer build.
- Keep native CSS inheritance instead of adding a JavaScript theme engine; label any theme-toggle entry point as proposed unless a public export exists.
- Compare emitted CSS and whole-consumer raw/gzip/Brotli payloads from fresh builds; distinguish framework bytes from Rivinia bytes.

## Package verification

- Production package build: `pnpm exec ng build theme`.
- Existing unit suite: `pnpm run test:theme`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
