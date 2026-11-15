import {
  booleanAttribute,
  computed,
  contentChildren,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ControlValueAccessor } from '@angular/forms';
import { SelectController, type SelectMode, type SelectOption } from '@rivinia/select';
import { readRequiredOptionInput } from './required-option-input';

export type SelectKey = string | number;
export type SelectValue<T> = T | readonly T[] | null;

function primitiveKey(value: unknown): SelectKey {
  if (typeof value === 'string' || typeof value === 'number') return value;
  throw new Error('Object Select values require rvSelectKeyOf to return a stable primitive key.');
}

function isNodeInView(
  target: EventTarget | null,
  view: Window & typeof globalThis,
): target is Node {
  return target instanceof view.Node;
}

@Directive({
  selector: '[rvSelectRoot]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectRootDirective),
      multi: true,
    },
  ],
  host: {
    class: 'rv-select',
    '[attr.data-rv-select-mode]': 'rvSelectMode()',
    '[attr.data-rv-select-appearance]': 'rvSelectAppearance()',
    '[attr.data-rv-select-variant]': 'rvSelectVariant()',
    '[attr.data-rv-select-size]': 'rvSelectSize()',
    '[attr.data-rv-select-shape]': 'rvSelectShape()',
    '[attr.data-rv-select-density]': 'rvSelectDensity()',
  },
})
export class SelectRootDirective<T = unknown> implements ControlValueAccessor {
  /**
   * The public field model. `value` and the optional state signals/outputs structurally satisfy
   * Signal Forms without importing its API; Reactive Forms and ngModel use this directive's CVA.
   */
  readonly value = model<SelectValue<T>>(null);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly dirty = input(false);
  readonly required = input(false);
  readonly touch = output<void>();
  readonly touchedChange = output<boolean>();
  readonly rvSelectRootId = input<string>();
  readonly rvSelectMode = input<SelectMode>('single');
  readonly rvSelectDisabled = input(false, { transform: booleanAttribute });
  readonly rvSelectKeyOf = input<(value: T) => SelectKey>((value) => primitiveKey(value));
  readonly rvSelectOptions = input<readonly SelectOption<T, SelectKey>[]>();
  readonly rvSelectAppearance = input<'surface' | 'outline' | 'plain' | 'primary'>('surface');
  readonly rvSelectVariant = input<'simple' | 'premium'>('simple');
  readonly rvSelectSize = input<'compact' | 'comfortable' | 'spacious'>('comfortable');
  readonly rvSelectShape = input<'square' | 'rounded' | 'pill'>('rounded');
  readonly rvSelectDensity = input<'compact' | 'comfortable' | 'spacious'>('comfortable');
  readonly rvSelectValueChange = output<unknown>();
  readonly rvSelectQueryChange = output<string>();
  readonly rvSelectTouched = output<void>();
  readonly rvSelectActiveOptionChange = output<SelectKey | undefined>();
  readonly rvSelectPanelReady = output<HTMLElement>();
  readonly rvSelectReachEnd = output<void>();
  private readonly controller: SelectController<T, SelectKey>;
  readonly mode = computed(() => this.controller.mode);
  readonly isOpen = computed(() => this.controller.isOpen());
  readonly isDisabled = computed(() => this.controller.isDisabled());
  readonly activeKey = computed(() => this.controller.activeKey());
  readonly query = computed(() => this.controller.query());
  readonly selectedKeys = computed(() => this.controller.selectedKeys());
  readonly visibleOptions = computed(() => this.controller.visibleOptions());
  private readonly renderedOptionKeys = signal<ReadonlySet<SelectKey> | undefined>(undefined);
  readonly inputElement = signal<HTMLInputElement | undefined>(undefined);
  readonly panelElement = signal<HTMLElement | undefined>(undefined);
  readonly inputId = computed(() => {
    const id = this.rvSelectRootId()?.trim();
    return id ? `${id}-combobox` : undefined;
  });
  readonly panelId = computed(() => {
    const id = this.rvSelectRootId()?.trim();
    return id ? `${id}-listbox` : undefined;
  });
  readonly activeOptionId = computed(() => {
    const key = this.activeKey();
    if (key === undefined) return undefined;
    const directive = this.optionDirectives().find(
      (item) => readRequiredOptionInput(() => item.rvSelectOptionKey()) === key,
    );
    if (directive) return directive.domId();
    return this.renderedOptionKeys()?.has(key) ? this.optionId(key) : undefined;
  });
  readonly optionDirectives = contentChildren(SelectOptionDirective, { descendants: true });

