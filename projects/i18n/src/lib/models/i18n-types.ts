/** Text rendering direction. */
export type Direction = 'ltr' | 'rtl';

/**
 * A supported language. `displayName` is the consumer-provided label used by
 * UI controls; it may be a native, localized, regional or product-specific name.
 * Core never reads presentation metadata. `nativeName` remains temporarily
 * supported for migration; UI gives `displayName` precedence.
 */
export interface Language<T extends string = string> {
  readonly id: T;
  readonly displayName?: string;
  /** @deprecated V2: use `displayName` (consumer-visible label). */
  readonly nativeName?: string;
  readonly dir: Direction;
  /**
   * BCP-47 locale for `Intl` formatting and plural rules (e.g. `ar-EG` for
   * Arabic-Indic digits, `en-GB` vs `en-US`). Defaults to the language id —
   * note a bare id like `ar` formats Latin digits, which is often NOT what
   * Arabic readers expect.
   */
  readonly locale?: string;
}

/** Inline typed translations: `{ ar: 'حفظ', en: 'Save' }`. */
export type Translation<T extends string> = Record<T, string>;

/** Persistence backend. SSR-safe: everything degrades to no-op off-browser. */
export type StorageStrategy = 'local' | 'session' | 'none' | 'cookie';

/**
 * Interpolation + ICU params (`{count}`, `{gender}`, `{day, date}`).
 * `Date` values are consumed by `{d, date[, style]}`; a plain `{name}`
 * renders them with `String(value)`.
 */
export type TranslateParams = Record<string, string | number | boolean | Date>;

/** @experimental The view-transition integration may change before 1.0. */
export interface ViewTransitionInfo {
  readonly language: string;
  readonly direction: Direction;
}

/** @experimental The view-transition integration may change before 1.0. */
export interface ViewTransitionConfig {
  readonly enabled?: boolean;
  readonly skipInitialTransition?: boolean;
  readonly onViewTransitionCreated?: (info: ViewTransitionInfo) => void;
}

/** `'instant'`: flip now, load in background. `'preload-first'`: no raw-key flash. */
export type SwitchStrategy = 'instant' | 'preload-first';
