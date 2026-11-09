import { Component, signal } from '@angular/core';
import { RiviniaMenuComponent, RiviniaMenuItem } from '@rivinia/menu/ui';
import { RiviniaModalDialog } from '@rivinia/modal/ui';
import { RiviniaSelectComponent } from '@rivinia/select/ui';
import type { Toast } from '@rivinia/toast';
import { RiviniaToastList } from '@rivinia/toast/ui';

@Component({
  selector: 'e2e-overlay-lifecycle',
  imports: [
    RiviniaMenuComponent,
    RiviniaMenuItem,
    RiviniaModalDialog,
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

    <rv-select id="overlay-select" label="Overlay select" [options]="options">
      <div rv-select-popup-footer>
        <rv-menu menuLabel="Select footer menu">
          <button rv-menu-trigger id="select-footer-menu-trigger">Open footer menu</button>
          <div rv-menu-panel>
            <button rvMenuItem id="select-footer-menu-item">Footer menu item</button>
          </div>
        </rv-menu>
      </div>
    </rv-select>
    <p data-testid="toast-action">action={{ toastActionPressed() }}</p>
  `,
})
export class OverlayLifecyclePage {
  protected readonly modalOpen = signal(false);
  protected readonly showModal = signal(true);
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
