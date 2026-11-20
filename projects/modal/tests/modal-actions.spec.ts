import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RiviniaActionBar, RiviniaActionTemplate } from '../actions/src/public-api';

@Component({
  standalone: true,
  imports: [RiviniaActionBar, RiviniaActionTemplate],
  template: `
    <rv-action-bar [items]="items" layout="buttons" (activated)="activated = $event">
      <ng-template rvActionTemplate let-action>
        <span data-testid="custom-action">{{ action.name }}</span>
      </ng-template>
    </rv-action-bar>
  `,
})
class ActionTemplateHarness {
  readonly items = [{ id: 9, name: 'Custom label' }];
  activated?: (typeof this.items)[number];
}

interface Action {
  readonly id: number;
  readonly name: string;
}

describe('RiviniaActionBar', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RiviniaActionBar] }));

  it('emits the original action object and applies appearance and tone separately', () => {
    const action = { id: 7, name: 'Approve' } satisfies Action;
    const fixture = TestBed.createComponent(RiviniaActionBar<Action>);
    fixture.componentRef.setInput('items', [action]);
    fixture.componentRef.setInput('layout', 'buttons');
    fixture.componentRef.setInput('appearanceOf', () => 'flat');
    fixture.componentRef.setInput('toneOf', () => 'success');
    fixture.detectChanges();

    let emitted: Action | undefined;
    fixture.componentInstance.activated.subscribe((value) => (emitted = value));
    const button = fixture.nativeElement.querySelector('button.rv-action-bar__button') as HTMLButtonElement;
    expect(button.dataset['appearance']).toBe('flat');
    expect(button.dataset['tone']).toBe('success');
    button.click();
    expect(emitted).toBe(action);
    fixture.destroy();
  });

  it('does not emit an action the consumer marked disabled or loading', () => {
    const action = { id: 8, name: 'Submit' } satisfies Action;
    const fixture = TestBed.createComponent(RiviniaActionBar<Action>);
    fixture.componentRef.setInput('items', [action]);
    fixture.componentRef.setInput('layout', 'buttons');
    fixture.componentRef.setInput('stateOf', () => ({ loading: true }));
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.activated.subscribe(() => (emitted = true));
    const button = fixture.nativeElement.querySelector('button.rv-action-bar__button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(emitted).toBe(false);
    fixture.destroy();
  });
  it('uses LTRA conventions without mapping and keeps a single adaptive action direct', async () => {
    const action = { id: 404, name: 'Reopen', color: '#16835d', order: 1 };
    const fixture = TestBed.createComponent(RiviniaActionBar<typeof action>);
    fixture.componentRef.setInput('items', [action]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const direct = fixture.nativeElement.querySelector('.rv-action-bar__items button') as HTMLButtonElement;
    expect(direct.textContent).toContain('Reopen');
    expect(direct.getAttribute('data-action-id')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rv-action-bar__more')).toBeNull();
    direct.click();
    fixture.destroy();
  });

  it('keeps explicit buttons layout out of the More menu', () => {
    const items = [{ id: 1, name: 'Approve' }, { id: 2, name: 'Reject' }];
    const fixture = TestBed.createComponent(RiviniaActionBar<(typeof items)[number]>);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('layout', 'buttons');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.rv-action-bar__items button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.rv-action-bar__more')).toBeNull();
    fixture.destroy();
  });

  it('renders optional custom action content while preserving the original event object', () => {
    const fixture = TestBed.createComponent(ActionTemplateHarness);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="custom-action"]')?.textContent).toContain('Custom label');
    (fixture.nativeElement.querySelector('.rv-action-bar__items button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.activated).toBe(fixture.componentInstance.items[0]);
    fixture.destroy();
  });

});
