import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { DecimalCurrency } from '../../models/decimal-currency';
import { stepDecimal } from '../../utils/decimal-step';
import { decimalSymbols, parseDecimalDraft } from '../../utils/decimal';

@Component({
  selector: 'rv-decimal-input',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decimal-input.html',
  styleUrls: ['../../styles/input.css', '../../styles/text-control.css', './decimal-input.css'],
})
export class RiviniaDecimalInputComponent implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly controlId = input('');
  readonly name = input('');
  readonly locale = input('en-US');
  readonly prefix = input('');
  readonly currencies = input<readonly DecimalCurrency[]>([]);
  readonly currency = model('');
  readonly currencyLabel = input('Currency');
  readonly currencySelect = input<import('@angular/core').TemplateRef<{ disabled: boolean }>>();
  protected readonly selectedCurrency = computed(() =>
    this.currencies().find(option => option.code === this.currency()),
  );
  readonly suffix = input('');
  readonly showSteppers = input(false, { transform: booleanAttribute });
  readonly increment = input('1');
  readonly incrementLabel = input('Increase value');
  readonly decrementLabel = input('Decrease value');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly touch = output<void>();
  readonly draftChange = output<string>();
  readonly draftRejected = output<string>();

  protected readonly canStep = computed(() => {
    const increment = this.increment();
    return !this.disabled() && !this.readonly()
      && /^\d+(?:\.\d+)?$/.test(increment) && /[1-9]/.test(increment);
  });

  protected composing = false;
  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');
  private readonly symbols = computed(() => decimalSymbols(this.locale()));
  private readonly display = computed(() => {
    const { decimal, minus, digits } = this.symbols();
    return (this.value() ?? '').replace(/[\d.-]/g, (part) => {
      if (part === '.') return decimal;
      if (part === '-') return minus;
      return digits[Number(part)];
    });
  });
  protected readonly draft = linkedSignal(() => this.display());
  protected readonly rejected = linkedSignal(() => {
    this.display();
    return false;
  });

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  reset(): void {
    this.restore();
    this.draftChange.emit(this.draft());
  }

  protected edit(text: string): void {
    this.draft.set(text);
    this.rejected.set(false);
    if (!this.composing) this.draftChange.emit(text);
  }

  protected endComposition(text: string): void {
    this.composing = false;
    this.edit(text);
  }

  protected finish(): void {
    if (this.composing || this.readonly() || this.disabled()) return;
    const text = this.draft();
    if (text !== this.display()) {
      const result = parseDecimalDraft(text, this.symbols());
      if (result.state === 'valid') {
        this.value.set(result.value);
        this.restore();
      } else if (result.state === 'empty') {
        this.value.set(null);
        this.restore();
      } else if (!this.rejected()) {
        this.rejected.set(true);
        this.draftRejected.emit(text);
      }
    }
    this.touch.emit();
  }

  protected cancel(event: Event): void {
    if (this.composing || this.draft() === this.display()) return;
    event.preventDefault();
    event.stopPropagation();
    this.restore();
    this.draftChange.emit(this.draft());
  }

  protected stepBy(direction: -1 | 1): void {
    if (!this.canStep() || this.composing) return;
    const draft = parseDecimalDraft(this.draft(), this.symbols());
    if (draft.state !== 'empty' && draft.state !== 'valid') {
      this.finish();
      return;
    }
    this.value.set(stepDecimal(draft.state === 'valid' ? draft.value : '0', this.increment(), direction));
    this.restore();
    this.draftChange.emit(this.draft());
    this.touch.emit();
  }

  private restore(): void {
    this.draft.set(this.display());
    this.rejected.set(false);
  }
}
