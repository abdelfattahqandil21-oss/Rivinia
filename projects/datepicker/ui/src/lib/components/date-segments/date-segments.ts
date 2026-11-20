import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { formatDate, isDateStyle, isValidDate, parseDatePattern } from '@rivinia/datepicker';
import type { RiviniaDate, RiviniaDateFormat, RiviniaDatepickerLabels } from '@rivinia/datepicker';

type DatePartField = 'day' | 'month' | 'year';

interface DateSegment {
  readonly key: string;
  readonly field: DatePartField | 'weekday' | null;
  readonly token: string | null;
  readonly text: string;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly size: number;
  readonly numeric: boolean;
}

const SAMPLE_DATE: RiviniaDate = { year: 2026, month: 11, day: 23 };

@Component({
  selector: 'rv-date-segments',
  templateUrl: './date-segments.html',
  styleUrl: './date-segments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'rv-date-segments-host' },
})
export class RiviniaDateSegmentsComponent {
  readonly value = input<RiviniaDate | null>(null);
  readonly locale = input.required<string>();
  readonly format = input.required<RiviniaDateFormat>();
  readonly labels = input.required<RiviniaDatepickerLabels>();
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly valueChange = output<RiviniaDate>();

  protected readonly edits = signal<Record<string, string>>({});
  protected readonly parts = computed(() => this.buildSegments());
  protected readonly invalid = computed(() => {
    const draft = this.buildDate();
    return !!draft && !isValidDate(draft);
  });

  constructor() {
    effect(() => {
      if (this.value() === null) this.edits.set({});
    });
  }

  protected text(part: DateSegment): string {
    if (part.field === null) return part.text;
    if (part.field === 'weekday') {
      const value = this.value();
      return value ? formatDate(this.locale(), value, part.token!) : '';
    }
    const edit = this.edits()[part.key];
    if (edit !== undefined) return edit;
    const value = this.value();
    return value ? formatDate(this.locale(), value, part.token!) : '';
  }

  protected segmentLabel(part: DateSegment): string {
    const locale = this.locale();
    const names: Record<DatePartField, string> = /^ar(?:\b|-)/i.test(locale)
      ? { day: 'اليوم', month: 'الشهر', year: 'السنة' }
      : { day: 'Day', month: 'Month', year: 'Year' };
    return `${names[part.field as DatePartField]}: ${this.label()}`;
  }

  protected onInput(part: DateSegment, event: Event): void {
    if (!part.field || part.field === 'weekday') return;
    const input = event.target as HTMLInputElement;
    const value = part.numeric ? input.value.replace(/[^\p{Number}]/gu, '') : input.value;
    if (value !== input.value) input.value = value;
    this.edits.update((edits) => ({ ...edits, [part.key]: value }));

    const parsed = this.buildDate();
    if (parsed && isValidDate(parsed)) this.valueChange.emit(parsed);

    if (!part.numeric) return;
    const digits = this.normalizeDigits(value);
    const max = part.field === 'year' ? part.maxLength : 2;
    const first = Number(digits[0]);
    const shouldAdvance =
      digits.length >= max ||
      (digits.length === 1 &&
        ((part.field === 'month' && first > 1) || (part.field === 'day' && first > 3)));
    if (!shouldAdvance) return;
    const inputs = [...(input.parentElement?.querySelectorAll<HTMLInputElement>('input') ?? [])];
    const next = inputs[inputs.indexOf(input) + 1];
    next?.focus();
    next?.select();
  }

