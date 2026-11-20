import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField, form } from '@angular/forms/signals';
import { expect, it } from 'vitest';
import { RiviniaTextInputComponent } from '../src/public-api';

@Component({
  imports: [RiviniaTextInputComponent, ReactiveFormsModule, FormsModule, FormField],
  template: `
    <ng-template #icon><span class="custom-icon">User</span></ng-template>
    <form [formGroup]="group">
      <rv-input id="username" label="Username" name="username" variant="outlined"
        autocomplete="username" autocapitalize="off" [icon]="icon" required hint="Public name" formControlName="username" />
    </form>
    <rv-input id="email" label="Email" type="email" [formField]="fields.email" />
    <rv-input id="first-name" label="First name" [(ngModel)]="firstName" />
  `,
})
class Host {
  readonly group = new FormGroup({ username: new FormControl('', { nonNullable: true, validators: Validators.required }) });
  readonly data = signal({ email: '' });
  readonly fields = form(this.data);
  firstName = '';
}

it('transfers native attributes, uses optional icons and supports all three forms modes', async () => {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const username = root.querySelector<HTMLInputElement>('input#username')!;
  expect(root.querySelectorAll('#username')).toHaveLength(1);
  expect(root.querySelector<HTMLLabelElement>('label[for="username"]')?.control).toBe(username);
  expect(username.required).toBe(true);
  expect(username.autocomplete).toBe('username');
  expect(username.getAttribute('aria-describedby')).toBe('username-message');
  expect(root.querySelector('#username-message')?.textContent?.trim()).toBe('Public name');
  expect(username.dataset['rvInputVariant']).toBe('outlined');
  expect(username.closest('rv-input')?.querySelector('.custom-icon')).not.toBeNull();
  expect(root.querySelector('input#email')?.closest('rv-input')?.querySelector('rv-input-icon')).not.toBeNull();
  expect(root.querySelector('input#first-name')?.closest('rv-input')?.querySelector('.rv-input-icon')).toBeNull();

  for (const [id, value] of [['username', 'alex'], ['email', 'alex@example.com'], ['first-name', 'Alex']]) {
    const input = root.querySelector<HTMLInputElement>('input#' + id)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await fixture.whenStable();
  expect(fixture.componentInstance.group.value.username).toBe('alex');
  expect(fixture.componentInstance.data().email).toBe('alex@example.com');
  expect(fixture.componentInstance.firstName).toBe('Alex');
});
