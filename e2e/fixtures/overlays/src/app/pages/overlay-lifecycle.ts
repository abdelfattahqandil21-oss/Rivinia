import { Component, signal } from '@angular/core';
import { RiviniaMenuComponent, RiviniaMenuItem } from '@rivinia/menu/ui';
import { RiviniaModalDialog } from '@rivinia/modal/ui';
import { PopupPanelDirective } from '@rivinia/popup';
import { RiviniaSelectComponent } from '@rivinia/select/ui';
import type { Toast } from '@rivinia/toast';
import { RiviniaToastList } from '@rivinia/toast/ui';

@Component({
  selector: 'e2e-overlay-lifecycle',
  imports: [
    RiviniaMenuComponent,
    RiviniaMenuItem,
    RiviniaModalDialog,
    PopupPanelDirective,
    RiviniaSelectComponent,
    RiviniaToastList,
  ],
  template: `
    <h1>Overlay lifecycle</h1>
    <button id="modal-origin" type="button" (click)="modalOpen.set(true)">Open modal</button>
    <button id="emit-toast" type="button" (click)="emitToast()">Emit toast</button>
    <button id="destroy-modal" type="button" (click)="showModal.set(false)">
      Destroy modal owner
    </button>
    <button id="recreate-modal" type="button" (click)="showModal.set(true)">
      Recreate modal owner
    </button>

    @if (showModal()) {
      <rv-modal-dialog
        ariaLabel="Overlay lifecycle dialog"
        [open]="modalOpen()"
        (openChange)="modalOpen.set($event)"
      >
        <button id="inside-modal" type="button">Inside modal</button>
        <rv-menu menuLabel="Menu inside modal">
          <button rvMenuTrigger id="modal-menu-trigger" type="button">
            Modal actions
          </button>
          <div rvMenuPanel>
            <button rvMenuItem id="modal-menu-item" type="button">
              Modal action
            </button>
          </div>
        </rv-menu>
        <rv-toast-list
          [toasts]="toasts()"
          (actionPressed)="toastActionPressed.set($event)"
          [richColors]="false"
        />
      </rv-modal-dialog>
    }

    <rv-menu menuLabel="Overlay test menu">
      <button rv-menu-trigger id="menu-trigger">Open menu</button>
      <div rv-menu-panel>
        <button rvMenuItem id="menu-item">Menu item</button>
        <rv-menu menuLabel="Nested overlay test menu">
          <button rv-menu-trigger id="nested-menu-trigger" role="menuitem">Open nested menu</button>
          <div rv-menu-panel>
            <button rvMenuItem id="nested-menu-item">Nested menu item</button>
          </div>
        </rv-menu>
      </div>
    </rv-menu>

    <rv-select id="overlay-select" label="Overlay select" [options]="options" [searchable]="true">
      <div rv-select-popup-footer>
        <rv-menu menuLabel="Select footer menu">
          <button rv-menu-trigger id="select-footer-menu-trigger">Open footer menu</button>
          <div rv-menu-panel>
            <button rvMenuItem id="select-footer-menu-item">Footer menu item</button>
          </div>
        </rv-menu>
        <button id="select-footer-action" type="button">Footer action</button>
        <label for="select-footer-filter">Footer filter</label>
        <input id="select-footer-filter" type="text" />
      </div>
    </rv-select>
    <button id="after-select" type="button">After select</button>

    <button
      id="popup-transform-enable"
      type="button"
      (click)="showTransformFixture.set(true)"
    >
      Enable transformed popup
    </button>

    @if (showTransformFixture()) {
      <div
        id="popup-transform-host"
        style="position: relative; translate: 40px 30px; width: 240px; min-height: 90px; margin-inline-start: 160px;"
      >
        <button #popupTransformOrigin id="popup-transform-origin" type="button">
          Transformed anchor
        </button>

        <div
          id="popup-transform-panel"
          rvPopupPanel
          [rvPopupPanelOrigin]="popupTransformOrigin"
          [rvPopupPanelOpen]="true"
          [rvPopupPanelOffset]="8"
          style="width: 100px; height: 44px;"
        >
          Connected panel
        </div>
      </div>
    }
    <button id="popup-scale-enable" type="button" (click)="showScaleFixture.set(true)">
      Enable scaled popup
    </button>

    @if (showScaleFixture()) {
      <div
        id="popup-scale-host"
        style="position: relative; scale: 1.25; width: 240px; min-height: 90px; margin-inline-start: 96px;"
      >
        <button #popupScaleOrigin id="popup-scale-origin" type="button">
          Scaled anchor
        </button>

        <div
          id="popup-scale-panel"
          rvPopupPanel
          [rvPopupPanelOrigin]="popupScaleOrigin"
          [rvPopupPanelOpen]="true"
          [rvPopupPanelOffset]="8"
          style="width: 100px; height: 44px;"
        >
          Scaled connected panel
        </div>
      </div>
    }

    <p data-testid="toast-action">action={{ toastActionPressed() }}</p>
  `,
})
export class OverlayLifecyclePage {
  protected readonly modalOpen = signal(false);
  protected readonly showModal = signal(true);
  protected readonly showTransformFixture = signal(false);
  protected readonly showScaleFixture = signal(false);
  protected readonly options = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
  ];
  protected readonly toasts = signal<readonly Toast[]>([]);
  protected readonly toastActionPressed = signal<number | null>(null);

  protected emitToast(): void {
    this.toasts.update((current) => [
      ...current,
      {
        id: current.length + 1,
        kind: 'info',
        message: 'Notification above the dialog',
        duration: 0,
        remaining: 0,
        paused: false,
        action: { label: 'Retry notification', onPress: () => undefined },
      },
    ]);
  }
}
