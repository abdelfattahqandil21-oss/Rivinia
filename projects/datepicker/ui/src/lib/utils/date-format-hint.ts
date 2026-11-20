import { isDateStyle, parseDatePattern } from '@rivinia/datepicker';
import type { RiviniaDateFormat } from '@rivinia/datepicker';

/** A compact, editable-field hint that mirrors the active display format. */
export function dateFormatHint(locale: string, format: RiviniaDateFormat): string {
  if (!isDateStyle(format)) {
    return parseDatePattern(format)
      .map(({ token, value }) => {
        if (token === null) return value;
        if (token === 'M' || token === 'MM') return token.toUpperCase();
        if (token === 'MMM' || token === 'MMMM') return token;
        if (token === 'd' || token === 'dd') return token.toUpperCase();
        if (token === 'yy' || token === 'yyyy') return token.toUpperCase();
        return token.toUpperCase();
      })
      .join('');
  }

  const parts = new Intl.DateTimeFormat(locale, {
    dateStyle: format,
    calendar: 'gregory',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(2026, 10, 23, 12)));

  return parts
    .map(({ type, value }) => {
      if (type === 'month') return value.length <= 2 ? 'MM' : value.length <= 4 ? 'MMM' : 'MMMM';
      if (type === 'day') return 'DD';
      if (type === 'year') return value.length <= 2 ? 'YY' : 'YYYY';
      if (type === 'weekday') return value.length <= 3 ? 'EEE' : 'EEEE';
      return value;
    })
    .join('');
}
