import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PopupPanelDirective, type PopupDismissReason, type PopupPlacement } from '@rivinia/popup';

@Component({
  standalone: true,
  imports: [PopupPanelDirective],
  templateUrl: './popup-panel.directive.spec-host.html',
})
class PopupPanelHost {
  readonly open = signal(true);
  readonly placement = signal<PopupPlacement>('bottom-start');
  readonly offset = signal(8);
  readonly lastDismissal = signal<PopupDismissReason | undefined>(undefined);
}

describe('PopupPanelDirective', () => {
  it('updates signal inputs without replacing an active connection', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.tagName === 'BUTTON' ? rect(100, 40, 80, 20) : rect(0, 0, 120, 60);
    });
    const fixture = TestBed.createComponent(PopupPanelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const directive = fixture.debugElement
      .query(By.directive(PopupPanelDirective))
      .injector.get(PopupPanelDirective);
    const connection = directive.connection;
    const panel = fixture.nativeElement.querySelector('div') as HTMLDivElement;
    expect(panel.style.top).toBe('68px');

    fixture.componentInstance.placement.set('top-end');
    fixture.componentInstance.offset.set(4);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(directive.connection).toBe(connection);
    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('64px');

    fixture.destroy();
    expect(panel.style.position).toBe('');
    vi.restoreAllMocks();
  });

  it('emits the dismissal reason and releases the connection', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.tagName === 'BUTTON' ? rect(100, 40, 80, 20) : rect(0, 0, 120, 60);
    });
    const fixture = TestBed.createComponent(PopupPanelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('div') as HTMLDivElement;
    const outside = document.createElement('button');
    document.body.append(outside);

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastDismissal()).toBe('outside');
    expect(panel.style.position).toBe('');
    fixture.destroy();
    outside.remove();
    vi.restoreAllMocks();
  });
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}
