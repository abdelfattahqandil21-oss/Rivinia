# `@rivinia/forms` — documentation index

**Scope:** Native-form foundation and specialized controls. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/forms/src/` with text, password, OTP, phone, number/decimal, file, image, choice, toggle, range and payment-related UI; optional `projects/forms/select/` secondary.
- **Unit tests:** `unit-tests/forms/`.
- **Browser/integration:** No independent browser-suite claim is made by the supplied tree; require consumer/SSR/RTL tests before release admission.
- **Package source of truth:** [`projects/forms/README.md`](../../projects/forms/README.md).

## Guides

- [Foundation](foundation.md)

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.

**Release status:** `forms` exists as a source project in the supplied tree. It is **not** automatically one of the eleven synchronized releases. Any release-group admission requires an explicit owner decision and manifest/tarball review.
