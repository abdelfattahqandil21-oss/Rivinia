import { computed, signal } from '@angular/core';

export type MenuItemId = string | symbol;
export type MenuItemKind = 'action' | 'checkbox' | 'radio';
export type MenuEdge = 'first' | 'last';
export type MenuMovement = 'next' | 'previous' | MenuEdge;

export interface MenuItemDefinition {
  readonly id: MenuItemId;
  readonly textValue: string;
  readonly disabled?: boolean;
  readonly kind?: MenuItemKind;
  readonly checked?: boolean;
  readonly radioGroup?: string;
}

export interface MenuItem extends MenuItemDefinition {
  readonly disabled: boolean;
  readonly kind: MenuItemKind;
  readonly checked: boolean;
}

export type MenuActivationSource = 'pointer' | 'keyboard' | 'programmatic';

export type MenuActivation =
  | { readonly type: 'action'; readonly item: MenuItem; readonly source: MenuActivationSource }
  | {
      readonly type: 'checked-change';
      readonly item: MenuItem;
      readonly checked: boolean;
      readonly source: MenuActivationSource;
    };

export interface MenuTypeaheadOptions {
  readonly locale?: string;
  /** Inject a clock value to make timeout behavior deterministic in tests. */
  readonly now?: number;
}

const TYPEAHEAD_TIMEOUT_MS = 500;

function normalizeDefinition(item: MenuItemDefinition): MenuItem {
  return {
    ...item,
    textValue: item.textValue.trim(),
    disabled: item.disabled ?? false,
    kind: item.kind ?? 'action',
    checked: item.checked ?? false,
  };
}

function sameLocalePrefix(value: string, prefix: string, locale?: string): boolean {
  const valuePrefix = Array.from(value).slice(0, Array.from(prefix).length).join('');
  return valuePrefix.localeCompare(prefix, locale, { sensitivity: 'base' }) === 0;
}

/**
 * Per-menu, DOM-free state and behavior for an accessible action menu.
 * Each consumer creates one controller for one menu root.
 */
export class MenuController {
  constructor(private readonly policy: { skipDisabled?: boolean } = {}) {}
  private readonly openState = signal(false);
  private readonly itemState = signal<readonly MenuItem[]>([]);
  private readonly activeIdState = signal<MenuItemId | undefined>(undefined);
  private typeaheadBuffer = '';
  private lastTypeaheadAt = Number.NEGATIVE_INFINITY;

  readonly isOpen = this.openState.asReadonly();
  readonly items = this.itemState.asReadonly();
  readonly activeItemId = this.activeIdState.asReadonly();
  readonly activeItem = computed(
    () => this.itemState().find((item) => item.id === this.activeIdState()) ?? null,
  );

  open(edge: MenuEdge = 'first'): void {
    this.openState.set(true);
    this.clearTypeahead();
    this.activeIdState.set(
      this.navigationItems()[edge === 'first' ? 0 : this.navigationItems().length - 1]?.id,
    );
  }

  close(): void {
    if (!this.openState()) return;
    this.openState.set(false);
    this.activeIdState.set(undefined);
    this.clearTypeahead();
  }

  toggle(edge: MenuEdge = 'first'): void {
    if (this.openState()) this.close();
    else this.open(edge);
  }

