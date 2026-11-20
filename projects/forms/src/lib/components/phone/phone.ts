import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, isDevMode, model, output, type TemplateRef, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import type { PhoneCountry } from '../../models/phone-country';
import { RiviniaFormFieldComponent } from '../form-field/form-field';
import { RiviniaInputIconComponent } from '../input-icon/input-icon';

@Component({
  imports: [NgTemplateOutlet, RiviniaInputIconComponent, RiviniaFormFieldComponent],
  selector: 'rv-phone, rv-phone-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone.html',
  styleUrls: ['../../styles/input.css', '../../styles/text-control.css', './phone.css'],
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaPhoneComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly controlId = input('');
  readonly name = input('');
  readonly autocomplete = input('tel');
  readonly countries = input<readonly PhoneCountry[]>([]);
  readonly country = model('');
  readonly countryPicker = input<'native' | 'select'>('native');
  readonly countryLabel = input('Country or region');
  readonly countrySelect = input<TemplateRef<{ disabled: boolean }>>();
  readonly icon = input<TemplateRef<unknown> | null>();
  readonly describedBy = input('');
  readonly label = input('');
  readonly hint = input('');
  readonly error = input('');
  protected readonly descriptionIds = computed(() =>
    [this.describedBy(), this.error() || this.hint() ? this.controlId() + '-message' : ''].filter(Boolean).join(' ') || null,
  );
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly hasCountry = computed(() => this.countries().some(option => option.code === this.country()));
  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');

  constructor() {
    if (isDevMode()) {
      effect(() => {
        if (this.countryPicker() !== 'select' || this.countrySelect()) return;
        console.error(
          new Error(
            '[Rivinia Forms] Phone Select integration is missing. Install @rivinia/select and import ' +
              'RiviniaSelectPhoneComponent from @rivinia/forms/select, or provide a countrySelect template.',
          ),
        );
      });
    }
  }

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.touch.emit();
  }

  protected onInput(editor: HTMLInputElement, event: Event): void {
    if (!(event as InputEvent).isComposing) this.value.set(editor.value);
  }
}
