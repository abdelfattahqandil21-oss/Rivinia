import {
  afterNextRender,
  Directive,
  DestroyRef,
  effect,
  ElementRef,
  EffectRef,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import {
  connectPopup,
  type PopupConnection,
  type PopupDismissReason,
  type PopupScrollStrategy,
} from './connect-popup';
import type { PopupPlacement } from './geometry';

interface PopupPanelInputs {
  readonly open: boolean;
  readonly origin: HTMLElement;
  readonly parent: PopupConnection | undefined;
  readonly placement: PopupPlacement | undefined;
  readonly offset: number | undefined;
  readonly padding: number | undefined;
  readonly scrollStrategy: PopupScrollStrategy | undefined;
}

/** Angular lifecycle adapter for a consumer-owned popup panel. */
@Directive({
  selector: '[rvPopupPanel]',
  exportAs: 'rvPopupPanel',
  standalone: true,
})
export class PopupPanelDirective {
  readonly rvPopupPanelOrigin = input.required<HTMLElement>();
  readonly rvPopupPanelOpen = input(false);
  readonly rvPopupPanelParent = input<PopupConnection>();
  readonly rvPopupPanelPlacement = input<PopupPlacement>();
  readonly rvPopupPanelOffset = input<number>();
  readonly rvPopupPanelPadding = input<number>();
  readonly rvPopupPanelScrollStrategy = input<PopupScrollStrategy>();
  readonly rvPopupDismissed = output<PopupDismissReason>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private activeConnection?: PopupConnection;
  private activeOrigin?: HTMLElement;
  private activeParent?: PopupConnection;
  private activePlacement?: PopupPlacement;
  private activeOffset?: number;
  private activePadding?: number;
  private activeScrollStrategy?: PopupScrollStrategy;
  private inputEffect?: EffectRef;
  private rendered = false;
  private destroyed = false;
  private dismissedForOpenCycle = false;

  constructor() {
    afterNextRender({
      mixedReadWrite: () => {
        if (this.destroyed) return;
        this.rendered = true;
        this.syncConnection(this.readInputs());
        this.inputEffect = effect(() => this.syncConnection(this.readInputs()), {
          injector: this.injector,
        });
      },
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.inputEffect?.destroy();
      this.resetConnection();
    });
  }

  get connection(): PopupConnection | undefined {
    return this.activeConnection;
  }

  private readInputs(): PopupPanelInputs {
    return {
      open: this.rvPopupPanelOpen(),
      origin: this.rvPopupPanelOrigin(),
      parent: this.rvPopupPanelParent(),
      placement: this.rvPopupPanelPlacement(),
      offset: this.rvPopupPanelOffset(),
      padding: this.rvPopupPanelPadding(),
      scrollStrategy: this.rvPopupPanelScrollStrategy(),
    };
  }

  private syncConnection(inputs: PopupPanelInputs): void {
    if (!this.rendered || this.destroyed) return;
    if (!inputs.open) {
      this.dismissedForOpenCycle = false;
      this.resetConnection();
      return;
    }
    if (this.dismissedForOpenCycle) return;

    if (
      this.activeConnection &&
      this.activeOrigin === inputs.origin &&
      this.activeParent === inputs.parent
    ) {
      const configChanged =
        this.activePlacement !== inputs.placement ||
        this.activeOffset !== inputs.offset ||
        this.activePadding !== inputs.padding ||
        this.activeScrollStrategy !== inputs.scrollStrategy;
      if (configChanged) {
        this.activeConnection.update({
          placement: inputs.placement,
          offset: inputs.offset,
          padding: inputs.padding,
          scrollStrategy: inputs.scrollStrategy,
        });
        this.rememberInputs(inputs);
      }
      return;
    }

    this.resetConnection();
    const connection = connectPopup({
      origin: inputs.origin,
      panel: this.host.nativeElement,
      parent: inputs.parent,
      placement: inputs.placement,
      offset: inputs.offset,
      padding: inputs.padding,
      scrollStrategy: inputs.scrollStrategy,
      onDismiss: (reason) => {
        this.activeConnection = undefined;
        this.activeOrigin = undefined;
        this.activeParent = undefined;
        this.dismissedForOpenCycle = true;
        this.rvPopupDismissed.emit(reason);
      },
    });
    if (!this.dismissedForOpenCycle) {
      this.activeConnection = connection;
      this.rememberInputs(inputs);
    }
  }

  private rememberInputs(inputs: PopupPanelInputs): void {
    this.activeOrigin = inputs.origin;
    this.activeParent = inputs.parent;
    this.activePlacement = inputs.placement;
    this.activeOffset = inputs.offset;
    this.activePadding = inputs.padding;
    this.activeScrollStrategy = inputs.scrollStrategy;
  }

  private resetConnection(): void {
    this.activeConnection?.destroy();
    this.activeConnection = undefined;
    this.activeOrigin = undefined;
    this.activeParent = undefined;
    this.activePlacement = undefined;
    this.activeOffset = undefined;
    this.activePadding = undefined;
    this.activeScrollStrategy = undefined;
  }
}
