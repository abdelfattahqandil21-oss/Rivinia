# Human checks — Rivinia 1.0

Everything in this file needs a person. The automated evidence lives in
`docs/testing/a11y-verification.md`; nothing here was inferred from it.

Run the checks in the order below. Each one says **what to do**, **what to look
for**, and **what result would force a change** — if you hit the last one, stop
and record it, because the code has to move, not the expectation.

## Order

1. **S2 — screen reader pass** (one row of the matrix per sitting; NVDA first).
2. **S4 — real device resize** (one phone, one tablet, portrait and landscape).
3. **S7 — Safari** (macOS Safari, current version).
4. **S8 — the soak** (a real app on the published rcs; it can only start after
   the rcs exist, which is a human step).

## How to run the demo

From the repository root, on a machine with a browser:

```bash
pnpm build select
pnpm build menu
pnpm build menu-e2e
node e2e/serve.mjs dist/menu-e2e/browser 4299
```

Then open `http://127.0.0.1:4299/select`. The page holds the fixtures the checks
name: `#single-select` (searchable, three invoices, one disabled),
`#multi-select` (two roles), `#rtl-select` (Arabic label, three rows),
`#virtual-select` (500 rows, custom list template) and `#plain-menu` (a menu with
no editable element inside — S4 needs it as the counter-case). Step 9 below is on
a different route: `http://127.0.0.1:4299/content`, where `#projected-menu` is a
menu whose panel holds consumer markup — a filter `<input>`, a `<textarea>` and a
`contenteditable` block.

---

## S2 — screen reader matrix

Pick one combination per run and tick only the cells you actually heard. The
matrix is in `docs/testing/a11y-verification.md`; its cells start at "not tested" and
only you can fill them.

### Steps (repeat per combination)

1. Focus the single select. Expect the caption and the current value, then a
   button with a popup menu that is collapsed, e.g. **"Invoice status Select…,
   button, menu, collapsed"** (wording varies per screen reader).
2. Press <kbd>Enter</kbd>. Expect the menu reported expanded, then the filter
   box focused and announced as a **search box**, not as a menu item.
3. Type `out`, then <kbd>Tab</kbd>. Expect the first remaining row focused and
   announced as a **radio button**, unchecked.
4. Press <kbd>↓</kbd> then <kbd>Enter</kbd>. Expect the pick to be announced and
   focus back on the trigger, whose name now contains the value
   ("… Outstanding invoices").
5. Reopen and arrow through the rows. Expect **three** rows, the middle one
   announced **dimmed/unavailable** and never selected.
6. Go to `#multi-select`, open it, pick two rows with <kbd>Enter</kbd>. Expect
   each row announced as a **check box**, checked/unchecked, and the picks
   listed in the trigger after close.
7. Go to `#rtl-select`, open it. Expect the three rows in the order
   **Owner, Admin, Member**, in Arabic reading order.
8. Back on `#single-select`, open it and type `zzz`. Expect the "no results"
   message to be **announced once** as it appears, not to be silent.

### Pass means

- The menu is announced as a menu; rows as radio buttons (single) or check
  boxes (multi) with their checked state.
- The filter box is announced as a search box with its own name, and typing
  into it is not announced as menu typeahead.
- The disabled row is announced unavailable and cannot be picked.
- The "no results" message is announced once when it appears, not silently.
- Focus returns to the trigger on pick and on <kbd>Esc</kbd>, and the trigger
  name contains the visible value.

### This forces a change

- **The filter box announced as content of the menu** (e.g. "menu, search box"
  with no boundary, or arrowing from the rows into the box): switch the
  searchable variant to the recorded fallback, option 3 in the D85 addendum (a
  select-only combobox + listbox with `aria-activedescendant`) — post-1.0 unless
  it blocks 1.0 for you.
- **Rows not announced as selected/checked**, or the checked state not updating
  after a pick: the `menuitemradio` decision in D85 needs revisiting before
  `1.0.0`.