  private suppressNextFocusOpen = false;
  private readonly formsDisabled = signal(false);
  private onChange: (value: unknown) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.controller = new SelectController<T, SelectKey>({
      keyOf: (value) => this.rvSelectKeyOf()(value),
    });
    effect(() => {
      const mode = this.rvSelectMode();
      const disabled = this.rvSelectDisabled() || this.disabled() || this.formsDisabled();
      untracked(() => {
        this.controller.setMode(mode);
        this.controller.setDisabled(disabled);
      });
    });
    effect(() => {
      const value = this.value();
      untracked(() => this.controller.writeValue(value));
    });
    effect(() => {
      const providedOptions = this.rvSelectOptions();
      if (providedOptions !== undefined) {
        untracked(() => this.controller.setOptions(providedOptions));
        return;
      }
      const options = this.optionDirectives().flatMap((item) => {
        const key = readRequiredOptionInput(() => item.rvSelectOptionKey());
        const label = readRequiredOptionInput(() => item.rvSelectOptionLabel());
        if (key === undefined || label === undefined) return [];
        return [
          {
            key,
            value: readRequiredOptionInput(() => item.rvSelectOptionValue()) as T,
            label,
            disabled: readRequiredOptionInput(() => item.rvSelectOptionDisabled()) ?? false,
            group: readRequiredOptionInput(() => item.rvSelectOptionGroup()) || undefined,
          } satisfies SelectOption<unknown, SelectKey>,
        ];
      });
      untracked(() => this.controller.setOptions(options));
    });
    effect(() => {
      const activeKey = this.controller.activeKey();
      untracked(() => this.rvSelectActiveOptionChange.emit(activeKey));
    });
    effect(() => {
      const activeKey = this.controller.activeKey();
      if (activeKey === undefined) return;
      const option = this.optionDirectives().find(
        (item) => readRequiredOptionInput(() => item.rvSelectOptionKey()) === activeKey,
      );
      if (option) queueMicrotask(() => option.scrollIntoView());
    });
  }

  inputText(): string {
    if (this.controller.query()) return this.controller.query();
    if (this.controller.mode === 'multiple') return '';
    const key = this.controller.selectedKeys()[0];
    return key === undefined
      ? ''
      : (this.controller.options().find((option) => option.key === key)?.label ?? '');
  }

  setInput(element: HTMLInputElement): void {
    this.inputElement.set(element);
  }

  setPanel(element: HTMLElement): void {
    this.panelElement.set(element);
  }

  writeValue(value: unknown): void {
    this.value.set(value === undefined ? null : (value as SelectValue<T>));
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formsDisabled.set(disabled);
  }

  inputQuery(query: string): void {
    if (this.controller.isDisabled() || this.readonly()) return;
    this.controller.setQuery(query);
    this.rvSelectQueryChange.emit(query);
  }

  open(edge?: 'first' | 'last'): void {
    if (this.controller.isDisabled()) return;
    if (this.controller.mode === 'single' && this.controller.query()) {
      this.controller.setQuery('');
    }
    this.controller.open(edge, edge ? undefined : (this.selectedKey() ?? null));
  }

  close(reason?: 'escape'): void {
    this.controller.close();
    if (this.controller.mode === 'single') this.controller.clearQuery();
    if (reason === 'escape') {
      const input = this.inputElement();
      if (!input) return;
      this.suppressNextFocusOpen = input.ownerDocument.activeElement !== input;
      input.focus();
    }
  }

  onInputFocus(): void {
    if (this.suppressNextFocusOpen) {
      this.suppressNextFocusOpen = false;
      return;
    }
    if (this.controller.mode === 'single' && this.controller.selectedKeys().length > 0) {
      this.open();
    }
  }

  onInputClick(): void {
    if (!this.controller.isOpen()) this.open();
  }

  moveActive(direction: 'next' | 'previous' | 'first' | 'last'): void {
    this.controller.moveActive(direction);
  }

  setActive(key: SelectKey | undefined): void {
    this.controller.setActive(key);
  }

  setRenderedOptionKeys(keys: readonly SelectKey[]): void {
    this.renderedOptionKeys.set(new Set(keys));
  }

  private selectedKey(value = this.value()): SelectKey | undefined {
    if (value === null) return undefined;
    const selected =
      this.controller.mode === 'multiple'
        ? Array.isArray(value)
          ? (value[0] as T | undefined)
          : undefined
        : (value as T);
    return selected === undefined ? undefined : this.rvSelectKeyOf()(selected);
  }

  select(key: SelectKey): void {
    if (this.readonly()) return;
    const request = this.controller.requestSelection(key);
    if (!request) return;
    if (this.controller.mode === 'single') {
      this.controller.close();
      this.controller.clearQuery();
    }
    this.commitValue(request.value);
    this.inputElement()?.focus();
  }

  clear(): void {
    if (this.readonly() || this.controller.isDisabled()) return;
    this.commitValue(this.controller.mode === 'multiple' ? [] : null);
  }

  private commitValue(value: SelectValue<T>): void {
    this.value.set(value);
    this.rvSelectValueChange.emit(value);
    this.onChange(value);
  }

  onInputBlur(event: FocusEvent): void {
    const document = this.inputElement()?.ownerDocument;
    const view = document?.defaultView;
    if (!document || !view || this.controller.isDisabled()) return;
    const next = event.relatedTarget;
    if (isNodeInView(next, view) && this.panelElement()?.contains(next)) return;
    view.setTimeout(() => {
      if (this.controller.isDisabled()) return;
      const active = document.activeElement;
      if (active && this.panelElement()?.contains(active)) return;
      this.close();
      this.rvSelectTouched.emit();
      this.touch.emit();
      this.touchedChange.emit(true);
      this.onTouched();
    }, 0);
  }

  focus(): void {
    this.inputElement()?.focus();
  }

  optionId(key: SelectKey): string | undefined {
    const item = this.optionDirectives().find(
      (candidate) => readRequiredOptionInput(() => candidate.rvSelectOptionKey()) === key,
    );
    if (item?.rvSelectOptionId()) return item.rvSelectOptionId();
    const id = this.rvSelectRootId()?.trim();
    return id ? `${id}-option-${encodeURIComponent(String(key))}` : undefined;
  }

  notifyPanelReady(element: HTMLElement): void {
    this.rvSelectPanelReady.emit(element);
  }

  notifyReachEnd(): void {
    this.rvSelectReachEnd.emit();
  }

  keyOf(value: T): SelectKey {
    return this.rvSelectKeyOf()(value);
  }
}

