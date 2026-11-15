import {
  afterNextRender,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
} from '@angular/core';
import { connectPopup, type PopupConnection, type ConnectedPopupPlacement as PopupPlacement } from '@rivinia/popup';
import { SelectRootDirective } from '@rivinia/select/headless';

function isNodeInView(
  target: EventTarget | null,
  view: Window & typeof globalThis,
): target is Node {
  return target instanceof view.Node;
}

@Directive({
  selector: '[rvSelectPanel]',
  standalone: true,
  host: {
    class: 'rv-select-panel',
    '[attr.id]': 'rvSelectPanelId() ?? null',
    '[attr.popover]': '"manual"',
    '(scroll)': 'onScroll($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class SelectPanelDirective {
  readonly rvSelectPanelId = input<string>();
  readonly rvSelectPlacement = input<PopupPlacement>('bottom-start');
  readonly rvSelectOffset = input(4);
  readonly rvSelectReachEndThreshold = input(32);
  readonly root = inject(SelectRootDirective);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private connection?: PopupConnection;
  private connectedOrigin?: HTMLElement;
  private widthObservedOrigin?: HTMLElement;
  private originResizeObserver?: ResizeObserver;
  private rendered = false;
  private destroyed = false;
  private reachedEnd = false;

  constructor() {
    this.root.setPanel(this.host.nativeElement);
    afterNextRender({
      mixedReadWrite: () => {
        if (this.destroyed) return;
        this.rendered = true;
        effect(() => this.syncPanel(), { injector: this.injector });
      },
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.connection?.destroy();
      this.connection = undefined;
      this.clearOriginWidth();
      this.hidePopover();
    });
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const atEnd =
      element.scrollHeight - element.scrollTop - element.clientHeight <=
      this.rvSelectReachEndThreshold();
    if (atEnd && !this.reachedEnd) {
      this.reachedEnd = true;
      this.root.notifyReachEnd();
    } else if (!atEnd) {
      this.reachedEnd = false;
    }
  }

  onFocusOut(event: FocusEvent): void {
    const host = this.host.nativeElement;
    const document = host.ownerDocument;
    const view = document.defaultView;
    if (!view) return;
    const next = event.relatedTarget;
    if (
      isNodeInView(next, view) &&
      (host.contains(next) || this.root.inputElement()?.contains(next))
    ) {
      return;
    }
    view.setTimeout(() => {
      const active = document.activeElement;
      if (active && (host.contains(active) || this.root.inputElement()?.contains(active))) {
        return;
      }
      this.root.close();
    }, 0);
  }

  private syncPanel(): void {
    const open = this.root.isOpen();
    const origin = this.root.inputElement();
    const placement = this.rvSelectPlacement();
    const offset = this.rvSelectOffset();
    if (!this.rendered || this.destroyed) return;
    if (!open || !origin || !this.host.nativeElement.isConnected) {
      const leaving = !open && this.host.nativeElement.classList.contains('rv-select-panel-leave');
      this.connection?.destroy();
      this.connection = undefined;
      this.connectedOrigin = undefined;
      if (leaving) {
        this.originResizeObserver?.disconnect();
        this.originResizeObserver = undefined;
        this.widthObservedOrigin = undefined;
      } else {
        this.clearOriginWidth();
        if (!open) this.hidePopover();
      }
      return;
    }
    this.observeOriginWidth(origin);
    if (!this.host.nativeElement.matches(':popover-open')) this.host.nativeElement.showPopover();
    if (
      this.connection &&
      (origin !== this.connectedOrigin ||
        placement !== this.connectedPlacement ||
        offset !== this.connectedOffset)
    ) {
      this.connection.destroy();
      this.connection = undefined;
    }
    if (!this.connection) {
      this.connection = connectPopup({
        origin,
        panel: this.host.nativeElement,
        placement,
        offset,
        onDismiss: (reason) => this.root.close(reason === 'escape' ? 'escape' : undefined),
      });
      this.connectedOrigin = origin;
      this.connectedPlacement = placement;
      this.connectedOffset = offset;
      this.root.notifyPanelReady(this.host.nativeElement);
    }
  }

  private connectedPlacement?: PopupPlacement;
  private connectedOffset?: number;

  private observeOriginWidth(origin: HTMLElement): void {
    if (this.widthObservedOrigin === origin) {
      this.updateOriginWidth(origin);
      return;
    }
    this.originResizeObserver?.disconnect();
    this.widthObservedOrigin = origin;
    this.updateOriginWidth(origin);
    const view = origin.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (!ResizeObserverConstructor) return;
    this.originResizeObserver = new ResizeObserverConstructor(() => this.updateOriginWidth(origin));
    this.originResizeObserver.observe(origin);
  }

  private updateOriginWidth(origin: HTMLElement): void {
    if (origin !== this.widthObservedOrigin || this.destroyed) return;
    const width = origin.getBoundingClientRect().width;
    this.host.nativeElement.style.setProperty(
      '--rv-select-panel-inline-size',
      String(width) + 'px',
    );
  }

  private clearOriginWidth(): void {
    this.originResizeObserver?.disconnect();
    this.originResizeObserver = undefined;
    this.widthObservedOrigin = undefined;
    this.host.nativeElement.style.removeProperty('--rv-select-panel-inline-size');
  }

  private hidePopover(): void {
    if (this.host.nativeElement.matches(':popover-open')) this.host.nativeElement.hidePopover();
  }
}
