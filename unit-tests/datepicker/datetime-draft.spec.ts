import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { RiviniaDateTimeDraft, validateDateTime } from '../../projects/datepicker/src/public-api';
import type { RiviniaDateTimeConstraints } from '../../projects/datepicker/src/public-api';

const at = (hour: number, minute = 0, day = 15) => ({
  date: { year: 2026, month: 11, day },
  time: { hour, minute, second: 0 },
});

describe('civil date-time draft', () => {
  it('enforces inclusive bounds including the time, without clamping', () => {
    const bounds = { min: at(9, 30), max: at(17) };
    expect(validateDateTime(at(9, 29), bounds)).toBe('min');
    expect(validateDateTime(at(9, 30), bounds)).toBeNull();
    expect(validateDateTime(at(17), bounds)).toBeNull();
    expect(validateDateTime(at(17, 1), bounds)).toBe('max');
    expect(validateDateTime(at(12, 0, 14), bounds)).toBe('min');
    expect(validateDateTime(at(12, 0, 16), bounds)).toBe('max');
  });
  it('rejects invalid drafts and invalid or inverted bounds', () => {
    expect(validateDateTime(at(24))).toBe('invalid');
    expect(validateDateTime(at(12), { min: at(24) })).toBe('invalid-bounds');
    expect(validateDateTime(at(12), { min: at(17), max: at(9) })).toBe('invalid-bounds');
  });
  it('validates date-specific availability again at confirmation', () => {
    let booked = false;
    const constraints = signal<RiviniaDateTimeConstraints>({
      disabledTime: (value) => booked && value.date.day === 15 && value.time.hour === 12,
    });
    const draft = new RiviniaDateTimeDraft(at(12), constraints);
    expect(draft.valid()).toBe(true);
    booked = true;
    expect(draft.requestCommit()).toBeNull();
    constraints.set({ disabledDate: (date) => date.day === 15 });
    expect(draft.error()).toBe('disabled-date');
    constraints.set({ max: at(11) });
    expect(draft.error()).toBe('max');
  });
  it('edits independently and resets without changing the form value', () => {
    const original = at(9);
    const draft = new RiviniaDateTimeDraft(original);
    draft.setTime(at(11).time);
    draft.setDate(at(11, 0, 16).date);
    expect(original).toEqual(at(9));
    expect(draft.requestCommit()).toEqual(at(11, 0, 16));
    draft.reset(original);
    expect(draft.value()).toEqual(original);
    expect(draft.value()).not.toBe(original);
    expect(draft.requestCommit()).not.toBe(draft.value());
  });
});
