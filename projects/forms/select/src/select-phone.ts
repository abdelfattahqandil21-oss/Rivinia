import {
  booleanAttribute, ChangeDetectionStrategy, Component, computed, input,
  model, output, type TemplateRef, viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { RiviniaPhoneComponent, type PhoneCountry } from '@rivinia/forms';
import { RiviniaSelectComponent, type SelectChange } from '@rivinia/select/ui';

@Component({
  selector: 'rv-phone',
  imports: [RiviniaPhoneComponent, RiviniaSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-phone.html',
  styleUrl: './select-phone.css',
  host: { '[attr.id]': 'null' },
})
export class RiviniaSelectPhoneComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly country = model('');
  readonly countries = input<readonly PhoneCountry[]>([]);
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly name = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly describedBy = input('');
  readonly autocomplete = input('tel');
  readonly countryLabel = input('Country or region');
  readonly countryPlaceholder = input('Country');
  readonly icon = input<TemplateRef<unknown> | null>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly options = computed(() => this.countries().map(option => ({
    id: option.code,
    label: option.code + ' ' + option.dialCode,
    hint: option.label,
  })));

  private readonly editor = viewChild.required(RiviniaPhoneComponent);

  focus(options?: FocusOptions): void {
    this.editor().focus(options);
  }

  protected select(value: SelectChange): void {
    this.country.set(typeof value === 'string' ? value : '');
  }
}
