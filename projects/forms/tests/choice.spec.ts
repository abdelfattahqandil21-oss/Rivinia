import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expect, it } from 'vitest';
import { RiviniaRadioGroupComponent, RiviniaToggleComponent } from '../src/public-api';

@Component({
  imports: [ReactiveFormsModule, RiviniaRadioGroupComponent, RiviniaToggleComponent],
  template: `
    <rv-radio-group name="mode" label="Mode" [options]="options" [formControl]="mode" />
    <rv-toggle label="Notifications" [formControl]="notifications" />
  `,
})
class Host {
  readonly mode = new FormControl<string | null>('a');
  readonly notifications = new FormControl(false, { nonNullable: true });
  readonly options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
}

it('binds native radio selection and switch state to Reactive Forms', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const radios = root.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  const toggle = root.querySelector<HTMLInputElement>('input[role="switch"]')!;
  expect(radios[0].checked).toBe(true);
  radios[1].click();
  expect(fixture.componentInstance.mode.value).toBe('b');
  toggle.click();
  expect(fixture.componentInstance.notifications.value).toBe(true);
  fixture.componentInstance.notifications.disable();
  fixture.detectChanges();
  expect(toggle.disabled).toBe(true);
});
