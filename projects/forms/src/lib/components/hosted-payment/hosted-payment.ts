import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { HostedPaymentState } from '../../models/hosted-payment-state';

@Component({
  selector: 'rv-hosted-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hosted-payment.html',
  styleUrl: './hosted-payment.css',
})
export class RiviniaHostedPaymentComponent {
  readonly label = input('Card details');
  readonly state = input<HostedPaymentState>('loading');
  readonly loadingLabel = input('Loading payment fields…');
  readonly errorMessage = input('Payment fields could not be loaded.');
  readonly retryLabel = input('Try again');
  readonly retry = output<void>();
}