@Directive({
  selector: 'input[rvSelectInput]',
  standalone: true,
  host: {
    class: 'rv-select-input',
    '[attr.id]': 'rvSelectInputId() ?? root.inputId() ?? null',
    '[attr.role]': '"combobox"',
    '[attr.aria-autocomplete]': '"list"',
    '[attr.aria-haspopup]': '"listbox"',
    '[attr.aria-expanded]': 'root.isOpen()',
    '[attr.aria-controls]': 'rvSelectListId() ?? root.panelId() ?? null',
    '[attr.aria-activedescendant]': 'root.activeOptionId() ?? null',
    '[attr.aria-invalid]': 'root.invalid() ? "true" : null',
    '[attr.aria-required]': 'root.required() ? "true" : null',
    '[attr.aria-readonly]': 'root.readonly() ? "true" : null',
    '[readOnly]': 'root.readonly()',
    '[value]': 'root.inputText()',
    '[disabled]': 'root.isDisabled()',
    '(input)': 'onInput($event)',
    '(click)': 'root.onInputClick()',
    '(keydown)': 'onKeydown($event)',
    '(focus)': 'root.onInputFocus()',
    '(blur)': 'root.onInputBlur($event)',
  },
})
export class SelectInputDirective {
  readonly rvSelectInputId = input<string>();
  readonly rvSelectListId = input<string>();
  readonly root = inject(SelectRootDirective);
  private readonly host = inject(ElementRef<HTMLInputElement>);

