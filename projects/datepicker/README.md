# @rivinia/datepicker

[![npm version](https://img.shields.io/npm/v/@rivinia/datepicker.svg)](https://www.npmjs.com/package/@rivinia/datepicker)
[![license](https://img.shields.io/npm/l/@rivinia/datepicker.svg)](https://www.npmjs.com/package/@rivinia/datepicker)

A headless Gregorian date and time picker for Angular, with an optional ready-made UI.

Package version: **1.0.4**

```ts
import { Component, signal } from '@angular/core';
import { RiviniaDatepickerComponent } from '@rivinia/datepicker/ui';
import type { RiviniaDate } from '@rivinia/datepicker';
@Component({
  selector: 'app-flight-date',
  imports: [RiviniaDatepickerComponent],
  template: '<rv-datepicker [(value)]="date" locale="en-GB" format="dd/MM/yyyy" />',
})
export class FlightDateComponent {
  readonly date = signal<RiviniaDate | null>(null);
}
```

## Unreleased integration

The ready-made controls retain their civil values and direct Angular Forms contract.
Date/time confirmation now uses `RiviniaDateTimeDraft` from the core, enforcing
inclusive date **and time** bounds and `disabledDate` / date-specific `disabledTime`.
An unavailable draft stays editable but cannot be confirmed by OK or Enter.

```html
<rv-datetimepicker
  [(value)]="appointment"
  [min]="earliest"
  [disabledTime]="isUnavailable"
  timeZone="Africa/Cairo"
  zoneCommitPolicy="explicit"
/>
```

`zoneCommitPolicy="compatible"` keeps the previous DST policy. `explicit` blocks
nonexistent wall times until corrected and requires an offset choice for overlaps.
Unsupported zones/resolution block confirmation in both modes. Override
`RIVINIA_TIME_ZONE_RESOLVER` to provide another synchronous resolver returning the
same `RiviniaZoneResult`; the controls continue to use Intl-compatible zone names
for formatting. The default resolver uses the existing Intl algorithm.

The UI uses `@rivinia/popup` for connected native panels; the core has no Popup/UI
imports. Exit animation, draft discard, panel exclusivity and focus restoration
remain the Datepicker's responsibility. No `/forms` entry or wrapper is required.
Date-only controls now also use explicit confirmation by default: picking a day
edits the draft; OK commits it, while Cancel discards it.
Clear stages a null draft for both pickers. OK commits it and Cancel discards it. Set
`commitMode="immediate"` to retain the original date-only auto-close behavior.
Date values are editable as borderless, format-ordered segments inside the field;
custom patterns such as `dd:MM:yyyy` and `yy:dd:MM` keep their token order. A
subtle hint below date and date-time fields shows the active date format and
updates when `format` or the configured locale changes. The
time row's option tray is a nested Popup panel, so it can escape clipping and
Escape dismisses only the tray before the date panel.
Date/time controls share a compact panel footer for Clear (icon with tooltip),
Cancel and OK; the embedded time row hides its own footer while remaining
independently usable with its default actions.
The hour, minute, and optional second controls are text inputs with numeric
keyboards, spinbutton semantics, direct two-digit entry, and keyboard stepping.
With 12-hour display, the hour input accepts 1–12 and the adjacent AM/PM control
sets the period; the stored `RiviniaTime.hour` remains 0–23.
The ready calendar shows muted neighbouring days; headless `buildMonth` retains
null padding unless `showOutsideDays` is enabled. The time-row layout is retained
pending the separate compact-time design review.

## Why @rivinia/datepicker

- Civil Gregorian date/time values keep zone conversion explicit.
- One controller supports the ready-made picker or custom rendering.
- Locale formatting, keyboard navigation, RTL, and Angular forms are built in.

## Install

```bash
npm install @rivinia/datepicker
```

## Quick start

1. Install the package and import `RiviniaDatepickerComponent`.
2. Bind a `RiviniaDate | null` signal to `[(value)]`.
3. Render the field and select a date.

## Two ways to use it

| Ready-made UI            | Headless controller   |
| ------------------------ | --------------------- |
| `@rivinia/datepicker/ui` | `@rivinia/datepicker` |

The UI and controller are independent; use either or combine them.

## Compatibility

| Angular   | Node                               | Browser verification                             |
| --------- | ---------------------------------- | ------------------------------------------------ |
| `^22.0.0` | `^22.22.3 or ^24.15.0 or >=26.0.0` | Chromium and Firefox; native Safari not verified |

## Go further

| Topic                      | Read                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                   | [Overview](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/overview.md)                     |
| Picker layout and widths   | [Picker layout and widths](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/layout.md)       |
| Install                    | [Install](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/installation.md)                  |
| API reference              | [API reference](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/api.md)                     |
| Quick start                | [Quick start](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/quick-start.md)               |
| Formatting dates and times | [Formatting dates and times](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/formatting.md) |
| Headless usage             | [Headless usage](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/headless.md)               |
| Forms                      | [Forms](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/forms.md)                           |
| Keyboard and RTL           | [Keyboard and RTL](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/keyboard-and-rtl.md)     |
| Theming                    | [Theming](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/theming.md)                       |
| Accessibility              | [Accessibility](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/accessibility.md)           |
| Scope and limits           | [Scope and limits](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/scope-and-limits.md)     |
| Date and time              | [Date and time](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/date-and-time.md)           |
| Time zones and DST         | [Time zones and DST](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/time-zones-and-dst.md) |
| Design notes               | [Design notes](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/datepicker/v1.0.4/docs/datepicker/design-notes.md)             |

### Brand colors and scoped overrides

Load the Theme stylesheet and set semantic tokens on the project root or the
nearest themed container. Each picker and its popover inherit that scope.

```css
[data-rv-theme='light'].booking-brand {
  --rv-color-primary: #6542b5;
  --rv-color-on-primary: #fff;
  --rv-color-focus: #6542b5;
}

[data-rv-theme='dark'].booking-brand {
  --rv-color-primary: #bcabff;
  --rv-color-on-primary: #20133d;
  --rv-color-focus: #bcabff;
}
```

Theme defaults are in the `rivinia-theme` layer. Normal unlayered declarations
on the same scope take precedence. A nested theme scope can set its own
tokens. For picker-only changes, set the documented component token on the
picker host. This works with plain CSS and framework adapters through the same
custom properties, without requiring `!important`.

The panel editor uses the active date format. Today selects the current date
as a draft in confirmation mode. Clear stages a reset. Both pickers emit `applied` with `{ value, changed }` on successful confirmation, including when the value is unchanged.

### Standalone time picker

Import `RiviniaTimepickerComponent` from `@rivinia/datepicker/ui`, then use
`<rv-timepicker label="Departure time" [(value)]="departureTime" />`.
The model is `RiviniaTime | null` and supports Signal Forms through
`FormValueControl`. It supports `min`, `max`, `disabledTime`, `required`,
`readonly`, `disabled`, `clearable`, `timeFormat`, `hour12`, `showSeconds`,
`minuteStep`, `locale`, `labels`, `label`, `placeholder`, and `theme`.
The panel stages changes until OK and Cancel discards the draft. The instance
commands are `open`, `close`, `toggle`, `focus`, `apply`, `clear`, and `cancel`.
Outputs include `valueChange`, `applied`, `openedChange`, `cancelled`, and `touch`.
The time picker inherits scoped theme tokens and exposes `--rv-timepicker-width`.
