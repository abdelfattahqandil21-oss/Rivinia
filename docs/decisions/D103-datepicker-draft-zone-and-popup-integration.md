# D103 — Datepicker draft, zone and Popup integration

## 2026-11-15 — D103: Datepicker draft, zone and Popup integration

Date: 2026-11-15. Status: implemented locally; validation recorded in the private task record. No release authorized.

The owner approved combining primary Datepicker capabilities with V2 behavior,
while discussing the final compact time presentation after behavior integration.
Keep the primary civil `RiviniaDate`, `RiviniaTime` (including seconds) and
`RiviniaDateTime` contracts, locale formatting, segmented keyboard/typing controls,
and direct Forms support. V2's Sunday-based weekday convention and separate Forms
wrapper components are not adopted.

`RiviniaDateTimeDraft` is a presentation-independent signal controller. The form
owns the committed value; the controller holds only an editable draft. Reset starts
from an external value, edits affect only the draft, and `requestCommit()` validates
fresh constraints and returns a copy. Both ready UI confirmation routes (OK and
Enter) use it. Validation includes full inclusive civil bounds, malformed/inverted
bounds, disabled dates and date-specific disabled times. No clamping or implicit
commit occurs. Calendar disabled dates remain focusable but cannot be selected.

The root entry exports a replaceable synchronous timezone resolver token and
an explicit unsupported result. It reuses the richer existing Intl resolver rather
than copying V2's different result/value shapes. Custom resolvers must return the
primary resolution contract; ready UI formatting still expects Intl-compatible
zones. The existing compatible DST default stays; optional `explicit` confirmation
requires choosing an overlap offset and correcting a gap. Unsupported resolution
blocks confirmation. This is an intentional behavior correction: the previous UI
could commit a civil value despite a configured invalid zone without an instant.

The UI entry depends on the existing shared Popup package. Native panels delegate
nested/topmost dismissal, touch intent and anchor clipping to `connectPopup`.
Datepicker retains its one-active-picker registry, CSS anchor positioning where
available, native top-layer lifetime, draft discard, focus return and exit motion.
The non-popover fallback retains outside-pointer dismissal. Popup does not depend
on Datepicker. Root/core FESM must stay free of Popup/UI/Forms runtime imports.

No version, tag, publish or final time redesign belongs to this change. No new
Forms entry is introduced. Compact editable time, a button opening a time panel,
standalone time Forms controls and template directives remain presentation work,
not capabilities claimed by this integration.


## Owner-directed panel confirmation and adjacent dates

The owner requested Now/OK inside panels for date as well as time, and quieter
neighbouring dates. Date-only ready UI now defaults to explicit confirmation:
calendar selection/Now changes its draft, OK commits, dismissal discards, and a
reopen starts from the form value. This is a deliberate major-release behavior
change; `commitMode="immediate"` retains original selection/auto-close. Forms tests
exercise the new confirmation path. Trigger/optional clear composition is retained.

Ready calendars opt into neighbouring days through `showOutsideDays` (default true
on the calendar component). Core `buildMonth` keeps its null-padding default for
compatibility. Outside days carry an optional `outside` marker, muted text tokens,
real accessible names and normal bounds/keyboard selection. Unsupported years stay
blank. Clicking an adjacent day moves focus to its month before confirmation.
