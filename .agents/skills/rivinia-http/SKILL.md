---
name: rivinia-http
description: Maintain @rivinia/http request, resource, cancellation, envelope and error contracts.
metadata:
  role: maintainer
  package_scope: "@rivinia/http"
  supported_ranges_ref: docs/engineering/VERSIONING.md
  documentation_refs: projects/http/README.md
  verification_refs: docs/engineering/TESTING-ARCHITECTURE.md
---

# Rivinia http maintainer skill

**Scope:** `@rivinia/http` in this repository. This is package-maintainer guidance, not a consumer compatibility guarantee.

## Current public surface

`@rivinia/http` exports its provider/service, request and resource types, envelope errors/policy, and URL/unwrap helpers.

Use the package README, public entry-point files, source and tests as the source of truth. A checklist item or roadmap idea below does not mean the capability is implemented.

## Package-specific review

- Read the public request/provider/resource contracts before discussing interceptors, cancellation, retries, caching, concurrency or error normalization.
- Never automatically retry non-idempotent operations; redact credentials and sensitive response data from diagnostics.
- Distinguish Angular `httpResource` state from any HTTP method proposal such as RFC 10008 QUERY; test the full browser/server/proxy/CORS path before claiming support.
- Keep optional integrations opt-in and verify the actual peer/dependency graph and public package imports.
- Benchmark incremental consumer bundles for headless and optional integrations, not package FESM size alone.

## Package verification

- Production package build: `pnpm exec ng build http`.
- Existing unit suite: `pnpm exec ng test http --no-watch`.
- Follow this package’s documented dependency prerequisites and browser gates; see `docs/engineering/TESTING-ARCHITECTURE.md`.
