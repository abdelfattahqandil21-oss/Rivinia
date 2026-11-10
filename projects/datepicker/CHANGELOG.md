# Changelog

## Unreleased — proposed synchronized 1.1.0 (not published)

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
