import { computed, linkedSignal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { SelectController } from '../select-controller';
import type { RiviniaSelectController, RiviniaSelectMode, RiviniaSelectOption } from '../models/select-types';

/** Original ID-based API over the shared identity-stable selection engine. */
export class RiviniaSelect implements RiviniaSelectController {
  private readonly engine: SelectController<RiviniaSelectOption, string>;
  readonly options: Signal<readonly RiviniaSelectOption[]>;
  readonly filtered: Signal<readonly RiviniaSelectOption[]>;
  readonly query: WritableSignal<string>;
  readonly value: WritableSignal<string | null>;
  readonly values: WritableSignal<readonly string[]>;
  readonly selectedLabels: Signal<readonly string[]>;

  constructor(readonly mode: RiviniaSelectMode = 'single') {
    this.engine = new SelectController({ keyOf: option => option.id,
      mode: mode === 'multi' ? 'multiple' : 'single' });
    this.options = computed(() => this.engine.options().map(option => option.value));
    this.filtered = computed(() => this.engine.visibleOptions().map(option => option.value));
    this.query = writableView(() => this.engine.query(), value => this.setQuery(value));
    this.value = writableView<string | null>(
      () => this.mode === 'single' ? (this.engine.selectedKeys()[0] ?? null) : null,
      value => this.setValue(value));
    this.values = writableView<readonly string[]>(
      () => this.mode === 'multi' ? this.engine.selectedKeys() : [],
      values => this.setValues(values));
    this.selectedLabels = computed(() => this.engine.selectedValues().map(option => option.label));
  }

  private resolve(id: string): RiviniaSelectOption {
    return this.options().find(option => option.id === id) ?? Object.freeze({ id, label: id });
  }
  private replace(options: readonly RiviniaSelectOption[]): void {
    untracked(() => this.engine.setOptions(options.map(option => {
      const value = Object.freeze({ ...option });
      return { key: value.id, value, label: value.label, disabled: value.disabled };
    })));
  }
  registerOption(option: RiviniaSelectOption): void {
    const current = this.options();
    const existing = current.find(item => item.id === option.id);
    this.replace(existing
      ? current.map(item => item.id === option.id ? { ...item, ...option } : item)
      : [...current, option]);
  }
  unregisterOption(id: string): void {
    const remaining = this.engine.selectedKeys().filter(key => key !== id);
    this.engine.unregisterOption(id);
    if (this.mode === 'multi') this.setValues(remaining);
    else if (this.value() === id) this.setValue(null);
  }
  syncOptions(options: readonly RiviniaSelectOption[]): void {
    untracked(() => {
    const keys = new Set(options.map(option => option.id));
    this.replace(options);
    // The original API prunes removed IDs. The generic API preserves unloaded values.
    if (this.mode === 'multi') this.setValues(this.values().filter(key => keys.has(key)));
    else if (this.value() !== null && !keys.has(this.value()!)) this.setValue(null);
    });
  }
  setValue(id: string | null): void {
    if (this.mode === 'single') this.engine.writeValue(id === null ? null : this.resolve(id));
  }
  setValues(ids: readonly string[]): void {
    if (this.mode === 'multi') this.engine.writeValue(ids.map(id => this.resolve(id)));
  }
  setQuery(query: string): void { this.engine.setQuery(query); }
  clearQuery(): void { this.engine.clearQuery(); }
  select(id: string): boolean {
    const option = this.options().find(option => option.id === id);
    if (!option || option.disabled) return false;
    if (this.mode === 'single') this.setValue(id);
    else this.setValues([id]);
    return true;
  }
  toggle(id: string): boolean {
    if (this.mode !== 'multi') return false;
    const request = this.engine.requestSelection(id);
    if (!request) return false;
    this.engine.writeValue(request.value);
    return true;
  }
  clear(): void { this.engine.clear(); }
  isSelected(id: string): boolean { return this.engine.selectedKeys().includes(id); }
}

/** Retains direct signal write methods without introducing a second state store. */
function writableView<T>(read: () => T, write: (value: T) => void): WritableSignal<T> {
  const view = linkedSignal(read);
  view.set = write;
  view.update = updater => write(updater(view()));
  return view;
}
