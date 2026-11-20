import { Directive, input } from '@angular/core';
import type { ButtonVariant } from '../models/choice-variants';

@Directive({
  selector: 'button[rvButton]',
  host: { class: 'rv-button', '[attr.data-rv-button-variant]': 'variant()' },
})
export class RiviniaButtonDirective {
  readonly variant = input<ButtonVariant>('primary', { alias: 'rvButtonVariant' });
}
