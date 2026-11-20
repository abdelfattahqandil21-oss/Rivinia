import type {
  RiviniaBuildMonthInput,
  RiviniaCalendarCell,
  RiviniaCalendarMonth,
  RiviniaCalendarWeek,
} from '../models/calendar-types';
import { addDays, daysInMonth, isSameDay, isValidDate, weekdayOf } from './date-math';

/**
 * Build the six-by-seven grid for one month.
 *
 * Always six rows. Headless callers keep null padding by default; ready UI
 * may opt into neighbouring days, marked `outside` for muted styling.
 */
export function buildMonth(input: RiviniaBuildMonthInput): RiviniaCalendarMonth {
  const { year, month, firstDay, isDisabled } = input;
  const today = input.today ?? null;
  const selected = input.selected ?? null;
  const focused = input.focused ?? null;

  const total = daysInMonth(year, month);
  const lead = (weekdayOf({ year, month, day: 1 }) - firstDay + 7) % 7;

  const weeks: RiviniaCalendarWeek[] = [];

  for (let row = 0; row < 6; row++) {
    const cells: (RiviniaCalendarCell | null)[] = [];
    for (let column = 0; column < 7; column++) {
      const index = row * 7 + column;
      const offset = index - lead;
      const outside = offset < 0 || offset >= total;
      const date = addDays({ year, month, day: 1 }, offset);
      if ((outside && !input.showOutsideDays) || !isValidDate(date)) {
        cells.push(null);
        continue;
      }
      cells.push({
        date,
        ...(outside ? { outside: true } : {}),
        today: isSameDay(date, today),
        selected: isSameDay(date, selected),
        focused: isSameDay(date, focused),
        disabled: isDisabled ? isDisabled(date) === true : false,
      });
    }
    weeks.push({ cells });
  }

  return { year, month, weeks };
}
