## 2026-11-15 — D102: Connected panels and staged V2 integration
Status: Owner-approved; local implementation verified, release preparation pending.

The owner approved the recommended integration of Popup, Menu and Select from V2 into the primary repository. Popup lands first, followed by Menu, then Select.

A per-Document dismissal coordinator is permitted for connected panels. This supersedes D95's prohibition on shared registries only for connection ownership and ordered dismissal. It must release listeners when its final connection is destroyed; the Document is held through a WeakMap. Focus, markup, semantic open state and styling remain consumer-owned.

D99 touch semantics remain authoritative: mouse/pen outside presses dismiss immediately; touch dismissal waits for a short tap and cancels on movement or pointer cancellation. Connected panels detect full clipping by viewport and overflow ancestors. Logical children may render outside their parent's DOM subtree. The coordinator consumes one Escape for the eligible top popup.

Compatibility: existing positional computePopupPosition and bindPopupDismissal exports remain available. The options-object geometry helper is exported as computeConnectedPopupPosition; connectPopup and PopupPanelDirective are additive. Menu and Select native-popover adapters use the shared connection while retaining their host positioning/focus policies; the no-popover fallback retains the original binding. Popup itself does not own host width, popover visibility, focus restoration or CSS anchor positioning.

Menu integration must retain the short [items] API and add template definitions and optional router integration on one behavior engine. Select integration must retain row/list templates and Arabic search normalization while adopting stable value identity, forms composition and optional virtual rendering. Versions and publication are outside this implementation task.

Required evidence: Popup unit/build gates; real browser clipping, portal child containment, touch tap/drag, topmost Escape, cleanup and SSR; then dependent Menu/Select characterization and package/consumer gates. Not-run gates must not be reported as passed.

## Shared controller integration, 2026-11-15

The original `RiviniaMenu` and `RiviniaSelect` APIs now delegate to the incoming
MenuController and SelectController rather than maintaining separate registries
and selection/filter algorithms. The original menu's disabled-row skipping is an
explicit engine policy; composed menus retain focusable disabled rows. The original
Select facade retains ID values and pruning on removal, while generic Select retains
unloaded values. Both use the primary package's Arabic/accent search normalization.

Compatibility review: `RiviniaMenu.open` and `activeId` now expose readonly Signals.
Direct `.set()` calls must migrate to openMenu/closeMenu/activate methods in the
planned major release. Select retains its WritableSignal types through linked
signal views whose writes delegate to the shared engine. Its documented controller
interface is unchanged. The original ready-made Select keeps its menu-style focus
semantics; the additional combobox presentation and its Popup/virtualization
integration are described below. This local validation does not authorize release.

## Presentation and Popup integration

Menu and Select native-popover hosts now use connectPopup with host-owned positioning,
auto parent discovery and width-change dismissal. This retains D99 and CSS anchor
policies; the existing bindPopupDismissal path is reserved for the no-popover fallback.
The connection API exposes a position callback and optional closeOnWidthChange policy.

The composed Select ready-made presentation is exported as RiviniaSelectComboboxComponent
(`rv-select-combobox`) in the existing /ui entry. Its listbox/activedescendant behavior
is distinct from the existing rv-select's filterable menu pattern; existing callers
are not silently switched between these focus models. Both share SelectController.
The original component retains optionTemplate/listTemplate; custom combobox layouts
use the headless directives and shared SelectPanelDirective. The new presentation
includes scoped token-based styles and fixed-row virtual scrolling, with no CDK.

## Verification scope

Production builds cover Popup, Menu (including /router), Select (including /headless
and both /ui presentations), and the shared browser harness. Unit gates passed:
Popup 38, Menu 66, Select 167. Browser coverage includes current-host focus/content
contracts and popup lifecycle, composed Menu actions/links/checkboxes, virtualized
combobox selection/scroll/width/ARIA, and Reactive, template-driven and Signal Forms.
Chromium and Playwright Firefox were exercised; skipped Firefox cases are not passes.
SSR checks include the closed combobox and deterministic ID. An exact-tarball clean
Angular consumer compiled the public entries and Menu stylesheet. The harness's
combobox route uses dynamic import and produced a separate lazy chunk.

During integration, browser tests exposed capture-phase Escape stealing a projected
control's key. The coordinator now handles Escape during bubbling and respects
preventDefault. Popup listener-ledger initialization was extended to include the new
Document listeners; cleanup assertions remain intact. Geometry checks wait for the
entrance animation to finish before comparing widths.

No Safari/WebKit, real-device touch/keyboard, or assistive-technology session was run.
This task does not bump versions, commit, tag or publish. Release approval still
requires the synchronized-major workflow and exact final release artifacts.
