import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SavedCardDetails } from '../../models/saved-card';

@Component({
  selector: 'rv-saved-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-card.html',
  styleUrl: './saved-card.css',
})
export class RiviniaSavedCardComponent {
  readonly card = input.required<SavedCardDetails>();
  readonly endingLabel = input('Ending in');
  readonly expiryLabel = input('Expires');
  protected readonly last4 = computed(() => {
    const digits = this.card().last4;
    return /^[0-9]{4}$/.test(digits) ? digits : '';
  });
  protected readonly expiry = computed(() => {
    const { expiryMonth, expiryYear } = this.card();
    if (expiryMonth === undefined || expiryYear === undefined ||
        !Number.isInteger(expiryMonth) || !Number.isInteger(expiryYear) ||
        expiryMonth < 1 || expiryMonth > 12 || expiryYear < 2000 || expiryYear > 9999) {
      return '';
    }
    return String(expiryMonth).padStart(2, '0') + '/' + String(expiryYear).slice(-2);
  });
}
