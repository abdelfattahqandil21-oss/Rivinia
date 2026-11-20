export type PopupSide = 'top' | 'right' | 'bottom' | 'left';
export type PopupAlignment = 'start' | 'center' | 'end';
export type PopupPlacement = `${PopupSide}-${PopupAlignment}`;
export type TextDirection = 'ltr' | 'rtl';

export interface PopupOriginRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PopupPanelSize {
  readonly width: number;
  readonly height: number;
}

export interface PopupBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ComputePopupPositionOptions {
  readonly origin: PopupOriginRect;
  readonly panel: PopupPanelSize;
  readonly viewport: PopupBounds;
  readonly direction: TextDirection;
  readonly placement?: PopupPlacement;
  readonly offset?: number;
  readonly padding?: number;
}

export interface PopupPosition {
  readonly left: number;
  readonly top: number;
  readonly placement: PopupPlacement;
}

const OPPOSITE_SIDE: Record<PopupSide, PopupSide> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

function availableSpace(
  side: PopupSide,
  origin: PopupOriginRect,
  viewport: PopupBounds,
  offset: number,
  padding: number,
): number {
  switch (side) {
    case 'top':
      return origin.top - viewport.top - padding - offset;
    case 'right':
      return viewport.right - padding - (origin.left + origin.width) - offset;
    case 'bottom':
      return viewport.bottom - padding - (origin.top + origin.height) - offset;
    case 'left':
      return origin.left - viewport.left - padding - offset;
  }
}

function panelExtent(side: PopupSide, panel: PopupPanelSize): number {
  return side === 'top' || side === 'bottom' ? panel.height : panel.width;
}

function resolvePlacement(
  requested: PopupPlacement,
  origin: PopupOriginRect,
  panel: PopupPanelSize,
  viewport: PopupBounds,
  offset: number,
  padding: number,
): PopupPlacement {
  const [requestedSide, alignment] = requested.split('-') as [PopupSide, PopupAlignment];
  const oppositeSide = OPPOSITE_SIDE[requestedSide];
  const extent = panelExtent(requestedSide, panel);
  const requestedSpace = availableSpace(requestedSide, origin, viewport, offset, padding);
  if (requestedSpace >= extent) return requested;

  const oppositeSpace = availableSpace(oppositeSide, origin, viewport, offset, padding);
  if (oppositeSpace >= extent || oppositeSpace > requestedSpace) {
    return `${oppositeSide}-${alignment}`;
  }
  return requested;
}

function alignedOffset(
  start: number,
  extent: number,
  panelExtent: number,
  alignment: PopupAlignment,
  direction: TextDirection,
): number {
  if (alignment === 'center') return start + (extent - panelExtent) / 2;
  const alignToStart = alignment === 'start';
  const useStartEdge = direction === 'ltr' ? alignToStart : !alignToStart;
  return useStartEdge ? start : start + extent - panelExtent;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/** Computes a logical popup placement, flips across its preferred axis, then clamps to viewport bounds. */
export function computePopupPosition(options: ComputePopupPositionOptions): PopupPosition {
  const {
    origin,
    panel,
    viewport,
    direction,
    placement = 'bottom-start',
    offset = 0,
    padding = 0,
  } = options;
  const resolvedPlacement = resolvePlacement(placement, origin, panel, viewport, offset, padding);
  const [side, alignment] = resolvedPlacement.split('-') as [PopupSide, PopupAlignment];
  const originRight = origin.left + origin.width;
  const originBottom = origin.top + origin.height;
  let left: number;
  let top: number;

  if (side === 'top' || side === 'bottom') {
    left = alignedOffset(origin.left, origin.width, panel.width, alignment, direction);
    top = side === 'top' ? origin.top - offset - panel.height : originBottom + offset;
  } else {
    top = alignedOffset(origin.top, origin.height, panel.height, alignment, 'ltr');
    left = side === 'left' ? origin.left - offset - panel.width : originRight + offset;
  }

  return {
    left: clamp(left, viewport.left + padding, viewport.right - padding - panel.width),
    top: clamp(top, viewport.top + padding, viewport.bottom - padding - panel.height),
    placement: resolvedPlacement,
  };
}
