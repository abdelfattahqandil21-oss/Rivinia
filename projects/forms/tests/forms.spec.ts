import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormField, form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import {
  RiviniaDecimalInputComponent,
  RiviniaFormFieldComponent,
  RiviniaInputDirective,
} from '../src/public-api';
import { decimalSymbols, parseDecimalDraft } from '../src/lib/utils/decimal';

@Component({
  imports: [RiviniaDecimalInputComponent, ReactiveFormsModule, FormsModule, FormField],
  template: `
    <rv-decimal-input controlId="reactive" [formControl]="reactive" />
    <rv-decimal-input controlId="signals" locale="ar-EG" [formField]="fields.amount" />
    <rv-decimal-input controlId="template" [(ngModel)]="templateValue" />
  `,
})
class FormsHost {
  readonly reactive = new FormControl<string | null>('1.25');
  readonly data = signal<{ amount: string | null }>({ amount: null });
  readonly fields = form(this.data);
  templateValue: string | null = null;
}

@Component({
  imports: [RiviniaInputDirective, RiviniaFormFieldComponent],
  template: `
    <rv-form-field controlId="title" label="Title" hint="Use a short title."
      description="Shown to customers." [error]="error()">
      <input rvInput id="title" aria-describedby="title-description title-message" />
    </rv-form-field>
  `,
})
class FieldHost {
  readonly error = signal('');
}

describe('forms foundation', () => {
  it('preserves decimal precision and distinguishes partial drafts from empty input', () => {
    const symbols = decimalSymbols('en-US');
    expect(parseDecimalDraft('-', symbols)).toEqual({ state: 'incomplete' });
    expect(parseDecimalDraft('12.', symbols)).toEqual({ state: 'incomplete' });
    expect(parseDecimalDraft('', symbols)).toEqual({ state: 'empty' });
    expect(parseDecimalDraft('1,234', symbols)).toEqual({ state: 'invalid' });
    expect(parseDecimalDraft('-.50', symbols)).toEqual({ state: 'valid', value: '-0.50' });
    expect(parseDecimalDraft('999999999999999999.0001', symbols)).toEqual({
      state: 'valid', value: '999999999999999999.0001',
    });
  });

  it('commits, clears, cancels and honors disabled state across Angular forms', async () => {
    const fixture = TestBed.createComponent(FormsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const root: HTMLElement = fixture.nativeElement;
    const input = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!;
    const edit = (id: string, value: string) => {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input', { bubbles: true }));
    };
    const blur = (id: string) => {
      input(id).dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
    };

    edit('reactive', '-');
    blur('reactive');
    expect(host.reactive.value).toBe('1.25');
    expect(input('reactive').getAttribute('aria-invalid')).toBe('true');
    input('reactive').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(input('reactive').value).toBe('1.25');
    edit('reactive', '');
    blur('reactive');
    expect(host.reactive.value).toBeNull();
    expect(host.reactive.touched).toBe(true);

    edit('signals', '١٢٫٣٠');
    blur('signals');
    expect(host.data().amount).toBe('12.30');

    edit('template', '0.01');
    blur('template');
    await fixture.whenStable();
    expect(host.templateValue).toBe('0.01');

    host.reactive.disable();
    fixture.detectChanges();
    expect(input('reactive').disabled).toBe(true);
  });

  it('shows the field error in place of the hint and keeps the description', () => {
    const fixture = TestBed.createComponent(FieldHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('label')?.htmlFor).toBe('title');
    expect(root.querySelector('#title-message')?.textContent).toBe('Use a short title.');
    fixture.componentInstance.error.set('Title is required.');
    fixture.detectChanges();
    expect(root.querySelector('#title-message')?.textContent).toBe('Title is required.');
    expect(root.querySelector('#title-description')?.textContent).toBe('Shown to customers.');
    expect(root.querySelector('input')?.classList.contains('rv-input')).toBe(true);
  });
});

it('preserves the same message ID as field feedback changes priority', () => {
  const fixture = TestBed.createComponent(RiviniaFormFieldComponent);
  const inputs = {
    controlId: 'feedback',
    description: 'Field information',
    hint: 'Hint',
    success: 'Success',
    warning: 'Warning',
    pending: 'Pending',
    error: 'Error',
  };
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  for (const kind of ['error', 'pending', 'warning', 'success', 'hint'] as const) {
    const message = root.querySelector('#feedback-message');
    expect(message?.getAttribute('data-kind')).toBe(kind);
    expect(message?.textContent?.trim()).toBe(inputs[kind]);
    fixture.componentRef.setInput(kind, '');
    fixture.detectChanges();
  }
  expect(root.querySelector('#feedback-message')).toBeNull();
  expect(root.querySelector('#feedback-description')?.textContent).toBe('Field information');
});
