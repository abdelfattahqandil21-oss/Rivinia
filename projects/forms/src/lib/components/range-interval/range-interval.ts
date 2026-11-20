import { booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { RangeInterval } from '../../models/range-interval';

@Component({
  selector: 'rv-range-interval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './range-interval.html',
  styleUrl: './range-interval.css',
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaRangeIntervalComponent implements FormValueControl<RangeInterval> {
  readonly value = model<RangeInterval>([25, 75]);
  readonly label = input.required<string>();
  readonly lowerLabel = input('Minimum');
  readonly upperLabel = input('Maximum');
  readonly lowerBound = input(0);
  readonly upperBound = input(100);
  readonly step = input(1);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  private readonly lower = viewChild.required<ElementRef<HTMLInputElement>>('lower');

  focus(options?: FocusOptions): void {
    this.lower().nativeElement.focus(options);
  }

  protected move(index: 0 | 1, slider: HTMLInputElement): void {
    const [lower, upper] = this.value();
    const next = slider.valueAsNumber;
    if (index === 0) {
      const clamped = Math.min(next, upper);
      slider.valueAsNumber = clamped;
      this.value.set([clamped, upper]);
    } else {
      const clamped = Math.max(next, lower);
      slider.valueAsNumber = clamped;
      this.value.set([lower, clamped]);
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.touch.emit();
  }
}
