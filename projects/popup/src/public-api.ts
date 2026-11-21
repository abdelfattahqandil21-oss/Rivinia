export {
  bindPopupDismissal,
  computePopupPosition,
  POPUP_EDGE_INSET,
  POPUP_GAP,
} from './lib/compatibility/legacy-popup-core';
export type {
  PopupDirection,
  PopupDismissalOptions,
  PopupPlacement,
  PopupPosition,
  PopupRect,
  PopupSize,
  PopupViewport,
} from './lib/compatibility/legacy-popup-core';

// Connected panels use an options object; the existing positional helper remains supported.
export { computePopupPosition as computeConnectedPopupPosition } from './lib/positioning/compute-position';
export type {
  ComputePopupPositionOptions,
  PopupAlignment,
  PopupBounds,
  PopupOriginRect,
  PopupPanelSize,
  PopupSide,
  TextDirection,
  PopupPlacement as ConnectedPopupPlacement,
  PopupPosition as ConnectedPopupPosition,
} from './lib/positioning/compute-position';
export { connectPopup } from './lib/connection/connect-popup';
export type {
  PopupConnection,
  PopupConnectionOptions,
  PopupConnectionUpdate,
  PopupDismissReason,
  PopupScrollStrategy,
} from './lib/contracts/connection.types';
export { PopupPanelDirective } from './lib/angular/popup-panel.directive';
