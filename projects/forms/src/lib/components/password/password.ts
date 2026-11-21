import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import type { PasswordIconContext } from '../../models/password-icon-context';

@Component({
  selector: 'rv-password',
  imports: [NgTemplateOutlet],
  templateUrl: './password.html',
  host: { '(focusout)': 'onFocusOut($event)' },
  styleUrls: ['../../styles/input.css', './password.css'],
})
export class RiviniaPasswordComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly controlId = input('');
  readonly name = input('');
  readonly autocomplete = input<'current-password' | 'new-password' | 'off'>('current-password');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly toggleLabel = input('Show password');
  readonly showCapsLock = input(false, { transform: booleanAttribute });
  readonly capsLockLabel = input('Caps Lock is on');
  readonly strength = input<number | null>(null);
  readonly strengthLabel = input('Password strength');
  readonly strengthText = input('');
  protected readonly capsLock = signal(false);
  protected readonly strengthLevel = computed(() => {
    const level = this.strength();
    return level !== null && Number.isFinite(level) ? Math.min(4, Math.max(0, level)) : null;
  });
  readonly icon = input<TemplateRef<PasswordIconContext>>();
  readonly touch = output<void>();

  protected readonly revealed = signal(false);
  protected readonly toggle = (revealed: boolean) => !revealed;
  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  reset(): void {
    this.revealed.set(false);
  }

  protected trackCapsLock(event: KeyboardEvent): void {
    if (this.showCapsLock()) this.capsLock.set(event.getModifierState('CapsLock'));
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) {
      this.touch.emit();
    }
  }
}
