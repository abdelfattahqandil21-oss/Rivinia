## 2026-11-14 — D100: isolated env patch for an npm consumer trial

**Status:** Owner-approved one-release exception; publication awaits exact artifact confirmation
**Area:** Release / Env

## Decision

Prepare `@rivinia/env@1.0.5` as an isolated patch so the integrated schematics and their
README can be exercised through npm in a real consumer. For this release only, the
`rivinia-1.0` synchronized-version requirement is waived for `@rivinia/env`; the other
ten packages remain at `1.0.4`.

This is a one-time release exception. It does not remove `@rivinia/env` from
`release-groups.json`, change dependency ranges, or authorize future unsynchronized
releases. Future releases follow the synchronized group unless the owner records
another explicit exception.

## Rationale and scope

The package is independently consumable for the requested npm trial. Its patch contains
the review-first schematic workflow, the existing scaffold under the same `ng add`,
formatted JSON plans, and the fix allowing read-only analysis through workspace-internal
pnpm symlinks while mutation paths remain symlink-safe.

Only the env package version, changelog and versioned README links are prepared for
`1.0.5`. No other package is versioned or published by this exception.

## Approval boundary

The owner requested this isolated patch on 2026-11-14. Publication still requires the
owner to confirm the exact package, version, public access, distribution tag and
inspected tarball contents after all release gates pass. This record does not claim
that a commit, tag or publication already exists.
