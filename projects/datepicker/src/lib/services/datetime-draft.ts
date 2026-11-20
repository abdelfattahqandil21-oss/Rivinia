import { computed, signal } from '@angular/core';
import type { RiviniaDate } from '../models/date-types';
import type { RiviniaDateTime } from '../models/time-types';
import { compareDateTime, isValidDateTime } from '../utils/time-math';

export interface RiviniaDateTimeConstraints {
  readonly min?: RiviniaDateTime;
  readonly max?: RiviniaDateTime;
  readonly disabledDate?: (date: RiviniaDate) => boolean;
  /** Receives the date as well as the time, for date-specific availability. */
  readonly disabledTime?: (value: RiviniaDateTime) => boolean;
}

export type RiviniaDateTimeValidationError =
  'invalid' | 'invalid-bounds' | 'min' | 'max' | 'disabled-date' | 'disabled-time';

/** Civil validation only: instant/DST policy belongs to the zone resolver. */
export function validateDateTime(
  value: RiviniaDateTime,
  constraints: RiviniaDateTimeConstraints = {},
): RiviniaDateTimeValidationError | null {
  if (!isValidDateTime(value)) return 'invalid';
  const { min, max } = constraints;
  if (
    (min && !isValidDateTime(min)) ||
    (max && !isValidDateTime(max)) ||
    (min && max && compareDateTime(min, max) > 0)
  )
    return 'invalid-bounds';
  if (min && compareDateTime(value, min) < 0) return 'min';
  if (max && compareDateTime(value, max) > 0) return 'max';
  if (constraints.disabledDate?.(value.date)) return 'disabled-date';
  if (constraints.disabledTime?.(value)) return 'disabled-time';
  return null;
}

function copy(value: RiviniaDateTime): RiviniaDateTime {
  return { date: { ...value.date }, time: { ...value.time } };
}

/**
 * One presentation-independent draft. Forms own the committed value; no second
 * committed store or effect is required. Read constraints at confirmation too,
 * so availability changes cannot commit a stale, previously valid draft.
 */
export class RiviniaDateTimeDraft {
  private readonly state;
  readonly value;
  readonly error;
  readonly valid;

  constructor(
    initial: RiviniaDateTime,
    private readonly constraints: () => RiviniaDateTimeConstraints = () => ({}),
  ) {
    this.state = signal(copy(initial));
    this.value = this.state.asReadonly();
    this.error = computed(() => validateDateTime(this.value(), this.constraints()));
    this.valid = computed(() => this.error() === null);
  }

  /** Start/restart from the form value or a caller-supplied empty-value fallback. */
  reset(value: RiviniaDateTime): void {
    this.state.set(copy(value));
  }
  setDate(date: RiviniaDate): void {
    this.state.update((value) => ({ date: { ...date }, time: { ...value.time } }));
  }
  setTime(time: RiviniaDateTime['time']): void {
    this.state.update((value) => ({ date: { ...value.date }, time: { ...time } }));
  }
  /** Returns a detached valid value. Only the consumer writes to its Forms model. */
  requestCommit(): RiviniaDateTime | null {
    const value = this.value();
    return validateDateTime(value, this.constraints()) === null ? copy(value) : null;
  }
}
