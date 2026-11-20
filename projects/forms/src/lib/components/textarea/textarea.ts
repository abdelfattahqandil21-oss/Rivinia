import {
  booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef,
  input, model, output, viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { RiviniaInputDirective } from '../../directives/input';
import type { InputVariant } from '../../models/input-variant';

@Component({
  selector: 'rv-textarea',
  imports: [RiviniaInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './textarea.html',
  styleUrls: ['../../styles/input.css', './textarea.css'],
  host: { '[attr.id]': 'null' },
})
export class RiviniaTextareaComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly name = input('');
  readonly variant = input<InputVariant>('filled');
  readonly rows = input(4);
  readonly autoGrow = input(false, { transform: booleanAttribute });
  readonly maxRows = input(8);

  protected readonly minimumRows = computed(() => {
    const rows = this.rows();
    return Number.isFinite(rows) ? Math.max(1, Math.trunc(rows)) : 4;
  });
  protected readonly maximumRows = computed(() => {
    const rows = this.maxRows();
    return Math.max(this.minimumRows(), Number.isFinite(rows) ? Math.trunc(rows) : 8);
  });
  readonly maxLength = input<number | undefined>();
  readonly showCount = input(false, { transform: booleanAttribute });
  readonly placeholder = input('');
  readonly describedBy = input('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly countLabel = input('Character count');
  readonly touch = output<void>();

  protected readonly count = computed(() => (this.value() || '').length);
  protected readonly description = computed(() =>
    [this.describedBy(), this.showCount() ? this.controlId() + '-count' : ''].filter(Boolean).join(' ') || null,
  );

  private readonly editor = viewChild.required<ElementRef<HTMLTextAreaElement>>('editor');

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  protected edit(editor: HTMLTextAreaElement, event: Event): void {
    if (!(event as InputEvent).isComposing) this.value.set(editor.value);
  }
}
