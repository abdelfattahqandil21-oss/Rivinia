import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'rv-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
})
export class RiviniaFormFieldComponent {
  readonly controlId = input.required<string>();
  readonly label = input('');
  readonly description = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly pending = input('');
  readonly warning = input('');
  readonly success = input('');

  protected readonly message = computed(() => {
    const error = this.error();
    if (error) return { kind: 'error', text: error };
    const pending = this.pending();
    if (pending) return { kind: 'pending', text: pending };
    const warning = this.warning();
    if (warning) return { kind: 'warning', text: warning };
    const success = this.success();
    if (success) return { kind: 'success', text: success };
    const hint = this.hint();
    return hint ? { kind: 'hint', text: hint } : null;
  });
  readonly reserveMessageSpace = input(false);
}
