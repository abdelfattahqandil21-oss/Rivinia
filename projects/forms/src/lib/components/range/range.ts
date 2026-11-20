import {
  booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, input,
  model, numberAttribute, output, viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

@Component({
  selector: 'rv-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './range.html',
  styleUrl: './range.css',
  host: { '[attr.id]': 'null' },
})
export class RiviniaRangeComponent implements FormValueControl<number> {
  readonly value = model(50);
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly name = input('');
  readonly min = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
  readonly max = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
  readonly step = input(1, { transform: numberAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly showValue = input(true, { transform: booleanAttribute });
  readonly describedBy = input('');
  readonly valueText = input('');
  readonly touch = output<void>();

  private readonly slider = viewChild.required<ElementRef<HTMLInputElement>>('slider');

  focus(options?: FocusOptions): void {
    this.slider().nativeElement.focus(options);
  }
}
