import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef, input, model, output,
  type TemplateRef, viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { RiviniaInputDirective } from '../../directives/input';
import type { InputVariant } from '../../models/input-variant';
import { RiviniaFormFieldComponent } from '../form-field/form-field';
import { RiviniaInputIconComponent } from '../input-icon/input-icon';

@Component({
  selector: 'rv-input',
  imports: [NgTemplateOutlet, RiviniaInputDirective, RiviniaInputIconComponent, RiviniaFormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-input.html',
  styleUrls: ['../../styles/input.css', './text-input.css'],
  host: { '[attr.id]': 'null', '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaTextInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly name = input('');
  readonly type = input<'text' | 'email' | 'search' | 'url' | 'tel'>('text');
  readonly variant = input<InputVariant>('filled');
  readonly autocomplete = input('');
  readonly autocapitalize = input('');
  readonly placeholder = input('');
  readonly describedBy = input('');
  readonly description = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly pendingText = input('');
  readonly warning = input('');
  readonly success = input('');
  readonly reserveMessageSpace = input(false, { transform: booleanAttribute });
  readonly icon = input<TemplateRef<unknown> | null>();
  readonly clearable = input(false, { transform: booleanAttribute });
  readonly clearLabel = input('Clear text');
  readonly clearIcon = input<TemplateRef<unknown>>();
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly descriptionIds = computed(() => {
    const id = this.controlId();
    const hasMessage = this.error() || this.pendingText() || this.warning() || this.success() || this.hint();
    return [
      this.describedBy(),
      this.description() ? id + '-description' : '',
      hasMessage ? id + '-message' : '',
    ].filter(Boolean).join(' ') || null;
  });

  private readonly editor = viewChild.required<ElementRef<HTMLInputElement>>('editor');

  focus(options?: FocusOptions): void {
    this.editor().nativeElement.focus(options);
  }

  protected clear(): void {
    if (!this.clearable() || this.disabled() || this.readonly()) return;
    this.value.set('');
    this.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.touch.emit();
  }

  protected edit(editor: HTMLInputElement, event: Event): void {
    if (!(event as InputEvent).isComposing) this.value.set(editor.value);
  }
}
