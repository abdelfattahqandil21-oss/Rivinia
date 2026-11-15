import { computed, untracked } from '@angular/core';
import { MenuController } from '../menu-controller';
import type { RiviniaMenuController, RiviniaMenuFocus, RiviniaMenuItem } from '../models/menu-types';

/** Compatibility facade for the original API, backed by the shared menu engine.
 * Original consumers skip disabled rows; composed menus keep them focusable.
 */
export class RiviniaMenu implements RiviniaMenuController {
  private readonly engine = new MenuController({ skipDisabled: true });
  readonly open = this.engine.isOpen;
  readonly activeId = computed(() => {
    const id = this.engine.activeItemId();
    return typeof id === 'string' ? id : null;
  });
  readonly items = computed<readonly RiviniaMenuItem[]>(() =>
    this.engine.items().map(item => ({ id: String(item.id), disabled: item.disabled })));

  register(item: RiviniaMenuItem): void {
    untracked(() => {
    if (this.engine.items().some(existing => existing.id === item.id)) {
      this.engine.updateItem(item.id, item);
    } else this.engine.registerItem({ ...item, textValue: item.id });
    });
  }
  unregister(id: string): void {
    const active = this.activeId() === id;
    this.engine.unregisterItem(id);
    if (active) this.engine.setActiveItem(undefined);
  }
  openMenu(focus: RiviniaMenuFocus = 'first'): void {
    this.engine.open(focus === 'last' ? 'last' : 'first');
    if (focus === 'none') this.engine.setActiveItem(undefined);
  }
  closeMenu(): void { this.engine.close(); }
  toggle(focus: RiviniaMenuFocus = 'first'): void {
    if (this.open()) this.closeMenu(); else this.openMenu(focus);
  }
  pickActive(): string | null { return this.activeId(); }
  activateFirst(): void { this.engine.move('first'); }
  activateLast(): void { this.engine.move('last'); }
  activateNext(): void { this.engine.move('next'); }
  activatePrevious(): void { this.engine.move('previous'); }
  activate(id: string): boolean {
    const item = this.engine.items().find(item => item.id === id);
    if (!item || item.disabled) return false;
    this.engine.setActiveItem(id);
    return true;
  }
}
