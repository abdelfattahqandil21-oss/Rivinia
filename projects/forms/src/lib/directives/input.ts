import { Directive, input } from '@angular/core';
import type { InputVariant } from '../models/input-variant';

@Directive({
  selector: 'input[rvInput], textarea[rvInput]',
  host: {
    class: 'rv-input',
    '[attr.data-rv-input-variant]': 'variant()',
  },
})
export class RiviniaInputDirective {
  readonly variant = input<InputVariant>('filled', { alias: 'rvInputVariant' });
}
