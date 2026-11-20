import { booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';
import type { ToggleVariant } from '../../models/choice-variants';

@Component({
  selector: 'rv-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toggle.html',
  styleUrls: ['../../styles/choice.css', './toggle.css'],
})
export class RiviniaToggleComponent implements FormCheckboxControl {
  readonly checked = model(false);
  readonly label = input.required<string>();
  readonly name = input('');
  readonly variant = input<ToggleVariant>('switch');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly indeterminate = input(false, { transform: booleanAttribute });
  readonly describedBy = input('');
  readonly touch = output<void>();
  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }
}
