import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { expect, it } from 'vitest';
import { RiviniaOtpComponent, RiviniaPasswordComponent } from '../src/public-api';

@Component({
  imports: [RiviniaOtpComponent, RiviniaPasswordComponent, FormField],
  template: `
    <ng-template #eye let-revealed>{{ revealed ? 'Visible' : 'Hidden' }}</ng-template>
    <rv-password controlId="password" [icon]="eye" [formField]="fields.password" />
    <rv-otp controlId="otp" [formField]="fields.code" (completed)="completions = completions + 1" />
  `,
})
class Host {
  readonly data = signal({ password: '', code: '' });
  readonly fields = form(this.data);
  completions = 0;
}

it('replaces the password icon without losing the native value or button semantics', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector<HTMLInputElement>('#password')!;
  input.value = 'sample value';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const toggle = root.querySelector<HTMLButtonElement>('button')!;
  expect(toggle.textContent?.trim()).toBe('Hidden');
  toggle.click();
  fixture.detectChanges();
  expect(input.type).toBe('text');
  expect(input.value).toBe('sample value');
  expect(toggle.textContent?.trim()).toBe('Visible');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
});

it('normalizes pasted OTP digits across native slots and signals completion once', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const controls = root.querySelectorAll<HTMLInputElement>('rv-otp input');
  expect(controls).toHaveLength(6);
  const input = controls[0];
  input.value = '٠١٢-٣٤٥';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
  expect(input.autocomplete).toBe('one-time-code');
  expect(fixture.componentInstance.data().code).toBe('012345');
  expect(Array.from(controls, (slot) => slot.value).join('')).toBe('012345');
  expect(fixture.componentInstance.completions).toBe(1);
});



it('keeps the configured slot count across verification and retry', () => {
  const fixture = TestBed.createComponent(RiviniaOtpComponent);
  fixture.componentRef.setInput('length', 4);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  expect(root.querySelectorAll('input')).toHaveLength(4);

  fixture.componentRef.setInput('state', 'checking');
  fixture.detectChanges();
  expect(root.querySelectorAll('input')).toHaveLength(0);
  expect(root.querySelectorAll('.motion-cell')).toHaveLength(4);
  const tile = root.querySelector('.status-tile');

  fixture.componentRef.setInput('state', 'failure');
  fixture.componentRef.setInput('failureLabel', 'Try a new code');
  fixture.detectChanges();
  expect(root.querySelector('.status-tile')).toBe(tile);
  expect(root.querySelector('[role="status"]')?.textContent).toContain('Try a new code');

  fixture.componentRef.setInput('state', 'entry');
  fixture.componentRef.setInput('length', 12);
  fixture.detectChanges();
  expect(root.querySelectorAll('input')).toHaveLength(12);
});
