import { confirmPickerValue, type RiviniaPickerApplied } from '../../utils/picker-confirmation';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { connectPopup } from '@rivinia/popup';
import type { FormValueControl } from '@angular/forms/signals';
import {
  DATE_PICKER_CONFIG,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  RiviniaCalendar,
  RiviniaDateTimeDraft,
  RIVINIA_TIME_ZONE_RESOLVER,
  resolveDateTimeZone,
  formatDateTime,
  formatTime,
  formatTimeZoneName,
  isSameDateTime,
  isValidTimeZone,
  nowDateTime,
  nowInTimeZone,
  parseDate,
  parseDateTime,
  todayDate,
  todayInTimeZone,
} from '@rivinia/datepicker';
import type {
  RiviniaDate,
  RiviniaDateFormat,
  RiviniaDateTime,
  RiviniaDateTimeResolution,
  RiviniaDatepickerConfig,
  RiviniaDatepickerLabels,
  RiviniaDatepickerTheme,
  RiviniaHour12,
  RiviniaTime,
  RiviniaTimeFormat,
  RiviniaTimeZoneAlternative,
  RiviniaTimeZoneResolution,
  RiviniaZoneCommitPolicy,
  RiviniaWeekday,
} from '@rivinia/datepicker';
import { RiviniaCalendarComponent } from '../calendar/calendar';
import { dateFormatHint } from '../../utils/date-format-hint';
import { RiviniaDateSegmentsComponent } from '../date-segments/date-segments';
import { RiviniaTimeRowComponent } from '../time-row/time-row';
import { DatepickerPanelRegistry } from '../../services/datepicker-panel-registry';
import {
  PANEL_EXIT_FALLBACK_MS,
  panelExitMotionEnabled,
  panelViewportShift,
} from '../../utils/panel-motion';

let nextId = 0;

/**
 * `<rv-datetimepicker>` — the date panel with a time row inside it.
 *
 * The panel is the same one `rv-datepicker` uses: the calendar is never
 * unmounted while the time row is used, so the visible month, the focused day
 * and the selected date survive editing the time. The time is a DRAFT until
 * OK; Escape, an outside click, or leaving the control discards it (a time
 * alone is incomplete). Tabbing out never moves focus back to the trigger.
 *
 * The value is civil on purpose: `{ date, time }` and no zone. The `resolved`
 * output carries the instant the chosen zone gives that wall time, including
 * the user's choice when the clock falls back. That keeps the package usable
 * for a form (civil) and for an API (instant) without storing two shapes.
 */
