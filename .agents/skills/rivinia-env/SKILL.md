---
name: rivinia-env
description: Maintain @rivinia/env exported types and opt-in environment schematics safely.
metadata:
  role: maintainer
  package_scope: "@rivinia/env"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/env/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia env maintainer skill

**Scope:** `@rivinia/env` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/env` currently exports the `BaseEnvironment` type; package installation also exposes the documented schematic collection.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Distinguish the current type export and `ng add` schematic from any proposed runtime provider, environment loader or schema-validation API.
- Inspect schematic schema, collection metadata and generated files before changing setup behavior; `projects/env/schematics/` is protected and needs explicit owner approval before modification.
- Check idempotency, invalid-option behavior, path handling, rollback, SSR and browser-exposed values; never bake private environment values into output.
- Use app initialization only for genuinely bootstrap-blocking configuration; decorative loading must not delay bootstrap.
- Keep generator commands and output claims tied to the actual schematic implementation.

## Package verification

- Production package build: `pnpm exec ng build env`.
- Existing unit suite: `pnpm exec ng test env --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
