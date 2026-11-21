import type { PopupPlacement, PopupPosition } from '../positioning/compute-position';

export type PopupDismissReason = 'outside' | 'escape' | 'anchor-hidden' | 'scroll' | 'resize';
export type PopupScrollStrategy = 'reposition' | 'close';

export interface PopupConnectionUpdate {
  readonly placement?: PopupPlacement;
  readonly offset?: number;
  readonly padding?: number;
  readonly scrollStrategy?: PopupScrollStrategy;
}

export interface PopupConnectionOptions {
  readonly origin: HTMLElement;
  readonly panel: HTMLElement;
  readonly parent?: PopupConnection | 'auto';
  /** Host-owned CSS anchor/fallback positioning; no inline coordinates are owned by Popup. */
  readonly position?: (position: PopupPosition) => void;
  readonly closeOnWidthChange?: boolean;
  readonly placement?: PopupPlacement;
  readonly offset?: number;
  readonly padding?: number;
  readonly scrollStrategy?: PopupScrollStrategy;
  readonly onDismiss: (reason: PopupDismissReason) => void;
}

export interface PopupConnection {
  /** Recomputes visibility and position immediately, optionally changing positioning preferences. */
  update(options?: PopupConnectionUpdate): void;
  /** Disconnects observers and event handling. Safe to call more than once. */
  destroy(): void;
}
