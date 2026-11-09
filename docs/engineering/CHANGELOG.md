# Repository engineering changelog

**Owner:** Rivinia maintainers
**Purpose:** dated record of repository architecture and workflow changes, separate from npm package histories.

## 2026-11-09 — Phase C1 Toast rich-color contrast

- Theme's four status colors are documented for indicators, not text backgrounds. Toast's previous rich-color foreground/background combinations failed 4.5:1 for error (4.04:1) and info (3.66:1).
- Rich Toast cards now derive their background from the existing package-token → semantic-token → fallback chain, mixing the status hue with 45% black and using white text. This preserves Toast ownership and Theme interoperability without inventing Theme foreground tokens. Static Toast-owned pairs provide a safe fallback when `color-mix()` is unavailable.
- Built-artifact Chromium coverage measures computed foreground/background contrast for all four statuses, action and dismiss labels, status icons and the focused action outline. It covers standalone fallbacks and Theme light/dark; scoped and instance status-token changes remain isolated and feed the derived rich backgrounds.
- Verification: `pnpm exec ng build toast`; `pnpm exec ng test toast --no-watch` (35/35); standalone and Theme consumer builds; Toast compatibility E2E (Chromium: 3 passed, 1 conditional skip per build). The new contrast test was RED before the CSS correction at 4.035:1 for standalone error text, then GREEN after.
- Custom status colors from adapters or consumers remain their responsibility to pair accessibly. Firefox, WebKit and Safari were not run for this checkpoint.

## 2026-11-09 — Phase C2 Popup resize conformance

- The initial Chromium resize run exposed a stale test guard, not a Popup implementation defect. After D99, scrolling repositions an anchored panel and dismisses it only when its trigger leaves the visual viewport; the old helper rejected any `scrollY` movement as a dismissal risk.
- On the failing phone-orientation case, viewport resizing with the menu item focused changed `scrollY` from 665 to 647 while the trigger remained inside the viewport. The old guard stopped before the width-close assertion.
- Updated the shared resize helper to monitor actual scroll events and assert the trigger stays in the visual viewport; it awaits two animation frames for resize/reposition work. The width case still requires the panel to close, and height-only resize still requires the panel to stay open and maintain its anchor geometry. No Popup, Menu or Select production code changed.
- Verification: `pnpm exec ng build menu-e2e`; the focused width and height resize cases passed for all three adapters; `pnpm exec playwright test e2e/popup/conformance.spec.ts e2e/select/select.spec.ts --project=chromium` passed 54/54. Firefox and WebKit were not run.

## 2026-11-09 — Phase C overlay lifecycle checkpoint

- Ownership audit: Popup owns headless anchoring/dismissal; Menu and Select consume it and retain their own interaction/focus policy. Modal owns native-dialog lifecycle and its reference-counted scroll lock. Toast owns notification state and UI. No stable shared contract justifies a global OverlayManager.
- A built-artifact consumer exposed a Modal cleanup defect: the last scroll-lock release removed consumer-owned `scrollbar-gutter`. Modal now snapshots and restores the original value and priority while preserving nested lock counting. RED was a Chromium consumer assertion (`stable both-edges` became `auto`); GREEN is recorded in the commits below.
- The consumer matrix covers Menu followed by Modal with one Escape per layer, Modal focus restoration, a ToastList rendered inside the active dialog with a working action, repeated open/close, immediate owner destruction and destruction during exit animation. Toast documentation now states why the single active list belongs inside the dialog for modal-owned notifications. A warning in Datepicker API prose that exposed internal `DatepickerPanelRegistry` was replaced with an implementation-neutral description.
- Verification: Popup, Menu, Select, Modal and Toast production builds passed; `menu-e2e` production build passed; `pnpm exec ng test modal --no-watch` passed 56/56; the five new Chromium overlay consumer checks passed 5/5; `pnpm check:docs` reported 0 failures and 40 remaining prose warnings (down from 41). Prettier and `git diff --check` passed.
- The first Popup/Select Chromium pass flagged a width-resize case because `scrollY` changed from 665 to 647. Phase C2 below documents the source-level review: the anchor stayed visible, so D99 called for repositioning, and the old test helper's unconditional no-scroll rule was stale. Updating the helper preserved the width-close assertion and proved all affected browser cases pass.
- Remaining Phase C work: audit Theme toggle/token ownership and perform the planned Firefox/WebKit runs. Forty heuristic documentation warnings remain classified in the private task ledger. Firefox, WebKit and Safari were unverified for the original checkpoint.
- Worktree: `/media/abdelfattahqandi/OWN/libs/Revinia-phase-c-overlays`, branch `pkg/repo/phase-c-overlay-lifecycle`, base `7105d740f4de240c5ace5bfd5a9ff93f00987243`, current checkpoint HEAD `6dd779cb7263c49550fac368575fe2ef008e161a`.
- Commits: `ce6c5a1` (`fix(modal): restore existing scrollbar gutter`) and `6dd779c` (`test(overlays): verify cross-package modal lifecycle`), local only. No API, package version, release state or remote changed.