- **Focus landing on `<body>`** after a pick or <kbd>Esc</kbd>: a regression in
  the focus-restore path; file it with the combination and the step number.
- **The RTL rows read in reverse order**: a DOM-order bug, not a screen-reader
  quirk.

## S4 — real device popup dismissal and viewport

**Status: not tested on a real device.** The rule is implemented and automated
(`e2e/popup/conformance.spec.ts` covers all three popup hosts and the dismissal
and viewport cases), but every one of them is Playwright moving `viewport`, not
a phone. A real device is the only place where a keyboard opening can change the viewport while
the finger is in the panel, and where the browser chrome collapses on scroll.

The policy from [D99](../../decisions/D099-popup-dismissal-and-multiselect-state.md):
height-only viewport changes reposition; width changes close. Page scroll
repositions while the trigger is visible and closes after it leaves the visual
viewport. A short outside touch tap closes; a drag does not.

### Steps (repeat per device: one phone, one tablet, portrait and landscape)

1. Open `#single-select` **by its filter box**: tap the trigger, then tap inside
   the text field. Expect the on-screen keyboard to appear.
2. Watch the panel while the keyboard opens. Expect it to **stay open**, staying
   attached to the trigger, with the rows still reachable and nothing clipped
   behind the keyboard.
3. With the keyboard still up, type `out`. Expect the rows to filter and the
   panel to stay open and correctly placed.
4. Rotate the device to landscape. If the viewport width changes, expect the
   panel to **close** and focus to return to the trigger. If only height changes,
   expect it to stay open and reposition. Record the before/after dimensions.
5. Rotate back, reopen the select, and now close the keyboard by tapping the
   panel's own row area (`← Back`/swipe-down varies). Expect no jitter, no
   panel that repositions after the fact, and no panel that closes because the
   keyboard went away.
6. Open the select, then scroll the **page** with a finger, outside the panel.
   Expect it to stay attached while the trigger remains visible, then close once
   the trigger is fully outside the visual viewport. Reopen and scroll **inside**
   the row list; expect it to stay open.
7. On iOS, repeat step 5 with the Safari tab bar: open the select and scroll the
   page down far enough for the chrome to collapse and expand. Chrome collapse
   changes the visual viewport. Expect repositioning without dismissal while the
   trigger remains visible.
8. Open `#plain-menu` and trigger a width-changing resize. Expect the menu to
   close cleanly, with no orphaned listeners: after closing, the page must scroll
   without the menu reappearing or the trigger stealing focus.
9. `/content`, the menu with a consumer filter box projected into its panel: tap
   the filter, let the keyboard open. Expect the panel to **stay open** exactly
   like the select; height-only changes no longer depend on which field has
   focus. Repeat with the note `<textarea>` and the `contenteditable` block to
   confirm they remain usable while the viewport changes.

### Pass means

- The panel survives the keyboard opening **and** survives typing under it.
- A width-changing orientation flip closes the panel once; height-only changes
  keep it open and reposition it.
- Nothing about closing leaves a listener behind: after any close, page scroll,
  tapping elsewhere and reopening all behave normally.
- Select and both menu variants follow the same resize and dismissal policy.

### This forces a change

- **The panel stays open but is clipped behind the keyboard, or is positioned
  off-screen** — the "keep it open" half of the policy is wrong for that engine.
  Record the device and browser details; placement may need a device-specific
  follow-up.
- **The panel closes on a height-only viewport change**: record device, browser,
  and version; this is the case the automated suite cannot see.
- **The panel closes and focus does not return to the trigger**, or the trigger
  is left in an expanded state: a close-path regression, file it against the
  device.
- **A width-changing rotation leaves the panel open**: report the viewport
  dimensions and browser version.

## S7 — Safari

