# `@rivinia/popup` — documentation index

**Scope:** Positioning, observation and dismissal primitives. This is a documentation map, not an independent assertion of npm version, publication status or public API exports. Verify the package README, `src/public-api.ts`, package manifest and active branch before editing a consumer contract.

## Ownership

- **Implementation:** `projects/popup/src/` is the core overlay infrastructure.
- **Unit tests:** `unit-tests/popup/`.
- **Browser/integration:** `e2e/popup/` and shared overlays; owner is popup for behavior, not a new consumer page.
- **Package source of truth:** [`projects/popup/README.md`](../../projects/popup/README.md).

## Guides

No standalone topic pages yet; start from the package README and popup consumer contracts in Menu, Select and Datepicker.

## Working agreement

The package owns public APIs and its unit tests regardless of the physical test directory. `docs/` contains guides and dated evidence. For source, test/E2E and scripts relocation, see the [owner-approved migration plan](../engineering/MIGRATION-PLAN.md); no folder movement is implied by this index.

**Overlay composition:** Core positioning/dismissal belongs to Popup. Datepicker, Menu, Select and nested time trays own their trigger/focus/ARIA semantics. Cross-package behavior is verified by the actual browser suites; do not disable correct `anchor-hidden` dismissal to conceal a focus/scroll bug.
