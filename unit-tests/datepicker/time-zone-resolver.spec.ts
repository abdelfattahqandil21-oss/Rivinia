import { describe, expect, it } from 'vitest';
import { resolveDateTimeZone } from '../../projects/datepicker/src/public-api';

const wall = (month: number, day: number, hour: number, minute = 30) => ({
  date: { year: 2026, month, day },
  time: { hour, minute, second: 0 },
});

describe('replaceable zone resolution', () => {
  it('keeps unique, gap and overlap distinct with the original civil shapes', () => {
    const unique = resolveDateTimeZone(wall(11, 15, 12), 'UTC');
    expect(unique.kind).toBe('unique');
    if (unique.kind === 'unique') expect(unique.instant).toBe(Date.UTC(2026, 10, 15, 12, 30));
    expect(resolveDateTimeZone(wall(3, 8, 2), 'America/New_York').kind).toBe('nonexistent');
    const overlap = resolveDateTimeZone(wall(11, 1, 1), 'America/New_York');
    expect(overlap.kind).toBe('ambiguous');
    if (overlap.kind === 'ambiguous') {
      expect(overlap.alternatives.map((value) => value.instant)).toEqual([
        Date.UTC(2026, 10, 1, 5, 30),
        Date.UTC(2026, 10, 1, 6, 30),
      ]);
    }
  });
  it('reports unsupported zones and external resolver failures without inventing instants', () => {
    expect(resolveDateTimeZone(wall(11, 15, 12), 'Mars/Olympus').kind).toBe('unsupported');
    expect(
      resolveDateTimeZone(wall(11, 15, 12), 'UTC', {
        resolve() {
          throw new Error('Unavailable');
        },
      }),
    ).toEqual({ kind: 'unsupported', reason: 'Time zone resolver failed.' });
    expect(
      resolveDateTimeZone(wall(11, 15, 12), 'UTC', {
        resolve: () => ({ kind: 'unsupported', reason: 'Not loaded yet' }),
      }),
    ).toEqual({ kind: 'unsupported', reason: 'Not loaded yet' });
  });
});
