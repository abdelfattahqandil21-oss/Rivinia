import { bootstrapApplication } from '@angular/platform-browser';
import { provideRiviniaDatepicker } from '@rivinia/datepicker';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [provideRiviniaDatepicker({ locale: 'en-US' })],
}).catch((error: unknown) => console.error(error));