  registerItem(definition: MenuItemDefinition): () => void {
    if (this.itemState().some((item) => item.id === definition.id)) {
      throw new Error(`Menu item id is already registered: ${String(definition.id)}`);
    }
    this.itemState.update((items) => [...items, normalizeDefinition(definition)]);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      this.unregisterItem(definition.id);
    };
  }

  updateItem(id: MenuItemId, changes: Partial<Omit<MenuItemDefinition, 'id'>>): void {
    this.itemState.update((items) =>
      items.map((item) =>
        item.id === id ? normalizeDefinition({ ...item, ...changes, id }) : item,
      ),
    );
  }

  unregisterItem(id: MenuItemId): void {
    const items = this.itemState();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const wasActive = this.activeIdState() === id;
    const next = items.filter((item) => item.id !== id);
    this.itemState.set(next);
    if (wasActive) this.activeIdState.set(next[Math.min(index, next.length - 1)]?.id);
  }

  /** Reorders registered items to match the supplied rendered order. */
  setItemOrder(ids: readonly MenuItemId[]): void {
    const items = this.itemState();
    const byId = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<MenuItemId>();
    const ordered: MenuItem[] = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) throw new Error(`Cannot order an unregistered menu item: ${String(id)}`);
      if (seen.has(id)) throw new Error(`Menu item id appears more than once: ${String(id)}`);
      seen.add(id);
      ordered.push(item);
    }
    const reordered = [...ordered, ...items.filter((item) => !seen.has(item.id))];
    if (items.every((item, index) => item.id === reordered[index]?.id)) return;
    this.itemState.set(reordered);
  }

  setActiveItem(id: MenuItemId | undefined): void {
    if (id === undefined || this.itemState().some((item) => item.id === id)) {
      this.activeIdState.set(id);
    }
  }

  private navigationItems(): readonly MenuItem[] {
    return this.policy.skipDisabled ? this.itemState().filter(item => !item.disabled) : this.itemState();
  }

  move(movement: MenuMovement): MenuItem | null {
    const items = this.navigationItems();
    if (items.length === 0) {
      this.activeIdState.set(undefined);
      return null;
    }

    const current = items.findIndex((item) => item.id === this.activeIdState());
    let next: number;
    if (movement === 'first') next = 0;
    else if (movement === 'last') next = items.length - 1;
    else if (current < 0) next = movement === 'next' ? 0 : items.length - 1;
    else if (movement === 'next') next = (current + 1) % items.length;
    else next = (current - 1 + items.length) % items.length;

    const item = items[next];
    this.activeIdState.set(item.id);
    return item;
  }

  typeahead(value: string, options: MenuTypeaheadOptions = {}): MenuItem | null {
    const characters = Array.from(value);
    if (!this.openState() || characters.length !== 1 || !/^[\p{L}\p{N}]$/u.test(value)) {
      return null;
    }

    const now = options.now ?? Date.now();
    if (now - this.lastTypeaheadAt > TYPEAHEAD_TIMEOUT_MS) this.typeaheadBuffer = '';
    this.lastTypeaheadAt = now;
    const nextBuffer = this.typeaheadBuffer + value;
    this.typeaheadBuffer = Array.from(nextBuffer).every(
      (character) =>
        character.localeCompare(Array.from(nextBuffer)[0], options.locale, {
          sensitivity: 'base',
        }) === 0,
    )
      ? value
      : nextBuffer;

    const items = this.itemState();
    const current = items.findIndex((item) => item.id === this.activeIdState());
    for (let offset = 1; offset <= items.length; offset += 1) {
      const item = items[(Math.max(current, -1) + offset) % items.length];
      if (
        item.textValue &&
        sameLocalePrefix(item.textValue, this.typeaheadBuffer, options.locale)
      ) {
        this.activeIdState.set(item.id);
        return item;
      }
    }
    return null;
  }

  clearTypeahead(): void {
    this.typeaheadBuffer = '';
    this.lastTypeaheadAt = Number.NEGATIVE_INFINITY;
  }

  /** Returns an activation request without mutating consumer-owned checked state. */
  activate(id: MenuItemId, source: MenuActivationSource = 'programmatic'): MenuActivation | null {
    const item = this.itemState().find((candidate) => candidate.id === id);
    if (!item || item.disabled) return null;
    if (item.kind === 'action') {
      this.close();
      return { type: 'action', item, source };
    }
    return {
      type: 'checked-change',
      item,
      checked: item.kind === 'checkbox' ? !item.checked : true,
      source,
    };
  }

  activateActiveItem(): MenuActivation | null {
    const id = this.activeIdState();
    return id === undefined ? null : this.activate(id);
  }
}