**Status: not tested.** The automated browser matrix (S7) runs on three engines:
Chromium, Firefox and WebKit, and on 2026-11-02 they are Chromium 156.0.8078.4,
Firefox 157.0 and WebKit reporting a Safari 27.2 user agent. The floor the
library promises and the band nobody ran (Chrome 114–130, Safari 17–26.1) are in
`docs/testing/browser-support.md`. WebKit was unlaunchable on the machine this plan was
executed on (`MiniBrowser` aborted on a missing `libavif.so.16`) until that library
was installed by hand on 2026-11-01; from that date the WebKit column is measured,
not assumed. It is still **not Safari**: WebKit is the engine, macOS Safari is the
product, and the two differ in exactly the places this section looks — the address
bar and tab strip that collapse during the S4 resize steps, and the system font
metrics that move layout. Safari is also the engine that shipped `popover` first, so
the top-layer path is only fully proven there. Until this section is run, the Safari
column of the matrix in `docs/testing/a11y-verification.md` stays **not tested**, and the
one engine-specific finding the automated run did produce is recorded in
[D86](../../decisions/D086-no-popup-dedupe-before-1-0-a-conformance-suite-instead.md): WebKit lays the demo page out taller than Chromium at the same
viewport (`scrollHeight` 1221 against 1109 at 720px), which is worth your eye when
you repeat the steps on a real device.

### Steps

1. Open `http://127.0.0.1:4299/select` in current macOS Safari.
2. Open `#single-select`. Confirm the panel renders in the top layer: it must
   paint **over** the `#multi-select` trigger below it, not clipped by any
   ancestor, and the scroll under it must be inert.
3. Repeat the S4 steps 1–5 on Safari, where the address-bar and the tab-strip
   both resize the viewport.
4. Run `#rtl-select` and `#virtual-select`; the virtual list is where a
   Safari-specific `position-try`/anchor placement bug would show.
5. With "Reduce Motion" and "Increase Contrast" both on in System Settings,
   reopen the select. Nothing may become invisible or unreadable.

### Pass means

- Top-layer placement works with no fallback (Safari supports `popover`, so the
  `topLayerSupported = false` path is never taken there).
- Keyboard-open and rotation behave as S4 describes.
- RTL and the virtual list place correctly.

### This forces a change

- **The panel clipped, or under the page content**: Safari's `popover`/anchor
  positioning differs; the fallback placement code has to be reached on this
  engine, and that is a product fix, not a documentation note.
- **Any S4 step disagreeing with Chromium and Firefox**: record the version and
  revisit viewport event handling.

## S8 — the soak

**Status: cannot start yet.** The four `1.0.0-rc.1` tarballs were packed,
installed into a clean fixture from `file:` paths and everything automated passed
on them — the numbers are row 9 of
[`docs/releases/1.0/MERGES.md`](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/main/docs/releases/1.0/MERGES.md).
A fixture is not a product app: one route, no real submit flow, no browsing
history. The soak is what turns an rc into `1.0.0`, and it needs the rcs on the
registry, which is a human step.

### Steps

1. `npm install @rivinia/theme@next @rivinia/select@next @rivinia/menu@next @rivinia/i18n@next`
   in a real application.
2. Change nothing except the versions. If anything else has to change, that is the
   finding — record it rather than fixing it quietly.
3. Use it for a sitting: a searchable select, a multi select inside a
   `FormGroup`, a menu whose panel holds projected markup, a language switch into
   RTL, and a route that lazy-loads the picker.
4. Build for production and run the SSR server twice: once with
   `@rivinia/select` installed and once with it removed, because a toggle-only app
   never installs the optional peer.

### Pass means

- No new console error, no unstyled control, no throw during SSR or hydration.
- The panel still places correctly after a route change, and focus comes back to
  the trigger.
- `npm ls @rivinia/select` resolves without `ERESOLVE`, and the install still
  resolves after select is uninstalled.

### This forces a change

- **Anything at all.** A published version is never modified, so the fix ships as
  `1.0.0-rc.2` and the soak starts again. Only an rc that passed this section is
  promoted to `1.0.0` on `latest`.