  protected onBlur(part: DateSegment): void {
    if (!this.value() && !this.buildDate()) return;
    this.edits.update((edits) => {
      const next = { ...edits };
      delete next[part.key];
      return next;
    });
    if (this.invalid()) this.edits.set({});
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  private buildSegments(): readonly DateSegment[] {
    const format = this.format();
    if (isDateStyle(format)) {
      const formatter = new Intl.DateTimeFormat(this.locale(), {
        dateStyle: format,
        calendar: 'gregory',
        timeZone: 'UTC',
      });
      return formatter.formatToParts(new Date(Date.UTC(2026, 10, 23, 12))).map((part, index) => {
        const mapped = this.fromIntlPart(part.type, part.value, index);
        return mapped;
      });
    }
    return parseDatePattern(format).map((part, index) => {
      if (part.token === null) {
        return this.literal(index, part.value);
      }
      const field = this.fieldOf(part.token);
      if (!field) {
        return {
          key: `weekday-${index}`,
          field: 'weekday',
          token: part.value,
          text: '',
          placeholder: '',
          maxLength: 0,
          size: 1,
          numeric: false,
        };
      }
      return this.editableSegment(index, field, part.value);
    });
  }

  private fromIntlPart(type: string, value: string, index: number): DateSegment {
    if (type === 'literal') return this.literal(index, value);
    if (type === 'weekday') {
      return {
        key: `weekday-${index}`,
        field: 'weekday',
        token: 'EEE',
        text: '',
        placeholder: '',
        maxLength: 0,
        size: Math.max(1, value.length),
        numeric: false,
      };
    }
    const field: DatePartField | null =
      type === 'day' || type === 'month' || type === 'year' ? type : null;
    if (!field) return this.literal(index, value);
    const numeric = /^\p{Number}+$/u.test(value) || type === 'month';
    const token =
      field === 'year'
        ? value.length === 2
          ? 'yy'
          : 'yyyy'
        : field === 'day'
          ? value.length > 1
            ? 'dd'
            : 'd'
          : numeric
            ? value.length > 1
              ? 'MM'
              : 'M'
            : value.length > 4
              ? 'MMMM'
              : 'MMM';
    return this.editableSegment(index, field, token);
  }

  private editableSegment(index: number, field: DatePartField, token: string): DateSegment {
    const numeric = field !== 'month' || token.length <= 2;
    const maxLength = field === 'year' ? (token.length === 2 ? 2 : 4) : numeric ? 2 : 20;
    const placeholder = token.toLocaleUpperCase(this.locale());
    return {
      key: `${field}-${index}`,
      field,
      token,
      text: '',
      placeholder,
      maxLength,
      size: numeric ? maxLength : Math.min(6, maxLength),
      numeric,
    };
  }

  private literal(index: number, text: string): DateSegment {
    return {
      key: `literal-${index}`,
      field: null,
      token: null,
      text,
      placeholder: '',
      maxLength: 0,
      size: Math.max(1, text.length),
      numeric: false,
    };
  }

  private fieldOf(token: string): DatePartField | null {
    const first = token[0]?.toLowerCase();
    return first === 'd' ? 'day' : first === 'm' ? 'month' : first === 'y' ? 'year' : null;
  }

  private buildDate(): RiviniaDate | null {
    const current = this.value();
    let year = current?.year;
    let month = current?.month;
    let day = current?.day;
    for (const segment of this.parts()) {
      if (!segment.field || segment.field === 'weekday' || !segment.token) continue;
      const raw = this.edits()[segment.key];
      if (raw === undefined || raw === '') continue;
      const number = this.segmentNumber(segment, raw);
      if (number === null) return null;
      if (segment.field === 'year') year = number;
      if (segment.field === 'month') month = number;
      if (segment.field === 'day') day = number;
    }
    if (year === undefined || month === undefined || day === undefined) return null;
    return { year, month, day };
  }

  private segmentNumber(segment: DateSegment, raw: string): number | null {
    const normalized = this.normalizeDigits(raw).trim();
    if (segment.numeric) {
      if (!/^\d+$/.test(normalized)) return null;
      if (segment.field === 'year' && normalized.length !== segment.maxLength) return null;
      const number = Number(normalized);
      if (segment.field === 'year' && segment.token === 'yy') return 2000 + number;
      return number;
    }
    const requested = normalized.toLocaleLowerCase(this.locale()).replace(/[.\s]/g, '');
    for (let month = 1; month <= 12; month += 1) {
      const sample = new Date(Date.UTC(2026, month - 1, 1, 12));
      for (const width of ['long', 'short'] as const) {
        const name = new Intl.DateTimeFormat(this.locale(), {
          month: width,
          calendar: 'gregory',
          timeZone: 'UTC',
        })
          .format(sample)
          .toLocaleLowerCase(this.locale())
          .replace(/[.\s]/g, '');
        if (name === requested) return month;
      }
    }
    return null;
  }

  private normalizeDigits(value: string): string {
    let normalized = value.normalize('NFKC');
    for (let digit = 0; digit <= 9; digit += 1) {
      normalized = normalized.replaceAll(
        new Intl.NumberFormat(this.locale(), { useGrouping: false }).format(digit),
        String(digit),
      );
    }
    return normalized;
  }
}
