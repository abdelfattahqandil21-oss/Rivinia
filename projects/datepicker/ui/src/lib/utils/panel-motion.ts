/**
 * Shared panel-motion facts for the two pickers.
 *
 * The CSS owns the actual duration (`--rv-datepicker-exit-duration`); this
 * fallback only decides whether the exit state is worth entering and bounds
 * the wait when `animationend` never arrives (jsdom, a consumer's
 * `animation: none`, a background tab). It is deliberately longer than the
 * default 100ms animation.
 */
export const PANEL_EXIT_FALLBACK_MS = 500;

/**
 * True only in a real browser that has not asked for reduced motion.
 *
 * jsdom has no `matchMedia`; treating that as "no animation" keeps the
 * component deterministic in unit tests and on a server, where there is no
 * frame to animate. `matchMedia` can throw in exotic embedders; a nicety must
 * never break closing.
 */
export function panelExitMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.matchMedia !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Clamps the actual rendered panel to the visual viewport.
 *
 * CSS anchor positioning may flip the panel before this runs.
 * Deriving a shift from the trigger alone would move an already-flipped
 * panel offscreen. Account for the currently applied shift and any
 * entry-animation transform so repeated measurements stay idempotent.
 */
export function panelViewportShift(
  panel: HTMLElement,
  trigger: HTMLElement | null | undefined,
  fallbackHeight = typeof window === 'undefined' ? 0 : window.innerHeight,
): number {
  if (trigger == null || fallbackHeight <= 0) return 0;

  const view = panel.ownerDocument.defaultView;
  if (view === null) return 0;

  const rect = panel.getBoundingClientRect();
  if (rect.height <= 0) return 0;

  const viewport = view.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportHeight = viewport?.height ?? fallbackHeight;

  const style = view.getComputedStyle(panel);
  const appliedShift =
    Number.parseFloat(style.getPropertyValue('--rv-datepicker-panel-shift')) || 0;

  let transformY = 0;
  if (style.transform.startsWith('matrix')) {
    try {
      transformY = new DOMMatrixReadOnly(style.transform).m42;
    } catch {
      transformY = 0;
    }
  }

  const naturalTop = rect.top - appliedShift - transformY;
  const padding = 8;
  const minTop = viewportTop + padding;
  const maxTop = Math.max(
    minTop,
    viewportTop + viewportHeight - padding - rect.height,
  );

  const targetTop = Math.max(minTop, Math.min(naturalTop, maxTop));
  return Math.round((targetTop - naturalTop) * 1000) / 1000;
}
