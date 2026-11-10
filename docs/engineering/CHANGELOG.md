# Repository engineering changelog

**Owner:** Rivinia maintainers
**Purpose:** dated record of repository architecture and workflow changes, separate from npm package histories.

## 2026-11-10 — Phase D5 i18n correctness audit (in progress)

- `RiviniaI18n` now guards async and synchronous locale activation with a
  per-instance switch-intent generation. A newer request for the visible
  locale supersedes older pending activations; deferred view-transition
  callbacks check at commit time, and only the winning locale is persisted.
  `DictionaryStore` retains dictionary loading, in-flight deduplication and
  cache ownership. A production-built consumer reproduces delayed Arabic
  response versus a later English intent and checks visible text, direction
  and persistence.
- Strict ISO date-only ICU inputs now use a year-safe UTC carrier and UTC
  formatting, preserving civil date, year and weekday across host zones,
  including Pacific/Apia 2011-12-30. Date-time, `Date` and epoch inputs keep
  instant/runtime-timezone semantics. Arabic plural tests compare rendered
  branches with `Intl.PluralRules` at category boundaries.
- Evidence: i18n unit suite 406/406; ICU 60/60 under UTC, America/Los_Angeles
  and Pacific/Apia; production i18n and CSR consumer builds; Chromium+Firefox
  consumer matrix 66/66; SSR/hydration/request-isolation smoke 40/40;
  `check:docs` 0 failures / 40 prose warnings; `git diff --check` clean.
  WebKit and physical assistive technology remain unverified.
- No public API, package dependency, version, tag, release, or registry state
  changed. Worktree is `/media/abdelfattahqandi/OWN/libs/Revinia-i18n-correctness`;
  focused local commits and reviewer acceptance are pending.

## 2026-11-10 — Datepicker correctness audit (in progress)

- Civil date formatting now uses a UTC carrier and UTC `Intl` formatting, so a
  timezone with a skipped local civil day cannot silently advance the displayed
  value. The public `toLocalDate()` remains a host-local bridge and its
  normalization behavior is documented. Pacific/Apia 2011-12-30 reproduced the
  previous shift; style and pattern formatters now preserve the input date.
- Calendar selection rejects invalid civil dates through the public controller
  boundary, and day/month/year navigation stays within supported years 1–9999.
- A production-built Angular consumer exposed a reactive tracking defect: the
  min/max input effect tracked calendar focus through `setBounds()`, so moving
  onto a disabled date immediately reset focus. The bounds update now runs
  untracked; disabled dates remain keyboard-focusable while commits stay
  blocked. Unit regression and Chromium/Firefox consumer checks pass.
- A real Chromium keyboard run exposed a second focus defect: replacing the
  focused day cell on PageDown produced `focusout` with no `relatedTarget`, and
  the non-modal host closed before focus restoration. The host now defers only
  this ambiguous null-target close until focus restoration completes. Built
  consumer checks for PageDown, Shift+PageUp, Home/End and Escape pass in
  Chromium and Firefox.
- Added an opt-in Reactive Forms section to the production-built Angular
  consumer. Programmatic writes update the trigger and open month without
  dirtying/touching the control; selecting a day updates the FormControl and
  marks it dirty/touched in Chromium and Firefox.
- Year-safe formatting regressions cover 1, 4, 99, 100, 1900, 2000 and 9999
  through both `Intl` styles and custom patterns. An actual plain-Node Angular
  SSR render of a year-25 date passed with no browser globals; the UTC carrier
  uses `setUTCFullYear`, avoiding the constructor's 0–99 year remapping.
- The built consumer exposed stale range state after both dynamic min/max inputs
  returned to `undefined`. The bounds effect now reapplies configured
  fallbacks, or clears stale bounds when neither source supplies one. Expansion
  and clearing both pass in Chromium and Firefox.
- D4 remains active; lifecycle, form and remaining consumer checks are pending.

## 2026-11-10 — Phase D2 Table query/pagination composition (in progress)

- Ownership map: Table builds stable row IDs, applies client filtering/search
  unless `manualFiltering`, applies client sorting unless `manualSorting`, then
  slices unless `manualPagination`; spans consume `pageRows`. `request()` is a
  serializable description only. The consumer owns fetches, loading and
  out-of-order response policy; Table has no HTTP request lifecycle to cancel.
- Built-package consumer RED: on client page 2 at size 2, changing to size 3
  left `page` at 2, producing an empty page and hiding the previously visible,
  selected row. Client page-size changes now preserve the previous first row
  when possible and clamp to the last known page. Manual pagination restarts
  at page 0 rather than assuming offset-based server paging.
