# Changelog

## 2.0.0-alpha.1

- Add standalone TimePicker and explicit Clear confirmation with typed applied events.

## Unreleased — integration (version undecided, not published)

- Share civil date/time draft validation between custom rendering and the ready UI;
  enforce full min/max, disabled dates and date-specific disabled times on commit.
- Add replaceable zone resolution with an explicit unsupported result and opt-in
  explicit DST confirmation. The compatible DST default remains unchanged;
  unsupported zone confirmation is now blocked rather than emitting no instant.
- Connect native Datepicker panels through `@rivinia/popup` for nested dismissal,
  touch intent and fully clipped anchor handling; retain picker focus/exit ownership.

- Date-only UI now defaults to explicit confirmation with Now/OK inside the
  panel; `commitMode="immediate"` retains original auto-close selection.
- Ready calendars show muted neighbouring dates with full focus/selection support;
  headless month construction retains opt-in outside days and valid-year limits.
- Make Clear immediately write `null` and close date/date-time panels; add
  borderless, format-ordered editable date segments in the field;
  promote the nested time option tray so it escapes panel clipping and dismisses
  before its parent on Escape;
  add Today/Apply labels with Arabic defaults, a shared date-time action footer,
  and a leading calendar/clock icon with an animated disclosure chevron.
- Keep typed time digits visible while a field is focused so two-digit entry is
  reliable; retain the canonical formatted value on blur and Enter. Preserve
  accessible Apply contrast on hover in both color schemes.

## Earlier unreleased fixes

- Keep date-only style, pattern and weekday formatting stable when the host
  timezone skips a civil date; the local `Date` bridge remains explicitly
  host-local.
- Reject impossible civil dates through calendar selection and keep navigation
  inside the supported year range 1–9999.
- Keep disabled dates keyboard-focusable when min/max bounds are configured;
  bounds synchronization no longer reruns on each focused-day change.
- Keep the non-modal panel open when month navigation temporarily removes the
  focused cell; close it only if focus remains outside after render.
- Restore configured bounds when runtime min/max inputs return to `undefined`,
  and clear stale input bounds when neither source provides a value.

## 1.0.4

- Update published internal dependency metadata and version-pinned documentation links for the synchronized Rivinia 1.0 patch. No public API changes.

## 1.0.3

- Correct package repository, documentation, homepage, and issue links after the GitHub repository rename.

## 1.0.2

- No package-specific consumer changes; version synchronized under the Rivinia 1.0 release group.

## 1.0.1

- Documentation: README restructured into docs/datepicker/ pages; stale pre-1.0 wording removed.

## 1.0.0

- First stable release of the calendar and wall-time picker APIs, including the documented IANA time-zone and daylight-saving behavior.
- Close date and date-time panels when keyboard focus leaves the control, without stealing focus from its new target.