@Component({
  selector: 'rv-datetimepicker',
  imports: [RiviniaCalendarComponent, RiviniaDateSegmentsComponent, RiviniaTimeRowComponent],
  templateUrl: './datetimepicker.html',
  styleUrls: ['../datepicker/datepicker.css', './datetimepicker.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RiviniaCalendar],
  host: {
    class: 'rv-datetimepicker',
    '[attr.data-open]': 'open() ? "true" : null',
    '[attr.data-disabled]': 'isDisabled() ? "true" : null',
    '[attr.data-theme]': 'effectiveTheme()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class RiviniaDatetimepickerComponent implements FormValueControl<RiviniaDateTime | null> {
  private readonly zoneResolver = inject(RIVINIA_TIME_ZONE_RESOLVER);
  private readonly config = inject<RiviniaDatepickerConfig>(DATE_PICKER_CONFIG);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly panels = inject(DatepickerPanelRegistry);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly calendar = inject(RiviniaCalendar);

  readonly value = model<RiviniaDateTime | null>(null);

  readonly locale = input<string | undefined>(undefined);
  readonly format = input<RiviniaDateFormat | undefined>(undefined);
  readonly timeFormat = input<RiviniaTimeFormat | undefined>(undefined);
  readonly showSeconds = input<boolean | undefined>(undefined);
  readonly minuteStep = input<number | undefined>(undefined);
  readonly hour12 = input<RiviniaHour12 | undefined>(undefined);
  readonly timeZone = input<string | undefined>(undefined);
  readonly zoneCommitPolicy = input<RiviniaZoneCommitPolicy>('compatible');
  readonly firstDay = input<RiviniaWeekday | undefined>(undefined);
  /** Inclusive civil lower bound; confirmation checks both date and time. */
  readonly min = input<RiviniaDateTime | undefined>(undefined);
  /** Inclusive civil upper bound; confirmation checks both date and time. */
  readonly max = input<RiviniaDateTime | undefined>(undefined);
  readonly disabledDate = input<((date: RiviniaDate) => boolean) | undefined>();
  readonly disabledTime = input<((value: RiviniaDateTime) => boolean) | undefined>();
  readonly labels = input<Partial<RiviniaDatepickerLabels>>({});
  readonly disabled = input(false);
  readonly placeholder = input<string | undefined>(undefined);
  readonly label = input<string | undefined>(undefined);
  readonly theme = input<RiviniaDatepickerTheme | undefined>(undefined);
  readonly clearable = input<boolean | undefined>(undefined);

  readonly touch = output<void>();
  readonly applied = output<RiviniaPickerApplied<RiviniaDateTime>>();
  private readonly clearSnapshot = signal<RiviniaDateTime | null | undefined>(undefined);
  protected readonly pendingClear = computed(
    () => this.clearSnapshot() === this.normalized() && this.clearSnapshot() !== undefined,
  );
  /** Emitted on commit when a zone is configured: the civil value + its instant. */
  readonly resolved = output<RiviniaDateTimeResolution>();

  protected readonly open = signal(false);
  /** The panel stays in the DOM for the short exit animation, then leaves. */
  protected readonly closing = signal(false);
  /** Viewport clamp for a short screen; see `panelViewportShift()`. */
  protected readonly panelShift = signal(0);
  protected readonly isDisabled = computed(() => this.disabled());

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly transaction = new RiviniaDateTimeDraft(
    parseDateTime(this.value()) ?? nowDateTime(),
    () => ({
      min:
        this.min() ??
        (this.calendar.min()
          ? { date: this.calendar.min()!, time: { hour: 0, minute: 0, second: 0 } }
          : undefined),
      max:
        this.max() ??
        (this.calendar.max()
          ? { date: this.calendar.max()!, time: { hour: 23, minute: 59, second: 59 } }
          : undefined),
      disabledDate: this.disabledDate(),
      disabledTime: this.disabledTime(),
    }),
  );
  protected readonly draft = this.transaction.value;
  protected readonly canCommit = computed(() => {
    if (this.isDisabled()) return false;
    if (this.pendingClear()) return true;
    if (!this.transaction.valid()) return false;
    const result = this.zoneResult();
    if (result?.kind === 'unsupported') return false;
    if (this.zoneCommitPolicy() !== 'explicit' || !result) return true;
    return (
      result.kind === 'unique' ||
      (result.kind === 'ambiguous' &&
        result.alternatives.some((value) => value.offsetMinutes === this.selectedOffset()))
    );
  });
  protected readonly selectedOffset = signal<number | null>(null);

  private readonly uid = ++nextId;
  protected readonly panelId = `rv-datetimepicker-panel-${this.uid}`;
  protected readonly headingId = `rv-datetimepicker-heading-${this.uid}`;
  protected readonly formatHintId = `rv-datetimepicker-format-hint-${this.uid}`;

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly fieldRef = viewChild<ElementRef<HTMLElement>>('field');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly normalized = computed(() => parseDateTime(this.value()));

  protected readonly effectiveLocale = computed(
    () => this.locale() ?? this.config.locale ?? 'en-US',
  );
  protected readonly effectiveDateFormat = computed(
    () => this.format() ?? this.config.format ?? DEFAULT_DATE_FORMAT,
  );
  protected readonly formatHint = computed(() =>
    dateFormatHint(this.effectiveLocale(), this.effectiveDateFormat()),
  );
  protected readonly effectiveTimeFormat = computed(
    () => this.timeFormat() ?? this.config.timeFormat ?? DEFAULT_TIME_FORMAT,
  );
  protected readonly effectiveShowSeconds = computed(
    () => this.showSeconds() ?? this.config.showSeconds ?? false,
  );
  protected readonly effectiveMinuteStep = computed(() => {
    const value = Math.trunc(this.minuteStep() ?? this.config.minuteStep ?? 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  protected readonly effectiveHour12 = computed<RiviniaHour12>(
    () => this.hour12() ?? this.config.hour12 ?? 'auto',
  );
  private readonly hour12Option = computed<boolean | undefined>(() => {
    const value = this.effectiveHour12();
    return value === 'auto' ? undefined : value;
  });

  protected readonly effectiveTheme = computed<RiviniaDatepickerTheme>(
    () => this.theme() ?? this.config.theme ?? 'auto',
  );

  protected readonly rawTimeZone = computed<string | null>(
    () => this.timeZone() ?? this.config.timeZone ?? null,
  );
  protected readonly effectiveTimeZone = computed<string | undefined>(() => {
    const zone = this.rawTimeZone();
    return zone && isValidTimeZone(zone) ? zone : undefined;
  });
  protected readonly invalidTimeZone = computed<string | null>(() => {
    const zone = this.rawTimeZone();
    return zone && (!isValidTimeZone(zone) || this.zoneResult()?.kind === 'unsupported')
      ? zone
      : null;
  });

  private readonly zoneResult = computed(() => {
    const zone = this.rawTimeZone();
    return zone ? resolveDateTimeZone(this.draft(), zone, this.zoneResolver) : null;
  });

  /** The rule the picker shows: compatible (overlap earlier, gap later). */
  protected readonly zoneResolution = computed<RiviniaTimeZoneResolution | null>(() => {
    const result = this.zoneResult();
    return result?.kind === 'unsupported' ? null : result;
  });

  /** The user's chosen offset wins for an overlap; everything else is the base. */
  protected readonly effectiveResolution = computed<RiviniaTimeZoneResolution | null>(() => {
    const base = this.zoneResolution();
    if (!base || base.kind !== 'ambiguous') return base;
    const chosen = base.alternatives.find(
      (alternative) => alternative.offsetMinutes === this.selectedOffset(),
    );
    if (!chosen) return base;
    return {
      ...base,
      instant: chosen.instant,
      offsetMinutes: chosen.offsetMinutes,
      dateTime: base.requested,
    };
  });

  protected readonly gapResolution = computed(() => {
    const resolution = this.zoneResolution();
    return resolution?.kind === 'nonexistent' ? resolution : null;
  });
  protected readonly overlapResolution = computed(() => {
    const resolution = this.zoneResolution();
    return resolution?.kind === 'ambiguous' ? resolution : null;
  });

  protected readonly zoneName = computed(() => {
    const zone = this.effectiveTimeZone();
    const resolution = this.effectiveResolution();
    if (!zone || !resolution) return '';
    const name = formatTimeZoneName(this.effectiveLocale(), zone, resolution.instant, 'short');
    const offset = formatTimeZoneName(
      this.effectiveLocale(),
      zone,
      resolution.instant,
      'shortOffset',
    );
    return name && offset && name !== offset ? `${name} · ${offset}` : name || offset;
  });

  protected readonly canClear = computed(
    () =>
      (this.clearable() ?? this.config.clearable ?? false) &&
      (this.normalized() !== null || (this.open() && this.calendar.selected() !== null)) &&
      !this.isDisabled(),
  );

  protected readonly triggerText = computed(() => {
    const value = this.normalized();
    if (!value) return this.placeholder() ?? this.calendar.labels().chooseDateTime;
    const text = formatDateTime(
      this.effectiveLocale(),
      value,
      this.effectiveDateFormat(),
      this.effectiveTimeFormat(),
      { hour12: this.hour12Option() },
    );
    const zone = this.effectiveTimeZone();
    if (!zone) return text;
    const result = resolveDateTimeZone(value, zone, this.zoneResolver);
    const resolution = result.kind === 'unsupported' ? null : result;
    const offset = resolution
      ? formatTimeZoneName(this.effectiveLocale(), zone, resolution.instant, 'shortOffset')
      : '';
    return offset ? `${text} · ${offset}` : text;
  });

  protected readonly triggerTimeText = computed(() => {
    const value = this.normalized();
    if (!value) return '';
    return formatTime(this.effectiveLocale(), value.time, this.effectiveTimeFormat(), {
      hour12: this.hour12Option(),
    });
  });

  protected readonly triggerLabel = computed(() => {
    const choose = this.calendar.labels().chooseDateTime;
    const field = this.label();
    const value = this.normalized();
    if (field) return `${field}: ${value ? this.triggerText() : choose}`;
    return value ? `${choose}: ${this.triggerText()}` : choose;
  });

  protected readonly clearLabel = computed(() => {
    const clear = this.calendar.labels().clearDateTime;
    const field = this.label();
    return field ? `${field}: ${clear}` : clear;
  });

  protected readonly gapText = computed(() => {
    const gap = this.gapResolution();
    if (!gap) return '';
    return formatDateTime(
      this.effectiveLocale(),
      gap.dateTime,
      this.effectiveDateFormat(),
      this.effectiveTimeFormat(),
      { hour12: this.hour12Option() },
    );
  });

  protected readonly suggestedLabel = computed(() => {
    const gap = this.gapResolution();
    if (!gap) return '';
    const time = formatTime(this.effectiveLocale(), gap.dateTime.time, this.effectiveTimeFormat(), {
      hour12: this.hour12Option(),
    });
    return `${this.calendar.labels().useSuggestedTime} ${time}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.panels.release(this);
      this.clearCloseTimer();
    });

    effect(() => {
      const locale = this.locale();
      if (locale) this.calendar.setLocale(locale);
    });

    effect(() => {
      const firstDay = this.firstDay();
      if (firstDay !== undefined) this.calendar.setFirstDay(firstDay);
    });

    effect(() => {
      const min = this.min();
      const max = this.max();
      untracked(() =>
        this.calendar.setBounds(
          min?.date ?? this.config.min ?? null,
          max?.date ?? this.config.max ?? null,
        ),
      );
    });

    effect(() => this.calendar.setLabels(this.labels()));
    effect(() => this.calendar.setDisabledDate(this.disabledDate()));
    effect(() => {
      if (this.isDisabled() && this.open()) {
        untracked(() => this.closePanel(false, true));
      }
    });

    // The wall date's "today" follows the configured zone, unless the
    // application pinned a today for SSR determinism.
    effect(() => {
      const configured = parseDate(this.config.today);
      if (configured) return;
      const zone = this.effectiveTimeZone();
      this.calendar.setToday(zone ? todayInTimeZone(zone) : todayDate());
    });

    // A form write updates the draft and the grid; a draft edit does not feed
    // back into itself because `draft` is read untracked here.
    effect(() => {
      const value = this.normalized();
      if (!value) {
        this.calendar.setSelected(null);
        untracked(() => {
          const zone = this.effectiveTimeZone();
          this.transaction.reset(zone ? nowInTimeZone(zone) : nowDateTime());
        });
        return;
      }
      this.calendar.setSelected(value.date);
      untracked(() => {
        if (!isSameDateTime(value, this.draft())) this.transaction.reset(value);
      });
    });

    // Any change to the wall time or zone invalidates a previous overlap
    // choice; the new resolution must be chosen (or defaulted) again.
    effect(() => {
      this.draft();
      this.effectiveTimeZone();
      untracked(() => this.selectedOffset.set(null));
    });

    afterRenderEffect(() => {
      const panel = this.panelRef()?.nativeElement;
      this.open();
      if (this.open() && panel) this.applyPopover(panel);
    });

    // A short viewport can leave the panel's bottom past the edge. CSS cannot
    // express "clamp", so the deficit is measured here and applied with
    // `translate`; ResizeObserver keeps it right when the panel grows (a DST
    // warning, a wrapped action row).
    afterRenderEffect((onCleanup) => {
      const panel = this.panelRef()?.nativeElement;
      const origin = this.fieldRef()?.nativeElement;
      if (!this.open() || !panel || !origin) {
        this.panelShift.set(0);
        return;
      }
      if (typeof panel.showPopover !== 'function') return;
      const anchored =
        panel.ownerDocument.defaultView?.CSS?.supports('anchor-name', '--rv-datepicker-anchor') ??
        false;
      const connection = connectPopup({
        origin,
        panel,
        parent: 'auto',
        closeOnWidthChange: true,
        ...(anchored
          ? {
              position: () => {
                this.panelShift.set(panelViewportShift(panel, origin));
              },
            }
          : {}),
        onDismiss: (reason) => this.closePanel(reason === 'escape'),
      });
      onCleanup(() => connection.destroy());
    });

    effect((onCleanup) => {
      if (!this.open() || typeof document === 'undefined') return;
      if (typeof this.panelRef()?.nativeElement.showPopover === 'function') return;
      const onPointerDown = (event: Event): void => {
        const target = event.target as Node | null;
        if (target && this.hostRef.nativeElement.contains(target)) return;
        this.closePanel(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      onCleanup(() => document.removeEventListener('pointerdown', onPointerDown, true));
    });
  }

  focus(options?: FocusOptions): void {
    this.triggerRef()?.nativeElement.focus(options);
  }

  // ── Template actions ───────────────────────────────────────────────────────

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.open()) this.closePanel(true);
    else this.openPanel();
  }

  protected onPicked(date: RiviniaDate): void {
    if (this.isDisabled()) return;
    this.clearSnapshot.set(undefined);
    // A day updates the DRAFT only. The calendar stays mounted; the time row
    // keeps its value; nothing is committed until OK.
    this.transaction.setDate(date);
  }

  protected onTimeChanged(time: RiviniaTime): void {
    if (this.isDisabled()) return;
    this.clearSnapshot.set(undefined);
    this.transaction.setTime(time);
  }

  protected useSuggested(): void {
    if (this.isDisabled()) return;
    const gap = this.gapResolution();
    if (!gap) return;
    this.transaction.reset({
      date: { ...gap.dateTime.date },
      time: { ...gap.dateTime.time },
    });
    this.calendar.setSelected(gap.dateTime.date);
  }

  protected chooseOffset(offsetMinutes: number): void {
    if (this.isDisabled()) return;
    this.selectedOffset.set(offsetMinutes);
  }

  protected isChosenOffset(alternative: RiviniaTimeZoneAlternative): boolean {
    if (this.zoneCommitPolicy() === 'explicit' && this.selectedOffset() === null) return false;
    return this.effectiveResolution()?.instant === alternative.instant;
  }

  protected offsetLabel(alternative: RiviniaTimeZoneAlternative): string {
    const zone = this.effectiveTimeZone();
    if (!zone) return '';
    const locale = this.effectiveLocale();
    const name = formatTimeZoneName(locale, zone, alternative.instant, 'short');
    const offset = formatTimeZoneName(locale, zone, alternative.instant, 'shortOffset');
    return name && offset && name !== offset ? `${name} ${offset}` : name || offset;
  }

  protected commit(): void {
    if (!this.open() || !this.canCommit()) return;
    if (this.pendingClear()) {
      const changed = this.value() !== null;
      confirmPickerValue(this.value, this.applied, null, changed);
      this.closePanel(true);
      return;
    }
    if (!this.canCommit()) return;
    const value = this.transaction.requestCommit();
    if (!value) return;
    this.value.set(value);
    this.emitResolved(value);
    this.transaction.reset(value);
    this.closePanel(true);
  }

  protected onTypedDate(date: RiviniaDate): void {
    if (this.isDisabled() || !this.calendar.canSelect(date)) return;
    this.clearSnapshot.set(undefined);
    this.transaction.setDate(date);
    this.calendar.setSelected(date);
    if (this.open()) return;
    if (!this.canCommit()) {
      this.openPanel(true);
      return;
    }
    const value = this.transaction.requestCommit();
    if (!value) return;
    this.value.set(value);
    this.emitResolved(value);
    this.transaction.reset(value);
  }

  private emitResolved(value: RiviniaDateTime): void {
    const zone = this.effectiveTimeZone();
    const resolution = this.effectiveResolution();
    if (zone && resolution) this.resolved.emit({ value, timeZone: zone, resolution });
  }

  protected clearValue(): void {
    if (!this.open() || !this.canClear()) return;
    this.clearSnapshot.set(this.normalized());
    this.calendar.setSelected(null);
  }

  protected dismiss(): void {
    this.closePanel(true);
  }

  closeForAnotherPanel(): void {
    // One panel at a time wins over the exit animation.
    this.closePanel(false, true);
  }

  protected onPanelClick(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    this.dismiss();
  }

  protected onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related && this.hostRef.nativeElement.contains(related)) return;

    if (!related && this.open() && typeof document !== 'undefined') {
      // Chromium can report a null relatedTarget when rendering replaces the
      // focused calendar cell (for example, PageDown changes the month). Let
      // the calendar's after-render focus restoration run before deciding the
      // user actually left the non-modal control.
      queueMicrotask(() => {
        const active = document.activeElement;
        if (this.open() && (!active || !this.hostRef.nativeElement.contains(active))) {
          this.closePanel(false);
        }
      });
      return;
    }

    if (this.open()) this.closePanel(false);
    else this.touch.emit();
  }

  private openPanel(preserveDraft = false): void {
    this.clearSnapshot.set(undefined);
    // Reopening during the exit animation cancels the exit and reuses the
    // panel that is still in the DOM.
    this.finishClose();
    const value = this.normalized();
    const zone = this.effectiveTimeZone();
    const fallback = zone ? nowInTimeZone(zone) : nowDateTime();
    if (!preserveDraft) this.transaction.reset(value ?? fallback);
    const configuredToday = parseDate(this.config.today);
    this.calendar.setToday(configuredToday ?? (zone ? todayInTimeZone(zone) : todayDate()));

    if (preserveDraft) {
      this.calendar.setSelected(this.draft().date);
    } else if (value) {
      this.calendar.setSelected(value.date);
    } else {
      this.calendar.setSelected(null);
      this.calendar.goToToday();
    }

    this.panels.claim(this);
    this.open.set(true);
  }

  private closePanel(restoreFocus: boolean, immediate = false): void {
    this.panels.release(this);
    if (!this.open()) {
      if (immediate) this.finishClose();
      return;
    }
    this.open.set(false);
    this.touch.emit();
    if (restoreFocus) this.triggerRef()?.nativeElement.focus();
    this.startExit(immediate);
  }

  private startExit(immediate: boolean): void {
    this.clearCloseTimer();
    if (immediate || !panelExitMotionEnabled()) {
      this.finishClose();
      return;
    }
    this.closing.set(true);
    this.closeTimer = setTimeout(() => this.finishClose(), PANEL_EXIT_FALLBACK_MS);
  }

  /** The panel's exit animation ended; remove the panel now. */
  protected onPanelAnimationEnd(event: AnimationEvent): void {
    if (!this.closing()) return;
    if (event.target !== this.panelRef()?.nativeElement) return;
    // Angular scopes CSS animation names (`_ngcontent-…_rv-datepicker-exit`).
    if (!event.animationName.endsWith('rv-datepicker-exit')) return;
    this.finishClose();
  }

  private finishClose(): void {
    this.clearCloseTimer();
    this.closing.set(false);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer === null) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private applyPopover(panel: HTMLElement): void {
    const api = panel as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    if (typeof api.showPopover !== 'function') return;
    if (!panel.hasAttribute('popover')) panel.setAttribute('popover', 'manual');
    try {
      if (!panel.matches(':popover-open')) api.showPopover();
    } catch {
      // A layer hint must never break picking a date.
    }
  }
}
