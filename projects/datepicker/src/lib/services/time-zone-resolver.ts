import { InjectionToken } from '@angular/core';
import type { RiviniaDateTime, RiviniaTimeZoneResolution } from '../models/time-types';
import { resolveWallTime } from '../utils/time-zone';

/** Unsupported is different from a proven DST gap. No instant is invented. */
export type RiviniaZoneResult =
  RiviniaTimeZoneResolution | { readonly kind: 'unsupported'; readonly reason: string };

export interface RiviniaTimeZoneResolver {
  resolve(value: RiviniaDateTime, timeZone: string): RiviniaZoneResult;
}

/** Uses the existing bounded Intl resolver; no bundled timezone database. */
export const DEFAULT_TIME_ZONE_RESOLVER: RiviniaTimeZoneResolver = {
  resolve(value, timeZone) {
    const result = resolveWallTime(value, timeZone, 'compatible');
    return (
      result ?? { kind: 'unsupported', reason: 'Invalid civil value or unsupported time zone.' }
    );
  },
};

/** Override per application or picker with a resolver using the same civil contract. */
export const RIVINIA_TIME_ZONE_RESOLVER = new InjectionToken<RiviniaTimeZoneResolver>(
  'RIVINIA_TIME_ZONE_RESOLVER',
  { providedIn: 'root', factory: () => DEFAULT_TIME_ZONE_RESOLVER },
);

/** Also protects controls when an optional external resolver cannot resolve a value. */
export function resolveDateTimeZone(
  value: RiviniaDateTime,
  timeZone: string,
  resolver: RiviniaTimeZoneResolver = DEFAULT_TIME_ZONE_RESOLVER,
): RiviniaZoneResult {
  try {
    return resolver.resolve(value, timeZone);
  } catch {
    return { kind: 'unsupported', reason: 'Time zone resolver failed.' };
  }
}

/** Compatible preserves the original UI default; explicit requires a DST decision. */
export type RiviniaZoneCommitPolicy = 'compatible' | 'explicit';
