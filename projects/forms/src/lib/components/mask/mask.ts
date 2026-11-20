import { ChangeDetectionStrategy, Component, computed, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { formatDigitMask, maskDigits } from '../../utils/digit-mask';
import { normalizeDigits } from '../../utils/digits';

@Component({
  selector: 'rv-mask',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mask.html',
  styleUrls: ['../../styles/input.css', '../../styles/text-control.css'],
})
export class RiviniaMaskComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly mask = input.required<string>();
  readonly controlId = input('');
  readonly name = input('');
  readonly describedBy = input('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();

  private readonly slots = computed(() => {
    const pattern = this.mask();
    return /[0-9]/.test(normalizeDigits(pattern)) ? 0 : (pattern.match(/#/g)?.length ?? 0);
  });
  protected readonly display = computed(() => this.format(this.value()));
  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  protected onInput(editor: HTMLInputElement, event: Event): void {
    if (!(event as InputEvent).isComposing) this.edit(editor);
  }

  protected edit(editor: HTMLInputElement): void {
    const limit = this.slots() || Infinity;
    const raw = maskDigits(editor.value, limit);
    const left = maskDigits(editor.value.slice(0, editor.selectionStart ?? editor.value.length), limit);
    const display = this.format(raw);
    if (editor.value !== display) {
      editor.value = display;
      const position = this.format(left).length;
      editor.setSelectionRange(position, position);
    }
    this.value.set(raw);
  }

  protected deleteAcrossLiteral(editor: HTMLInputElement, event: Event): void {
    const action = event as InputEvent;
    const start = editor.selectionStart;
    if (!action.cancelable || action.isComposing || start === null || start !== editor.selectionEnd) return;
    const backward = action.inputType === 'deleteContentBackward';
    if (!backward && action.inputType !== 'deleteContentForward') return;
    const adjacent = editor.value[backward ? start - 1 : start];
    if (!adjacent || /[0-9]/.test(adjacent)) return;
    const digits = maskDigits(editor.value, Infinity);
    const before = maskDigits(editor.value.slice(0, start), Infinity).length;
    const remove = backward ? before - 1 : before;
    if (remove < 0 || remove >= digits.length) return;
    action.preventDefault();
    const raw = digits.slice(0, remove) + digits.slice(remove + 1);
    editor.value = this.format(raw);
    const caret = this.format(raw.slice(0, remove)).length;
    editor.setSelectionRange(caret, caret);
    this.value.set(raw);
  }

  private format(raw: string): string {
    return this.slots() ? formatDigitMask(raw, this.mask()) : raw;
  }
}
