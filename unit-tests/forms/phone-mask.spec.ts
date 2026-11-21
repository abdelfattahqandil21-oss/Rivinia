import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expect, it, vi } from 'vitest';
import { RiviniaMaskComponent, RiviniaPhoneComponent } from '../../projects/forms/src/public-api';

@Component({
  imports: [ReactiveFormsModule, RiviniaPhoneComponent, RiviniaMaskComponent],
  template: `
    <rv-phone controlId="phone" [formControl]="phone" />
    <rv-mask controlId="reference" mask="##-####" [formControl]="reference" />
  `,
})
class Host {
  readonly phone = new FormControl('', { nonNullable: true });
  readonly reference = new FormControl('', { nonNullable: true });
}

it('lets the phone consumer own the entered value and validation', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector<HTMLInputElement>('#phone')!;
  input.value = '+20 012 345 6789';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(input.type).toBe('tel');
  expect(input.autocomplete).toBe('tel');
  expect(fixture.componentInstance.phone.value).toBe('+20 012 345 6789');
});

it('normalizes a pasted reference and deletes a digit across the separator', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector<HTMLInputElement>('#reference')!;
  input.value = '٠١-۲۳۴۵';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
  expect(input.value).toBe('01-2345');
  expect(fixture.componentInstance.reference.value).toBe('012345');

  input.setSelectionRange(3, 3);
  input.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'deleteContentBackward', cancelable: true, bubbles: true,
  }));
  fixture.detectChanges();
  expect(input.value).toBe('02-345');
  expect(input.selectionStart).toBe(1);
  expect(fixture.componentInstance.reference.value).toBe('02345');
});

it('reports an explicit missing Select adapter only on the base phone', () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const fixture = TestBed.createComponent(RiviniaPhoneComponent);
    fixture.detectChanges();
    expect(diagnostic).not.toHaveBeenCalled();
    fixture.componentRef.setInput('countryPicker', 'select');
    fixture.detectChanges();
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Install @rivinia/select'),
    }));
  } finally {
    diagnostic.mockRestore();
  }
});
