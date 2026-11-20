export {
  bindPopupDismissal,
  computePopupPosition,
  POPUP_EDGE_INSET,
  POPUP_GAP,
} from './lib/popup-core';
export type {
  PopupDirection,
  PopupDismissalOptions,
  PopupPlacement,
  PopupPosition,
  PopupRect,
  PopupSize,
  PopupViewport,
} from './lib/popup-core';

// Connected panels use an options object; the existing positional helper remains supported.
export { computePopupPosition as computeConnectedPopupPosition } from './lib/geometry';
export type { ComputePopupPositionOptions, PopupAlignment, PopupBounds, PopupOriginRect, PopupPanelSize, PopupSide, TextDirection, PopupPlacement as ConnectedPopupPlacement, PopupPosition as ConnectedPopupPosition } from './lib/geometry';
export { connectPopup } from './lib/connect-popup';
export type { PopupConnection, PopupConnectionOptions, PopupConnectionUpdate, PopupDismissReason, PopupScrollStrategy } from './lib/connect-popup';
export { PopupPanelDirective } from './lib/popup-panel.directive';
