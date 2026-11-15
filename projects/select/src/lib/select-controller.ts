import { computed, signal } from '@angular/core';

export type SelectMode = 'single' | 'multiple';
export type SelectLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
export type SelectLoadRequest = number;

export interface SelectOption<T, K extends string | number | symbol = string> {
  readonly key: K;
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
  readonly group?: string;
}

export interface NormalizedSelectOption<
  T,
  K extends string | number | symbol = string,
> extends SelectOption<T, K> {
  readonly disabled: boolean;
}

export interface SelectLoadState {
  readonly status: SelectLoadStatus;
  readonly error?: unknown;
  readonly loadingMore: boolean;
}

export interface SelectControllerOptions<T, K extends string | number | symbol = string> {
  readonly keyOf: (value: T) => K;
  readonly mode?: SelectMode;
  readonly locale?: string;
}

function normalize<T, K extends string | number | symbol>(
  option: SelectOption<T, K>,
): NormalizedSelectOption<T, K> {
  return { ...option, label: option.label.trim(), disabled: option.disabled ?? false };
}

/**
 * DOM-free selection state. Option keys, not labels or object references, own selection identity.
 * Data fetching and cancellation remain consumer-owned.
 */
export class SelectController<T, K extends string | number | symbol = string> {
  private readonly optionState = signal<readonly NormalizedSelectOption<T, K>[]>([]);
  private readonly keyState = signal<readonly K[]>([]);
  private readonly selectedValueSnapshots = signal<ReadonlyMap<K, T>>(new Map());
  private readonly queryState = signal('');
  private readonly openState = signal(false);
  private readonly activeKeyState = signal<K | undefined>(undefined);
  private readonly disabledState = signal(false);
  private readonly modeState = signal<SelectMode>('single');
  private readonly loadState = signal<SelectLoadState>({ status: 'idle', loadingMore: false });
  private readonly requestSequence = signal(0);

  get mode(): SelectMode {
    return this.modeState();
  }
  readonly options = this.optionState.asReadonly();
  readonly selectedKeys = this.keyState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly isOpen = this.openState.asReadonly();
  readonly activeKey = this.activeKeyState.asReadonly();
  readonly isDisabled = this.disabledState.asReadonly();
  readonly load = this.loadState.asReadonly();
  readonly visibleOptions = computed(() => {
    const query = this.queryState().trim();
    const options = this.optionState();
    if (!query) return options;
    const normalizedQuery = normalizeSearch(query, this.locale);
    return options.filter((option) =>
      normalizeSearch(option.label, this.locale).includes(normalizedQuery),
    );
  });
  readonly selectedValues = computed<readonly T[]>(() => {
    const snapshots = this.selectedValueSnapshots();
    const current = new Map(this.optionState().map((option) => [option.key, option.value]));
    return this.keyState().flatMap((key) => {
      if (current.has(key)) return [current.get(key)!];
      return snapshots.has(key) ? [snapshots.get(key)!] : [];
    });
  });
  readonly value = computed<T | readonly T[] | null>(() =>
    this.mode === 'multiple' ? this.selectedValues() : (this.selectedValues()[0] ?? null),
  );
  readonly activeOption = computed(
    () => this.visibleOptions().find((option) => option.key === this.activeKeyState()) ?? null,
  );
  readonly hasNoResults = computed(
    () => this.queryState().trim().length > 0 && this.visibleOptions().length === 0,
  );

  private readonly keyOf: (value: T) => K;
  private readonly locale?: string;

  constructor(options: SelectControllerOptions<T, K>) {
    this.keyOf = options.keyOf;
    this.modeState.set(options.mode ?? 'single');
    this.locale = options.locale;
  }

  setOptions(options: readonly SelectOption<T, K>[], append = false): void {
    const priorActiveIndex = this.optionState().findIndex(
      (option) => option.key === this.activeKeyState(),
    );
    const next = append ? [...this.optionState(), ...options] : [...options];
    const keys = new Set<K>();
    const normalized = next.map((option) => {
      if (keys.has(option.key))
        throw new Error(`Select option key is duplicated: ${String(option.key)}`);
      keys.add(option.key);
      return normalize(option);
    });
    this.optionState.set(normalized);
    const snapshots = new Map(this.selectedValueSnapshots());
    for (const option of normalized) {
      if (this.keyState().includes(option.key)) snapshots.set(option.key, option.value);
    }
    this.selectedValueSnapshots.set(snapshots);
    this.reconcileActiveOption(false, priorActiveIndex);
    if (!this.loadState().loadingMore) {
      this.loadState.set({
        status: normalized.length === 0 ? 'empty' : 'ready',
        loadingMore: false,
      });
    } else {
      this.loadState.update((state) => ({ ...state, loadingMore: false }));
    }
  }

  updateOption(key: K, changes: Partial<Omit<SelectOption<T, K>, 'key'>>): void {
    this.optionState.update((options) =>
      options.map((option) =>
        option.key === key ? normalize({ ...option, ...changes, key }) : option,
      ),
    );
    const updated = this.optionState().find((option) => option.key === key);
    if (updated && this.keyState().includes(key)) {
      this.selectedValueSnapshots.update((values) => new Map(values).set(key, updated.value));
    }
  }