## 2026-11-09 — Package maintainer skills and documentation guidance

- Added one package-scoped maintainer skill for each current library under `.agents/skills/`, plus exact 1.0.4 compatibility sidecars. The checklists were adapted to current public entry points and clearly separate implemented APIs from proposals.
- Updated the skill inventory, reference matrix, routing and AI-skill policy; added a feature-first consumer guide and a candidate-only future library roadmap. Merged useful documentation/release guidance into the existing AI-skill policy; skipped the ZIP's generic README and task-specific Codex directive to avoid duplicating repository policy.
- Rebuilt all eleven packages at `66e7cd3b0dfb17fd7b655998f4e9a61f7bc9de6a`; all builds passed. Unit suites passed: Popup 12, Select 166, Menu 66, Theme 11, Datepicker 470, Env 2, HTTP 40, Modal 55, Toast 35, Table 210, i18n 376 (1,443 total). Theme uses `pnpm run test:theme`; its `ng test --no-watch` target rejects the `watch` option.
- `pnpm check:skills`, `pnpm check:governance`, `pnpm check:readmes`, `pnpm check:pack` and `pnpm check:docs` passed; the documentation check reported 41 existing prose warnings and zero failures. Fresh dry-run and actual local npm packs for all eleven 1.0.4 dist packages contained no `.agents/skills`, `SKILL.md`, compatibility sidecars or source ZIP.
- No package source, public exports, package dependencies, versions, release tags or registry artifacts changed. No publish, push or merge occurred.

## 2026-11-09 — Toast status-token inheritance restored

- Root cause: .rv-toasts declared the four --rv-toast-* status colors on the
  list itself, shadowing inherited --rv-ok, --rv-danger, --rv-info and
  --rv-warning values. This regressed D46's read-site token chains.
- Removed those four declarations; retained the package-token → semantic-token
  → built-in fallback chain and documented each no-Theme fallback.
- Added a built-artifact Angular consumer with standalone and Theme-enabled
  configurations. System Chrome reproduced the issue before the fix; after it,
  standalone and Theme profiles each passed 2 browser checks with the
  inapplicable profile-specific check skipped. The tests cover light/dark
  Theme values, global/scoped/instance overrides, rich colors, sibling
  isolation, status content and the manual popover top layer.
- Toast's 35 unit tests, production builds for Toast and Theme, both consumer
  builds, check:skills, check:governance and check:docs passed. Theme build
  emitted an existing conflicting default export-condition warning.
  check:docs reported 41 existing prose warnings and no failures. Firefox,
  WebKit and native Safari were not run.
- Updated Toast topic-page links to the existing immutable 1.0.4 package tags;
  verified target tags and paths without changing a tag, package version or
  release artifact. No public API or package dependency changed.
- Worktree: /media/abdelfattahqandi/OWN/libs/Revinia-toast-theme-token-precedence,
  branch pkg/@rivinia/toast/theme-token-precedence, based on
  92e2328c4e9479dbb34c80d5b57e910fd80ea31d.
- Implementation commit: f9d72d41b1ec10371fcca13dd7636f46a2ce3747
  (local only; no remote write).

## 2026-11-03 — governance foundation

- Added version-aware package ownership, release group, documentation, AI skill, testing, task memory, worktree and changelog policies.
- Added root and directory-scoped agent instructions, a maintainer skill update, public-safe task templates and a consistency gate.
- Added release-group, version-aware skill compatibility and immutable documentation-link/snapshot checks with positive and negative fixtures.
- Rebuilt popup prerequisites before mutation verification: the clean control passed 24 tests and all 18 behavior mutants were killed.
- Refreshed the root package table to the verified `1.0.0-rc.2` npm `latest` state for the four-package release group.
- Organized repository documentation by responsibility and release lifecycle, retaining compatibility pointers for previous paths; strengthened the package README checker to fail on missing local links.
- Added a ten-library ownership map and colocated the i18n-owned app, Playwright suites, and SSR smoke under `projects/i18n/testing/` while retaining the independent `i18n-e2e` Angular project and its output paths.
- Moved package-owned i18n, Menu, Select, Table, and theme specifications under each package's `specifications/` directory; kept one cross-library index and compatibility pointers for historical links.
- Added `consumer:smoke`, a temporary Angular consumer workflow that installs exact packed tarballs, checks selected public imports/optional-peer absence, records versions and SHA-256, and cleans up after success or failure.
- Verified the i18n move from an empty `dist/`: select/i18n production builds, 376 unit tests, CSR/SSR builds, 36 SSR checks, 96 browser tests (Chromium, Chrome, Firefox), API-surface test, docs/governance/skills/README checks, and a 20-file i18n pack with no harness files.
- No runtime, public API, package version, release tag or registry state changed.
- Evidence: `docs/engineering/MIGRATION-PLAN.md`; task details remain in the task owner's private journal.