- Built-package consumer RED: shrinking a six-row client result to three rows
  while on page 2 left the page out of range and empty. Client pagination now
  clamps to page 1, while manual pagination remains consumer-owned.
- Built-package consumer RED: a custom comparator returning `NaN` stopped
  multi-sort before the next key, leaving rows in input order. Sorting now
  treats `NaN` as a tie, matching `Array.sort`, and evaluates the next key.
- Pagination boundary checks: switching manual pagination to client mode exposed
  a second mismatch (`null` prior count to known client count), leaving an
  invalid page untouched. Client mode now clamps on that transition; simultaneous
  query, size and data changes prioritize the query reset.
- Added built-output consumer coverage for page-size changes with selection and
  rendered ARIA positions, controlled response reordering (newer response wins
  even when the older response resolves later), and an empty server response
  replacing prior rows, plus custom-comparator ties and pagination mode changes.
  Core coverage combines sort/filter/page/selection restore, null/undefined and
  locale sort behavior, query-reset precedence under simultaneous updates, and
  manual transformation ownership. The full Table suite passes 242/242.

## 2026-11-10 — Phase D Table audit (in progress)

- D3 real-browser focus audit reproduced a lost-focus defect when a consumer
  sorts, pages or replaces row objects while a grid cell is focused. The UI now
  captures cell focus before the row render changes and restores its roving
  coordinate after render. Chromium and Firefox verify focus and exactly one
  roving cell after each update; keyboard checks cover duplicate IDs, projected
  native buttons, Enter/Space, and RTL horizontal movement.
- Added a production-built consumer integration for Table with Select page size,
  Datepicker date filtering and saved-view restore. Repeated create/destroy
  cycles for these open controls return document/window listener counts to the
  initial baseline. The listener audit covers those specific global events, not
  every possible retained object or browser resource.
- Recorded a five-sample production consumer baseline on 10,000 generated rows
  and a 50-row page. Across Chromium 156 / Firefox 157, sort core medians were
  3.9/7 ms, filter 12.1/12 ms, page and selection 0/0 ms; replacing objects
  cost 3/4 ms median. Sorting and replacement read 10,000 accessor values;
  page and selection read none. Browser interaction medians ranged 71.7–87.9 ms
  in Chromium and 75–115 ms in Firefox. These are local medians with max-of-five
  tails, not percentile guarantees; no compute optimization was indicated.
- The browser harness renders 571 DOM nodes for one header plus 50 data rows.
  WebKit and assistive-technology coverage remain unavailable in this run.

- Reproduced a selection integrity defect with a manual-pagination controller:
  selecting row ID `1`, replacing the loaded page with IDs `3–4`, then returning
  to IDs `1–2` lost the selection because selection pruning treated an unloaded
  page as a removed row. The same flaw dropped excluded IDs after page changes.
- `manualPagination` now retains selection IDs outside the loaded page; IDs
  exposed by `selection.ids()` remain limited to loaded rows. Client-mode
  pruning remains intact. RED was 210/211 tests before the correction; GREEN is
  212/212 after adding include/exclude page-replacement regressions.
- A second independent RED found that `selectAll()` with an empty exclusion set
  serializes identically to an empty include set, so restoring `TableState`
  lost “select all.” Reviewer-approved additive optional `TableState.selectionMode`
  now disambiguates both empty states; `state()` emits it, `setState()` and
  `initialState`/`resetState()` honor it, and malformed runtime values warn and
  fall back to legacy array inference. Legacy snapshots without the field keep
  their old behavior; an old empty/empty snapshot is inherently ambiguous.
- Scope ownership is explicit for manual paging: Table retains IDs when a page
  slice changes, but cannot infer tenant/query-scope changes from array
  replacement. Consumers can use the existing `selection.clear()` on scope
  changes. A built-package Angular consumer regression exercises this behavior.
- Reviewer-requested Select architecture documentation now clarifies that the
  component is a button/menu pattern (no combobox/listbox role), uses DOM focus
  with one roving row tab stop, and keeps projected controls as siblings; it
  links the plain-button/input accessibility-tree and keyboard tests.
- Exact `@rivinia/table` public imports cover the selection state mode and
  manual-page restore matrix. The production row-identity audit found and fixed
  loss of include/exclude decisions while an ID is temporarily duplicated;
  duplicate rows stay visible and disabled. Development rejects duplicate IDs
  before effects, while a production-mode package smoke checks unique →
  duplicate → unique transitions.
