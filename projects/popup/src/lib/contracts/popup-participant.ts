import type { PopupDismissReason, PopupScrollStrategy } from './connection.types';

export interface PopupParticipant<T> {
  readonly parent: T | undefined;
  readonly children: Set<T>;
  readonly origin: HTMLElement;
  readonly panel: HTMLElement;
  readonly active: boolean;
  readonly depth: number;
  readonly order: number;
  readonly scrollStrategy: PopupScrollStrategy;
  readonly options: { readonly closeOnWidthChange?: boolean };
  schedule(): void;
  dismiss(reason: PopupDismissReason): void;
  destroy(): void;
}
