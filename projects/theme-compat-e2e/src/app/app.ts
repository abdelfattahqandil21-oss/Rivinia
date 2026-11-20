import { Component, signal } from '@angular/core';
import type { RiviniaDate, RiviniaDateTime } from '@rivinia/datepicker';
import { RiviniaDatepickerComponent, RiviniaDatetimepickerComponent } from '@rivinia/datepicker/ui';
import { RiviniaSelectComponent } from '@rivinia/select/ui';
import { RiviniaModalDialog, RvModalFooter } from '@rivinia/modal/ui';

@Component({
  selector: 'theme-compat-root',
  imports: [RiviniaSelectComponent, RiviniaDatepickerComponent, RiviniaDatetimepickerComponent, RiviniaModalDialog, RvModalFooter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly modalOpen = signal(false);
  readonly options = [
    { id: 'draft', label: 'Draft' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'cancelled', label: 'Cancelled', disabled: true },
  ];
  readonly dateValue = signal<RiviniaDate | null>({ year: 2026, month: 11, day: 9 });
  readonly dateTime12 = signal<RiviniaDateTime | null>({
    date: { year: 2026, month: 11, day: 9 },
    time: { hour: 13, minute: 35, second: 42 },
  });
  readonly dateTime24 = signal<RiviniaDateTime | null>({
    date: { year: 2026, month: 11, day: 9 },
    time: { hour: 21, minute: 5, second: 7 },
  });
}