- The built consumer exposed repeated `aria-rowindex` values on server-loaded
  pages (RED: 219 passed, 1 failed). `getRowIndex(row)` now carries exact,
  potentially noncontiguous ordinals; unknown row positions omit the index and
  unknown result/page counts use `-1`. The built consumer covers subsequent
  pages, a partial final page, noncontiguous rows and unknown totals. Current
  package result is 226/226 after the fix; a separate production-mode identity
  smoke verifies duplicate-ID retention and bulk-action gating.
- Real-browser D1 follow-up: Chromium and Firefox confirmed header-inclusive
  counts and noncontiguous absolute ordinals. Unknown positions now use explicit
  current-page-only row counts/local indices with a screen-reader description;
  known ordinals with unknown totals retain `aria-rowcount=-1`. A browser RED
  showed duplicate ordinals produced duplicate `aria-rowindex` values; core now
  rejects duplicate or out-of-order positions in development and uses
  current-page-only row indices in production when the supplied order is invalid.
- Browser interaction check: duplicate IDs still block selection and row
  activation, while a projected action using row data remains available.

## 2026-11-10 — Phase C4 cross-environment and SSR confidence

- Re-ran the accepted Popup, Select, Menu and overlay-lifecycle matrix: Chromium
  115 passed / 1 conditional skip; WebKit 116/116; Firefox 111 passed / 5
  skipped. Firefox skips four mobile scroll/drag cases because Playwright does
  not support `isMobile` for Firefox; one additional existing case is
  WebKit-only. Firefox desktop scroll, keyboard, RTL, outside-touch dismissal
  and Select footer semantics passed. Playwright documents the `isMobile`
  platform limitation in its [Browser API](https://playwright.dev/docs/api/class-browser).
- Chromium and WebKit ran all mobile emulation cases. Firefox mobile diagnostics
  showed `innerHeight` (891) diverging from the configured 664px viewport while
  `isMobile` was enabled, and scroll positions reverted; desktop Firefox uses
  the intended 664px viewport. This is an emulation limitation, not evidence
  that the library's mobile behavior fails in Firefox.
- Extended `check:popup-ssr` from Popup/Select/Menu coverage to Modal and Toast:
  a requested-open Modal stays closed without browser APIs, and Toast renders
  its accessible status region without promotion into a browser popover. All
  19 SSR assertions passed, including the expected negative control. Popup,
  Modal, Toast, Select and Menu unit results are 12/12, 56/56, 35/35, 166/166
  and 66/66 respectively (see the focused C3 entries for earlier package runs).
- Corrected the WebKit focus fixture's expected preceding navigation link after
  the overlay-lifecycle route was added. This was a stale test expectation;
  no product behavior changed in C4.
- `pnpm check:docs` reports 0 failures and 40 existing prose warnings. The
  Toast static fallback is structurally guarded and its enhanced Chromium
  computed colors passed the recorded contrast matrix, but a genuinely
  unsupported `color-mix()` engine remains unavailable. Real Safari/iOS,
  assistive-technology testing and physical-device checks also remain open.
- No public API/export or production behavior changed in C4. Local verification
  and commits only; no push, merge, release, tag or version change.

## 2026-11-10 — Phase C3 Select projected-control keyboard ownership

- RED in the built `menu-e2e` consumer: Enter on a Menu trigger projected into
  the Select footer was canceled by Select's parent handler, and ArrowDown in
  the child Menu moved focus to a Select option. Tab from the active Select row
  also skipped the interactive footer.
- Select now yields all keys from a nested menu to that menu, keeps footer
  activation and navigation native, and retains its existing projected-input
  arrow routing plus searchbox Enter behavior. Tab/Shift+Tab traverse the
  filter, active option and footer in sequence; focus leaving the popup closes
  it after the browser completes the focus transition. Public Select keyboard
  documentation and its proposed 1.1.0 changelog now record this behavior.
- Built-consumer coverage asserts trigger `aria-haspopup`/`aria-expanded`/
  `aria-controls`, named rows-only menu semantics, sibling footer relationship,
  absence of `aria-activedescendant`, axe, child Enter/Space/arrow/Escape, and
  forward/reverse Tab movement. The actual model is a menu button (`button` →
  `menu`), not a combobox: Chromium's CDP accessibility tree exposes the
  projected footer action and input as independent controls outside the menu.
  Only the roving active menu item is tabbable; the searchbox and footer
  controls are separate sequential stops. This is consistent with the Menu
  Button APG's DOM-focus approach, with the documented search/filter and
  footer extension. Screen-reader behavior remains unverified. RED/GREEN
  consumer evidence and Select unit tests (166/166) preserve the existing
  projected-input ArrowDown contract.
- The shared resize conformance now records platform `visualViewport:resize`
  events as well as scroll visibility; Chromium emitted that actual event for
  height and width changes across Select, Menu and projected-field Menu.

## 2026-11-10 — Phase C1 Toast contrast measurement follow-up

- Corrected the computed-color parser to handle Chromium's normalized
  `color(srgb …)` result instead of treating channels in the 0–1 range as
  0–255. The built-artifact test now reports the minimum across all four
  statuses and every message, action/dismiss label, icon and focused control:
  standalone 8.21:1, Theme light 8.21:1, Theme dark 5.10:1. All stated WCAG
  thresholds pass.
- The static Toast-owned `background` pairs remain outside a positive
  `@supports (background: color-mix(...))` block; enhanced assignments are
  only inside that gate. A PostCSS structural regression asserts the fallback
  and four guarded status rules. Chromium's enhanced computed colors still
  pass standalone and Theme light/dark contrast tests. This environment has no
  engine that actually lacks `color-mix()`, so real legacy-engine computed
  rendering remains unverified; a Chromium runtime flag did not disable the
  feature and was not treated as evidence.

## 2026-11-10 — Phase C3-C semantic gate and Toast fallback

- Confirmed the Select's shipped accessibility model from source, its consumer
  DOM and Chromium CDP accessibility tree: the trigger is a menu button, not a
  combobox; `aria-controls` targets the named `role="menu"`; focus moves onto
  the active menu item and roving `tabindex` leaves one menu-row Tab stop. The
  searchbox, projected button/input and child Menu are separate siblings of
  the option menu. This follows the APG menu-button DOM-focus approach with a
  documented filter/footer focus-order extension; no screen reader was
  available for assistive-technology confirmation.
- Expanded the real consumer fixture with a plain footer button and labeled
  input. Chromium CDP confirms both are exposed independently outside the menu;
  keyboard checks prove their Enter/Space/arrow handling does not change the
  selected row, and Tab traverses filter → active row → nested Menu trigger →
  footer button → input → next page control. Tab from the nested Menu closes
  that child, keeps Select open while focus remains in its footer, then closes
  Select after focus exits. Exactly one Select option has `tabindex="0"`.
- Guarded Toast's enhanced `color-mix()` backgrounds with a positive
  `@supports` block. Four accessible static pairs remain outside it. Added a
  PostCSS structural regression that requires all four fallbacks and guarded
  enhancement rules. This proves stylesheet structure and Chromium's supported
  branch; a genuinely unsupported engine is still unavailable, so legacy
  computed rendering remains unverified.
- Final verification: Select/Menu/Toast package builds and menu-e2e plus both
  Toast consumer builds passed; Select unit tests 166/166 and Menu 66/66;
  Toast standalone E2E 3 passed/1 conditional skip and Theme E2E 3 passed/1
  conditional skip. The final Chromium Popup/Select/Menu/overlay matrix passed
  115 with 1 existing conditional skip and 0 failures. The PostCSS fallback
  test passed 1/1. `pnpm check:docs` reported 0 failures/40 existing prose
  warnings; Prettier and `git diff --check` passed. Firefox/WebKit, SSR,
  device testing and screen readers remain unverified.
- Local commits: `ded54cb` Select keyboard/focus correction, `04c4e76` consumer
  accessibility regressions, and `3aed098` Toast feature gate/fallback test.
  No public API/export change, push, merge, tag, version bump or release.

## 2026-11-09 — Phase C3 anchored-popup event ownership

- RED in the built `menu-e2e` consumer: Escape inside a Menu projected into a
  Select footer closed both the Menu and its parent Select, and focus fell back
  to the Select trigger. Select's key handler consumed the same bubbling Escape
  after the child Menu had already called `preventDefault()`.
- Select now respects a canceled Escape specifically. Other keys keep the
  existing Select contract: projected controls may prevent an arrow key while
  Select still routes it to its active row. Menu already honors canceled key
  events. No Popup core changes or global overlay stack were needed.
- Added a consumer regression proving the child closes and regains focus first,
  the parent stays open, and a second Escape closes the parent. Added a Menu
  nesting control plus shared conformance coverage for a pointer gesture that
  starts inside and ends outside; extended owner-destroy coverage to include a
  pending reposition frame.
- GREEN: `pnpm exec ng build select`; `pnpm exec ng build menu-e2e`;
  `pnpm exec ng test select --no-watch` (166/166); focused nested Escape
  consumer tests (2/2); owner-destroy cleanup tests (3/3); combined Popup,
  Select and overlay lifecycle Chromium suites (64/64). A prior combined run
  exposed an existing RTL geometry check racing the panel entrance animation;
  the test now waits for that animation to finish and retains its 1px geometry
  assertions. Firefox and WebKit were not run.

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
