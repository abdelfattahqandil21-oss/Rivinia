import { booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, input, model, output, viewChildren } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { RadioOption, RadioVariant } from '../../models/choice-variants';

@Component({
  selector: 'rv-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './radio-group.html',
  styleUrls: ['../../styles/choice.css', './radio-group.css'],
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaRadioGroupComponent implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly name = input.required<string>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly RadioOption[]>();
  readonly variant = input<RadioVariant>('stacked');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly describedBy = input('');
  readonly touch = output<void>();
  private readonly editors = viewChildren<ElementRef<HTMLInputElement>>('editor');

  focus(options?: FocusOptions): void {
    const inputs = this.editors().map(editor => editor.nativeElement);
    const target = inputs.find(editor => editor.checked && !editor.disabled)
      ?? inputs.find(editor => !editor.disabled);
    target?.focus(options);
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.touch.emit();
  }
}
