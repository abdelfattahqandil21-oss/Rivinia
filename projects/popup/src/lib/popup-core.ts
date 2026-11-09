import type { DestroyRef } from '@angular/core';

export type PopupDirection = 'ltr' | 'rtl';
export type PopupPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

export interface PopupRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PopupSize {
  readonly width: number;
  readonly height: number;
}

export interface PopupViewport {
  readonly width: number;
  readonly height: number;
}

export interface PopupPosition {
  readonly left: number;
  readonly top: number;
  readonly flipped: boolean;
}

export interface PopupDismissalOptions {
  readonly document: Document | null;
  readonly window: Window | null;
  readonly host: () => Element | null;
  readonly panel: () => Element | null;
  readonly editableFocusInsidePanel: () => boolean;
  readonly dismiss: () => void;
  /** Re-measure and reposition an open popup after viewport movement. */
  readonly reposition?: () => void;
  /** The current trigger box, used to dismiss only after it leaves the viewport. */
  readonly triggerRect?: () => DOMRect | null;
  readonly onCleanup?: (cleanup: () => void) => void;
}

export const POPUP_GAP = 6;
export const POPUP_EDGE_INSET = 8;

/** Pure geometry calculation. Direction is always supplied by the host. */
export function computePopupPosition(
  trigger: PopupRect,
  panel: PopupSize,
  placement: PopupPlacement,
  viewport: PopupViewport,
  direction: PopupDirection,
  gap = POPUP_GAP,
): PopupPosition {
  const [vertical, horizontal] = placement.split('-');
  const below = vertical !== 'top';
  const alignLeft = (horizontal !== 'end') !== (direction === 'rtl');

  let left = alignLeft ? trigger.left : trigger.left + trigger.width - panel.width;
  let top = below ? trigger.top + trigger.height + gap : trigger.top - gap - panel.height;
  let flipped = false;

  const fitsBelow = trigger.top + trigger.height + gap + panel.height <= viewport.height - POPUP_EDGE_INSET;
  const fitsAbove = trigger.top - gap - panel.height >= POPUP_EDGE_INSET;
  if (below && top + panel.height > viewport.height - POPUP_EDGE_INSET && fitsAbove) {
    top = trigger.top - gap - panel.height;
    flipped = true;
  } else if (!below && top < POPUP_EDGE_INSET && fitsBelow) {
    top = trigger.top + trigger.height + gap;
    flipped = true;
  }

  const fitsLeft = trigger.left + trigger.width - panel.width >= POPUP_EDGE_INSET;
  const fitsRight = trigger.left + panel.width <= viewport.width - POPUP_EDGE_INSET;
  if (alignLeft && left + panel.width > viewport.width - POPUP_EDGE_INSET && fitsLeft) {
    left = trigger.left + trigger.width - panel.width;
  } else if (!alignLeft && left < POPUP_EDGE_INSET && fitsRight) {
    left = trigger.left;
  }

  left = Math.min(Math.max(left, POPUP_EDGE_INSET), Math.max(POPUP_EDGE_INSET, viewport.width - panel.width - POPUP_EDGE_INSET));
  top = Math.min(Math.max(top, POPUP_EDGE_INSET), Math.max(POPUP_EDGE_INSET, viewport.height - panel.height - POPUP_EDGE_INSET));
  return { left: Math.round(left), top: Math.round(top), flipped };
}

const TOUCH_TAP_SLOP = 10;
const TOUCH_TAP_MAX_DURATION = 500;

/** Attach outside-dismissal and viewport listeners to one open host instance. */
export function bindPopupDismissal(
  options: PopupDismissalOptions,
  destroyRef: DestroyRef,
): void {
  const { document: doc, window: win } = options;
  if (!doc || !win) return;

  let active = true;
  let frame: number | null = null;
  let touch: { readonly id: number; readonly x: number; readonly y: number; readonly at: number; moved: boolean } | null = null;
  let widthAtLastResize = win.innerWidth;

  const cleanup = () => {
    if (!active) return;
    active = false;
    if (frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
    touch = null;
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', onPointerCancel, true);
    win.removeEventListener('scroll', onScroll, true);
    win.removeEventListener('resize', onResize);
    win.visualViewport?.removeEventListener('scroll', onScroll);
    win.visualViewport?.removeEventListener('resize', onResize);
  };

  const close = () => {
    if (!active) return;
    cleanup();
    options.dismiss();
  };

  const triggerIsOutsideViewport = (): boolean => {
    const rect = options.triggerRect?.();
    if (!rect) return false;
    const viewport = win.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? win.innerWidth);
    const bottom = top + (viewport?.height ?? win.innerHeight);
    return rect.right <= left || rect.left >= right || rect.bottom <= top || rect.top >= bottom;
  };

  const scheduleReposition = () => {
    if (!options.reposition && !options.triggerRect) {
      // Backward compatibility for custom consumers that have not opted into
      // anchor-aware dismissal yet.
      close();
      return;
    }
    if (frame !== null || !active) return;
    frame = win.requestAnimationFrame(() => {
      frame = null;
      if (!active) return;
      options.reposition?.();
      if (active && options.triggerRect && triggerIsOutsideViewport()) close();
    });
  };

  const onScroll = (event: Event) => {
    const panel = options.panel();
    const target = event.target;
    if (panel && target && 'nodeType' in target && panel.contains(target as Node)) return;
    scheduleReposition();
  };

  const onResize = () => {
    const width = win.innerWidth;
    if (width !== widthAtLastResize) {
      widthAtLastResize = width;
      close();
      return;
    }
    // Height-only changes include the virtual keyboard and mobile browser
    // chrome. Keep the popup open and let its host recompute its placement.
    scheduleReposition();
  };

  const isOutsideHost = (target: EventTarget | null): boolean => {
    const host = options.host();
    return !!host && !!target && !host.contains(target as Node);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!isOutsideHost(event.target)) return;
    if (event.pointerType !== 'touch') {
      close();
      return;
    }
    touch = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: win.performance.now(),
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!touch || event.pointerId !== touch.id) return;
    if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= TOUCH_TAP_SLOP) {
      touch.moved = true;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!touch || event.pointerId !== touch.id) return;
    const isTap =
      !touch.moved && win.performance.now() - touch.at <= TOUCH_TAP_MAX_DURATION;
    touch = null;
    if (isTap) close();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (touch?.id === event.pointerId) touch = null;
  };

  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('pointermove', onPointerMove, true);
  doc.addEventListener('pointerup', onPointerUp, true);
  doc.addEventListener('pointercancel', onPointerCancel, true);
  win.addEventListener('scroll', onScroll, true);
  win.addEventListener('resize', onResize);
  win.visualViewport?.addEventListener('scroll', onScroll);
  win.visualViewport?.addEventListener('resize', onResize);
  options.onCleanup?.(cleanup);
  destroyRef.onDestroy(cleanup);
}
