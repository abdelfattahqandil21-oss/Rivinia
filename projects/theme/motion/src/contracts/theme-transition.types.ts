export type RiviniaThemeTransitionDirection = 'expand' | 'collapse';

export type RiviniaThemeTransitionCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface RiviniaThemeTransitionPoint {
  readonly x: number;
  readonly y: number;
}

export interface RiviniaThemeTransitionOptions {
  /** Expands the new snapshot or collapses the old snapshot toward the origin. */
  readonly direction?: RiviniaThemeTransitionDirection;
  /** Viewport coordinates, useful for pointer activation. Overrides element origin. */
  readonly point?: RiviniaThemeTransitionPoint;
  /** Viewport corner used when no element or point is supplied. */
  readonly corner?: RiviniaThemeTransitionCorner;
  /** Animation duration in milliseconds. Defaults to 420. */
  readonly duration?: number;
  /** CSS animation timing function. Defaults to `ease-out`. */
  readonly easing?: string;
}