  constructor() {
    this.root.setInput(this.host.nativeElement);
  }

  onInput(event: Event): void {
    this.root.inputQuery((event.target as HTMLInputElement).value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.root.isOpen()) this.root.open(this.root.selectedKeys().length ? undefined : 'first');
      else this.root.moveActive('next');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.root.isOpen()) this.root.open(this.root.selectedKeys().length ? undefined : 'last');
      else this.root.moveActive('previous');
    } else if (event.key === 'Enter' && this.root.isOpen()) {
      const key = this.root.activeKey();
      if (key !== undefined) {
        event.preventDefault();
        this.root.select(key);
      }
    } else if (event.key === 'Tab' && this.root.isOpen()) {
      const view = this.host.nativeElement.ownerDocument.defaultView;
      if (view) view.setTimeout(() => this.root.close(), 0);
      else this.root.close();
    }
  }
}

@Directive({
  selector: '[rvSelectList]',
  standalone: true,
  host: {
    class: 'rv-select-list',
    '[attr.id]': 'rvSelectListId() ?? root.panelId() ?? null',
    '[attr.role]': '"listbox"',
    '[attr.aria-multiselectable]': 'root.mode() === "multiple" ? "true" : null',
  },
})
export class SelectListDirective {
  readonly rvSelectListId = input<string>();
  readonly root = inject(SelectRootDirective);
}

@Directive({
  selector: '[rvSelectOption]',
  standalone: true,
  host: {
    class: 'rv-select-option',
    '[attr.id]': 'domId() ?? null',
    '[attr.role]': '"option"',
    '[attr.aria-selected]': 'isSelected() ? "true" : "false"',
    '[attr.aria-disabled]': 'rvSelectOptionDisabled() ? "true" : null',
    '[attr.hidden]': 'isVisible() ? null : ""',
    '[attr.aria-posinset]': 'rvSelectOptionPosition() ?? position()',
    '[attr.aria-setsize]': 'rvSelectOptionSetSize() ?? root.visibleOptions().length',
    '[attr.data-rv-select-active]': 'isActive() ? "true" : null',
    '(mousedown)': '$event.preventDefault()',
    '(click)': 'select()',
  },
})
export class SelectOptionDirective {
  readonly rvSelectOptionKey = input.required<SelectKey>();
  readonly rvSelectOptionValue = input.required<unknown>();
  readonly rvSelectOptionLabel = input.required<string>();
  readonly rvSelectOptionDisabled = input(false, { transform: booleanAttribute });
  readonly rvSelectOptionGroup = input('');
  readonly rvSelectOptionId = input<string>();
  readonly rvSelectOptionPosition = input<number>();
  readonly rvSelectOptionSetSize = input<number>();
  readonly root = inject(SelectRootDirective);
  private readonly host = inject(ElementRef<HTMLElement>);

  domId(): string | undefined {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    return key === undefined ? undefined : (this.rvSelectOptionId() ?? this.root.optionId(key));
  }

  scrollIntoView(): void {
    const element = this.host.nativeElement;
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }

  position(): number {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    if (key === undefined) return 0;
    return this.root.visibleOptions().findIndex((option) => option.key === key) + 1;
  }

  isSelected(): boolean {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    return key !== undefined && this.root.selectedKeys().includes(key);
  }

  isVisible(): boolean {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    return key !== undefined && this.root.visibleOptions().some((option) => option.key === key);
  }

  isActive(): boolean {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    return key !== undefined && this.root.activeKey() === key;
  }

  select(): void {
    const key = readRequiredOptionInput(() => this.rvSelectOptionKey());
    if (key !== undefined) this.root.select(key);
  }
}

@Directive({
  selector: '[rvSelectStatus]',
  standalone: true,
  host: {
    class: 'rv-select-status',
    '[attr.role]': '"status"',
    '[attr.aria-live]': '"polite"',
    '[attr.aria-atomic]': '"true"',
  },
})
export class SelectStatusDirective {}
