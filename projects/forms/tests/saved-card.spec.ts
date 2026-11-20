import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { RiviniaSavedCardComponent } from '../src/public-api';

it('displays the saved suffix and expiry, and suppresses a malformed suffix', () => {
  const fixture = TestBed.createComponent(RiviniaSavedCardComponent);
  fixture.componentRef.setInput('card', { brand: 'Visa', last4: '0042', expiryMonth: 8, expiryYear: 2029 });
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  expect(root.textContent).toContain('0042');
  expect(root.textContent).toContain('08/29');
  fixture.componentRef.setInput('card', { brand: 'Visa', last4: '12345678', expiryMonth: 13, expiryYear: 2029 });
  fixture.detectChanges();
  expect(root.textContent).not.toContain('12345678');
  expect(root.textContent).not.toContain('Expires');
});
