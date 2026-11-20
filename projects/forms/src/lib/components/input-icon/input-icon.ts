import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'rv-input-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-icon.html',
  styleUrl: './input-icon.css',
  host: { class: 'rv-input-icon', 'aria-hidden': 'true' },
})
export class RiviniaInputIconComponent {
  readonly name = input.required<'search' | 'mail' | 'phone'>();
}