  unregisterOption(key: K): void {
    const priorIndex = this.optionState().findIndex((option) => option.key === key);
    const wasActive = this.activeKeyState() === key;
    this.optionState.update((options) => options.filter((option) => option.key !== key));
    // Selected values survive filtering, virtualized window changes, and async page replacement.
    if (wasActive && this.openState()) {
      const options = this.visibleOptions();
      this.activeKeyState.set(options[Math.min(priorIndex, options.length - 1)]?.key);
    } else {
      this.reconcileActiveOption();
    }
  }

  setQuery(query: string): void {
    this.queryState.set(query);
    this.openState.set(true);
    this.reconcileActiveOption(true);
  }

  open(edge?: 'first' | 'last', preferredKey?: K | null): void {
    if (this.disabledState()) return;
    this.openState.set(true);
    const options = this.visibleOptions();
    const selectedKey = preferredKey === null ? undefined : (preferredKey ?? this.keyState()[0]);
    const active = edge
      ? options[edge === 'first' ? 0 : options.length - 1]
      : (options.find((option) => option.key === selectedKey) ?? options[0]);
    this.activeKeyState.set(active?.key);
  }

  close(): void {
    this.openState.set(false);
    this.activeKeyState.set(undefined);
  }

  clearQuery(): void {
    this.queryState.set('');
  }

  setDisabled(disabled: boolean): void {
    this.disabledState.set(disabled);
    if (disabled) this.close();
  }

  setMode(mode: SelectMode): void {
    this.modeState.set(mode);
    if (mode === 'single' && this.keyState().length > 1) {
      const [first] = this.keyState();
      this.keyState.set(first === undefined ? [] : [first]);
    }
  }

  moveActive(
    direction: 'next' | 'previous' | 'first' | 'last',
  ): NormalizedSelectOption<T, K> | null {
    const options = this.visibleOptions();
    if (options.length === 0) {
      this.activeKeyState.set(undefined);
      return null;
    }
    const current = options.findIndex((option) => option.key === this.activeKeyState());
    let next: number;
    if (direction === 'first') next = 0;
    else if (direction === 'last') next = options.length - 1;
    else if (current < 0) next = direction === 'next' ? 0 : options.length - 1;
    else
      next =
        direction === 'next'
          ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length;
    const option = options[next];
    this.activeKeyState.set(option.key);
    return option;
  }

  setActive(key: K | undefined): void {
    if (key === undefined || this.visibleOptions().some((option) => option.key === key)) {
      this.activeKeyState.set(key);
    }
  }

  requestSelection(key: K): { readonly value: T | readonly T[] | null } | null {
    if (this.disabledState()) return null;
    const option = this.optionState().find((candidate) => candidate.key === key);
    if (!option || option.disabled) return null;
    if (this.mode === 'single') return { value: option.value };

    const selectedKeys = this.keyState();
    const selectedValues = this.selectedValues();
    const selectedIndex = selectedKeys.indexOf(key);
    if (selectedIndex >= 0) {
      return { value: selectedValues.filter((_, index) => index !== selectedIndex) };
    }
    return { value: [...selectedValues, option.value] };
  }

  select(key: K): boolean {
    const request = this.requestSelection(key);
    if (!request) return false;
    const single = this.mode === 'single';
    this.writeValue(request.value);
    if (single) {
      this.close();
      this.clearQuery();
    }
    return true;
  }

  clear(): void {
    this.keyState.set([]);
    this.selectedValueSnapshots.set(new Map());
  }

  writeValue(value: T | readonly T[] | null): void {
    const values = value === null ? [] : Array.isArray(value) ? [...value] : [value as T];
    if (this.mode === 'single' && values.length > 1) {
      throw new Error('A single Select controller cannot receive multiple values.');
    }
    const keys = values.map((item) => this.keyOf(item));
    if (new Set(keys).size !== keys.length)
      throw new Error('Select value contains duplicate option identities.');
    this.keyState.set(keys);
    const snapshots = new Map<K, T>();
    values.forEach((item, index) => snapshots.set(keys[index], item));
    this.selectedValueSnapshots.set(snapshots);
  }

  beginLoad(kind: 'initial' | 'more' = 'initial'): SelectLoadRequest {
    const request = this.requestSequence() + 1;
    this.requestSequence.set(request);
    if (kind === 'initial') this.loadState.set({ status: 'loading', loadingMore: false });
    else this.loadState.update((state) => ({ ...state, loadingMore: true }));
    return request;
  }

  resolveLoad(
    request: SelectLoadRequest,
    options: readonly SelectOption<T, K>[],
    append = false,
  ): boolean {
    if (request !== this.requestSequence()) return false;
    this.setOptions(options, append);
    return true;
  }

  rejectLoad(request: SelectLoadRequest, error: unknown): boolean {
    if (request !== this.requestSequence()) return false;
    this.loadState.set({ status: 'error', error, loadingMore: false });
    return true;
  }

  private reconcileActiveOption(preferFirst = false, priorIndex?: number): void {
    const options = this.visibleOptions();
    const activeKey = this.activeKeyState();
    if (activeKey !== undefined && options.some((option) => option.key === activeKey)) return;
    if (!this.openState() || options.length === 0) {
      this.activeKeyState.set(undefined);
      return;
    }
    if (preferFirst) {
      this.activeKeyState.set(options[0].key);
      return;
    }
    const oldIndex = priorIndex ?? -1;
    this.activeKeyState.set(options[Math.min(Math.max(oldIndex, 0), options.length - 1)]?.key);
  }
}

function normalizeSearch(text: string, locale?: string): string {
  return text.toLocaleLowerCase(locale).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
}
