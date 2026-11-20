import {
  ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, effect, inject,
  input, model, output, signal, viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { connectPopup } from '@rivinia/popup';
import {
  DATE_PICKER_CONFIG, compareTime, datepickerLabelsFor, formatTime, isValidTime, nowTime,
} from '@rivinia/datepicker';
import type {
  RiviniaDatepickerLabels, RiviniaDatepickerTheme, RiviniaHour12, RiviniaTime, RiviniaTimeFormat,
} from '@rivinia/datepicker';
import { RiviniaTimeRowComponent } from '../time-row/time-row';
import { confirmPickerValue, type RiviniaPickerApplied } from '../../utils/picker-confirmation';

let nextId = 0;

@Component({
  selector: 'rv-timepicker',
  imports: [RiviniaTimeRowComponent],
  templateUrl: './timepicker.html',
  styleUrls: ['../datepicker/datepicker.css', './timepicker.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-theme]': 'effectiveTheme()', '[attr.data-open]': 'opened()' },
})
export class RiviniaTimepickerComponent implements FormValueControl<RiviniaTime | null> {
  private readonly config = inject(DATE_PICKER_CONFIG, { optional: true }) ?? {};
  readonly value = model<RiviniaTime | null>(null);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly locale = input<string>();
  readonly labels = input<Partial<RiviniaDatepickerLabels>>({});
  readonly label = input<string>();
  readonly placeholder = input<string>();
  readonly theme = input<RiviniaDatepickerTheme>();
  readonly clearable = input<boolean>();
  readonly timeFormat = input<RiviniaTimeFormat>();
  readonly hour12 = input<RiviniaHour12>();
  readonly showSeconds = input<boolean>();
  readonly minuteStep = input<number>();
  readonly min = input<RiviniaTime>();
  readonly max = input<RiviniaTime>();
  readonly disabledTime = input<(time: RiviniaTime) => boolean>();
  readonly touch = output<void>();
  readonly applied = output<RiviniaPickerApplied<RiviniaTime>>();
  readonly openedChange = output<boolean>();
  readonly cancelled = output<void>();

  private readonly editing = signal(false);
  private readonly session = signal<{ base: RiviniaTime | null; draft: RiviniaTime | null }>({
    base: null, draft: null,
  });
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  protected readonly panelId = 'rv-timepicker-' + ++nextId;
  protected readonly blocked = computed(() => this.disabled() || this.readonly());
  protected readonly opened = computed(() => this.editing() && !this.blocked());
  protected readonly effectiveLocale = computed(() => this.locale() ?? this.config.locale ?? 'en-US');
  protected readonly effectiveTheme = computed(() => this.theme() ?? this.config.theme ?? 'auto');
  protected readonly effectiveLabels = computed(() => ({
    ...datepickerLabelsFor(this.effectiveLocale()), ...this.config.labels, ...this.labels(),
  }));
  protected readonly effectiveHour12 = computed(() => this.hour12() ?? this.config.hour12 ?? 'auto');
  protected readonly effectiveSeconds = computed(() => this.showSeconds() ?? this.config.showSeconds ?? false);
  protected readonly effectiveStep = computed(() => this.minuteStep() ?? this.config.minuteStep ?? 1);
  protected readonly effectiveClearable = computed(() => this.clearable() ?? this.config.clearable ?? false);
  protected readonly draft = computed(() => {
    const { base, draft } = this.session();
    return base === this.value() ? draft : this.value();
  });
  protected readonly rowValue = computed(() => this.draft() ?? { hour: 0, minute: 0, second: 0 });
  protected readonly text = computed(() => {
    const value = this.value();
    const hour12 = this.effectiveHour12();
    return value
      ? formatTime(this.effectiveLocale(), value, this.timeFormat() ?? this.config.timeFormat ?? (this.effectiveSeconds() ? 'medium' : 'short'), {
          hour12: hour12 === 'auto' ? undefined : hour12,
        })
      : this.placeholder() ?? this.effectiveLabels().chooseTime ?? this.effectiveLabels().chooseDateTime;
  });

  constructor() {
    effect(() => {
      if (this.blocked() && this.editing()) this.finish(false);
    });
    afterRenderEffect((onCleanup) => {
      if (!this.opened()) return;
      const origin = this.trigger()?.nativeElement;
      const panel = this.panel()?.nativeElement;
      if (!origin || !panel) return;
      if (typeof panel.showPopover === 'function') {
        panel.setAttribute('popover', 'manual');
        if (!panel.matches(':popover-open')) panel.showPopover();
        const popup = connectPopup({
          origin, panel, parent: 'auto', placement: 'bottom-start', offset: 4, padding: 4,
          onDismiss: (reason) => this.finish(reason === 'escape'),
        });
        onCleanup(() => {
          popup.destroy();
          if (panel.matches(':popover-open')) panel.hidePopover();
        });
      }
      panel.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
  }

  focus(options?: FocusOptions): void {
    this.trigger()?.nativeElement.focus(options);
  }

  open(): void {
    if (this.editing() || this.blocked()) return;
    const base = this.value();
    this.session.set({ base, draft: base ? { ...base } : nowTime() });
    this.editing.set(true);
    this.openedChange.emit(true);
  }

  close(): void {
    this.finish(false);
  }

  toggle(): void {
    if (this.editing()) this.cancel();
    else this.open();
  }

  cancel(): void {
    if (!this.editing()) return;
    this.finish(true);
  }

  clear(): void {
    if (this.opened() && this.effectiveClearable()) this.updateDraft(null);
  }

  apply(): boolean {
    if (!this.opened()) return false;
    const draft = this.draft();
    if (!this.canApply()) return false;
    const previous = this.value();
    const changed = previous && draft ? compareTime(previous, draft) !== 0 : previous !== draft;
    confirmPickerValue(this.value, this.applied, draft && { ...draft }, changed);
    this.finish(true, false);
    return true;
  }

  protected readonly canApply = computed(() => {
    const time = this.draft();
    if (!time) return !this.required();
    const min = this.min();
    const max = this.max();
    return isValidTime(time)
      && (!min || (isValidTime(min) && compareTime(time, min) >= 0))
      && (!max || (isValidTime(max) && compareTime(time, max) <= 0))
      && !this.disabledTime()?.(time);
  });

  protected updateDraft(draft: RiviniaTime | null): void {
    if (this.opened()) this.session.set({ base: this.value(), draft });
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    this.cancel();
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = this.trigger()?.nativeElement.parentElement?.parentElement;
    if (event.relatedTarget && !host?.contains(event.relatedTarget as Node)) this.close();
  }

  private finish(restoreFocus: boolean, cancelled = true): void {
    if (!this.editing()) return;
    this.editing.set(false);
    this.openedChange.emit(false);
    if (cancelled) this.cancelled.emit();
    this.touch.emit();
    if (restoreFocus) this.focus({ preventScroll: true });
  }
}
