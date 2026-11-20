import {
  afterRenderEffect, booleanAttribute, ChangeDetectionStrategy, Component, computed,
  ElementRef, input, model, output, untracked, viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { OtpState } from '../../models/otp-state';
import { normalizeDigits } from '../../utils/digits';

@Component({
  selector: 'rv-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp.html',
  styleUrls: ['../../styles/input.css', './otp.css'],
  host: { '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaOtpComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly length = input(6);
  readonly alphabet = input<'numeric' | 'alphanumeric'>('numeric');
  readonly controlId = input('');
  readonly name = input('');
  readonly label = input('Verification code');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly state = input<OtpState>('entry');
  readonly checkingLabel = input('Checking your code');
  readonly successLabel = input('Code verified');
  readonly failureLabel = input('Code verification failed');
  readonly touch = output<void>();
  readonly completed = output<void>();

  protected readonly size = computed(() => {
    const length = this.length();
    return Number.isFinite(length) ? Math.min(12, Math.max(1, Math.trunc(length))) : 6;
  });
  protected readonly indexes = computed(() => Array.from({ length: this.size() }, (_, i) => i));
  private readonly editors = viewChildren<ElementRef<HTMLInputElement>>('slot');

  constructor() {
    afterRenderEffect(() => {
      if (this.autofocus() && this.editors().length) untracked(() => this.focus());
    });
  }

  focus(options?: FocusOptions): void {
    this.focusSlot(Math.min(this.value().length, this.size() - 1), options);
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) {
      this.touch.emit();
    }
  }

  protected onInput(index: number, editor: HTMLInputElement, event: Event): void {
    if (!(event as InputEvent).isComposing) this.edit(index, editor, editor.value);
  }

  protected paste(index: number, editor: HTMLInputElement, event: ClipboardEvent): void {
    if (this.readonly() || !event.clipboardData) return;
    event.preventDefault();
    this.edit(index, editor, event.clipboardData.getData('text'));
  }

  protected edit(index: number, editor: HTMLInputElement, text: string): void {
    const previous = this.value().slice(0, this.size());
    const start = Math.min(index, previous.length);
    const allowed = this.alphabet() === 'numeric' ? /[^0-9]/g : /[^a-zA-Z0-9]/g;
    const fragment = normalizeDigits(text).replace(allowed, '').slice(0, this.size());
    const offset = fragment.length === this.size() ? 0 : start;
    const value = fragment
      ? (previous.slice(0, offset) + fragment + previous.slice(offset + fragment.length)).slice(0, this.size())
      : text ? previous : previous.slice(0, start) + previous.slice(start + 1);
    editor.value = value[index] ?? '';
    this.update(value);
    if (fragment) this.focusSlot(Math.min(offset + fragment.length, this.size() - 1));
  }

  protected keydown(index: number, event: KeyboardEvent): void {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusSlot(index + (event.key === 'ArrowLeft' ? -1 : 1));
    } else if (event.key === 'Backspace' && !this.readonly() && !this.value()[index] && index > 0) {
      event.preventDefault();
      const remove = Math.min(index, this.value().length) - 1;
      if (remove >= 0) this.update(this.value().slice(0, remove) + this.value().slice(remove + 1));
      this.focusSlot(Math.max(0, remove));
    }
  }

  private update(value: string): void {
    const changed = this.value() !== value;
    for (const [index, { nativeElement }] of this.editors().entries()) {
      const digit = value[index] ?? '';
      if (nativeElement.value !== digit) nativeElement.value = digit;
    }
    this.value.set(value);
    if (changed && value.length === this.size()) this.completed.emit();
  }

  private focusSlot(index: number, options?: FocusOptions): void {
    const editor = this.editors()[index]?.nativeElement;
    if (!this.disabled() && editor) {
      editor.focus(options);
      editor.select();
    }
  }
}
