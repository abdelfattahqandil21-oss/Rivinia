# D104 — Datepicker clear, editable date segments and nested time tray

## 2026-11-16 — D104: Datepicker clear, editable date segments and nested time tray

Date: 2026-11-16. Status: implemented locally; validation recorded in the private task record. No release authorized.

Clear is an immediate value operation in the date and date-time panels. It emits
`null`, clears the selected calendar day, closes the panel and restores focus to
the trigger. Apply remains for confirming a non-empty draft; Clear is not staged
as a draft action.

The date and date-time field render editable, borderless segments in the exact
order supplied by the effective date format. Segment boundaries remain inside
the field's single border. Numeric and localized month segments parse to a valid
civil date before updating the model; incomplete edits do not write partial
dates. Two-digit years in `yy` resolve into the 2000s. The component owns the
segment inputs so its existing format, locale, disabled and Forms contracts
remain authoritative.

The time option tray is a nested popup anchored to the clock control. Use the
native top layer where supported and Popup's fixed positioning and parent-aware
dismissal so the tray can escape panel overflow. Escape closes the tray first;
the next Escape closes the date/date-time panel. Browsers without the Popover API
retain the fixed-position Popup path.

No public entry point, package version, tag or publication is authorized by this
decision. The consumer lab uses an exact local tarball and records its integrity.
