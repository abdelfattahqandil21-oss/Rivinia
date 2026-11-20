import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  InjectionToken,
  inject,
  Injector,
  input,
  LOCALE_ID,
  output,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import {
  connectPopup,
  type PopupConnection,
  type PopupDismissReason,
  type ConnectedPopupPlacement as PopupPlacement,
} from '@rivinia/popup';
import {
  MenuController,
  type MenuActivation,
  type MenuActivationSource,
  type MenuEdge,
  type MenuItemId,
} from '@rivinia/menu';

/** Navigation seam for optional integrations; the core never depends on a router. */
export interface MenuItemNavigationAdapter {
  href(): string | null;
  active(): boolean;
  navigate(event: MouseEvent): Promise<boolean>;
}

export const MENU_ITEM_NAVIGATION = new InjectionToken<MenuItemNavigationAdapter>(
  'RIVINIA_MENU_ITEM_NAVIGATION',
);

@Directive({
  selector: '[rvMenuRoot]',
  standalone: true,
  providers: [{ provide: MenuController, useFactory: () => new MenuController() }],
})
export class MenuRootDirective {
  readonly rvMenuRootId = input<string>();
  readonly triggerId = computed(() => {
    const id = this.rvMenuRootId()?.trim();
    return id ? `${id}-trigger` : undefined;
  });
  readonly panelId = computed(() => {
    const id = this.rvMenuRootId()?.trim();
    return id ? `${id}-panel` : undefined;
  });
  readonly triggerElement = signal<HTMLElement | undefined>(undefined);
  readonly contentItems = contentChildren(MenuItemDirective, { descendants: true });

  private readonly controller = inject(MenuController);
  private readonly focusTargets = new Map<MenuItemId, HTMLElement>();

  constructor() {
    effect(() => {
      const ids = this.contentItems()
        .filter((item) => item.root === this)
        .map((item) => item.id());
      if (ids.length === 0) return;
      const registered = new Set(this.controller.items().map((item) => item.id));
      this.controller.setItemOrder(ids.filter((id) => registered.has(id)));
    });
  }

  registerTrigger(element: HTMLElement): void {
    this.triggerElement.set(element);
  }

  unregisterTrigger(element: HTMLElement): void {
    if (this.triggerElement() === element) this.triggerElement.set(undefined);
  }

  registerFocusableItem(id: MenuItemId, element: HTMLElement): void {
    this.focusTargets.set(id, element);
  }

  unregisterFocusableItem(id: MenuItemId, element: HTMLElement): void {
    if (this.focusTargets.get(id) === element) this.focusTargets.delete(id);
  }

  open(edge: MenuEdge = 'first'): void {
    this.controller.open(edge);
  }

  close(): void {
    this.controller.close();
  }

  focusTrigger(): void {
    this.triggerElement()?.focus();
  }

  focusActiveItem(): boolean {
    const id = this.controller.activeItemId();
    const element = id === undefined ? undefined : this.focusTargets.get(id);
    element?.focus();
    return !!element;
  }

  focusItem(id: MenuItemId | undefined): void {
    if (id === undefined) return;
    this.focusTargets.get(id)?.focus();
  }

  closeAfterNativeTab(): void {
    // Let the browser complete its sequential focus move before hiding the manual popover.
    setTimeout(() => this.controller.close(), 0);
  }

  restoreFocusAfterActivation(): void {
    queueMicrotask(() => this.focusTrigger());
  }
}

@Directive({
  selector: '[rvMenuTrigger]',
  standalone: true,
  host: {
    '[attr.id]': 'root.triggerId()',
    '[attr.aria-haspopup]': '"menu"',
    '[attr.aria-expanded]': 'controller.isOpen()',
    '[attr.aria-controls]': 'root.panelId() ?? null',
    '(click)': 'onClick()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MenuTriggerDirective {
  readonly root = inject(MenuRootDirective);
  readonly controller = inject(MenuController);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.root.registerTrigger(this.host.nativeElement);
    this.destroyRef.onDestroy(() => this.root.unregisterTrigger(this.host.nativeElement));
  }

  onClick(): void {
    if (this.controller.isOpen()) {
      this.controller.close();
      return;
    }
    this.controller.open();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.controller.open('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.controller.open('last');
    }
  }
}

/** Declares an item's stable identity; its action and accessible label are separate directives. */
@Directive({
  selector: 'ng-template[rvMenuItem]',
  standalone: true,
})
export class MenuItemDefDirective {
  readonly rvMenuItem = input.required<string>();
  readonly visible = input(true, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly href = input<string | undefined>();
  readonly target = input<string>();
  readonly rel = input<string>();
  readonly kind = input<'action' | 'checkbox' | 'radio'>('action');
  readonly checked = input(false, { transform: booleanAttribute });
  readonly radioGroup = input<string>();
  readonly navigation = inject(MENU_ITEM_NAVIGATION, { self: true, optional: true });
  readonly root = inject(MenuRootDirective);
  readonly template = inject(TemplateRef<unknown>);
  readonly action = inject(MenuActionDirective, { self: true, optional: true });
  readonly label = inject(MenuLabelDirective, { self: true, optional: true });
  readonly rvMenuItemActivated = output<MenuActivation>();
  private readonly parentRadioGroup = inject(MenuRadioGroupDirective, {
    skipSelf: true,
    optional: true,
  });

  private readonly viewContainer = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private outlet?: ComponentRef<MenuItemOutletComponent>;

  effectiveRadioGroup(): string {
    return this.radioGroup() ?? this.parentRadioGroup?.rvMenuRadioGroup() ?? 'default';
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.outlet?.destroy());
  }

  createOutlet(): ComponentRef<MenuItemOutletComponent> {
    this.outlet ??= this.viewContainer.createComponent(MenuItemOutletComponent, {
      injector: this.injector,
    });
    this.outlet.setInput('definition', this);
    return this.outlet;
  }
}

/** Supplies a callback run when an enabled item is activated. */
@Directive({ selector: 'ng-template[rvMenuAction]', standalone: true })
export class MenuActionDirective {
  readonly rvMenuAction = input.required<(activation: MenuActivation) => void>();
}

/** Supplies typeahead text and the accessible name for a panel or item definition. */
@Directive({
  selector: '[rvMenuLabel]',
  standalone: true,
})
export class MenuLabelDirective {
  readonly rvMenuLabel = input.required<string>();
}

/** Marks non-interactive identity content inside a menu panel as a labelled group. */
@Directive({
  selector: '[rvMenuHeader]',
  standalone: true,
  host: {
    '[attr.role]': '"group"',
    '[attr.aria-label]': 'accessibleLabel()',
  },
})
export class MenuHeaderDirective {
  private readonly label = inject(MenuLabelDirective, { self: true, optional: true });
  readonly accessibleLabel = computed(() => this.label?.rvMenuLabel() ?? null);
}

/** Labels related items and provides their default consumer-controlled radio group identity. */
@Directive({
  selector: '[rvMenuRadioGroup]',
  standalone: true,
  host: {
    '[attr.role]': '"group"',
    '[attr.aria-label]': 'accessibleLabel()',
    '[attr.data-rv-menu-radio-group]': 'rvMenuRadioGroup()',
  },
})
export class MenuRadioGroupDirective {
  readonly rvMenuRadioGroup = input.required<string>();
  private readonly label = inject(MenuLabelDirective, { self: true, optional: true });
  readonly accessibleLabel = computed(() => this.label?.rvMenuLabel() ?? null);
}

/** Lazy non-item content shown while a menu is loading. */
@Directive({ selector: 'ng-template[rvMenuLoading]', standalone: true })
export class MenuLoadingTemplateDirective {
  readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private visible = false;

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.viewContainer.clear();
    if (visible) this.viewContainer.createEmbeddedView(this.template);
  }
}

/** Lazy non-item content shown when loading is false and no item is visible. */
@Directive({ selector: 'ng-template[rvMenuEmpty]', standalone: true })
export class MenuEmptyTemplateDirective {
  readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private visible = false;

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.viewContainer.clear();
    if (visible) this.viewContainer.createEmbeddedView(this.template);
  }
}

@Directive({
  selector: '[rvMenuPanel]',
  standalone: true,
  host: {
    class: 'rv-menu-panel',
    '[attr.id]': 'root.panelId() ?? null',
    '[attr.popover]': '"manual"',
    '[attr.role]': '"menu"',
    '[attr.tabindex]': '-1',
    '[attr.aria-labelledby]': 'root.triggerId() ?? null',
    '[attr.aria-label]': 'accessibleLabel()',
    '[attr.data-rv-menu-variant]': 'rvMenuVariant()',
    '[attr.data-rv-menu-size]': 'rvMenuSize()',
    '[attr.data-rv-menu-shape]': 'rvMenuShape()',
    '[attr.aria-busy]': 'rvMenuLoading() ? "true" : null',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MenuPanelDirective {
  readonly rvMenuVariant = input<'surface' | 'raised' | 'plain'>('surface');
  readonly rvMenuSize = input<'compact' | 'comfortable' | 'spacious'>('comfortable');
  readonly rvMenuShape = input<'square' | 'rounded' | 'pill'>('rounded');
  readonly rvMenuPlacement = input<PopupPlacement>('bottom-start');
  readonly rvMenuOffset = input(4);
  readonly rvMenuLoading = input(false, { transform: booleanAttribute });
  readonly root = inject(MenuRootDirective);
  readonly controller = inject(MenuController);
  readonly itemDefinitions = contentChildren(MenuItemDefDirective, { descendants: true });
  readonly loadingTemplates = contentChildren(MenuLoadingTemplateDirective, { descendants: true });
  readonly emptyTemplates = contentChildren(MenuEmptyTemplateDirective, { descendants: true });
  private readonly label = inject(MenuLabelDirective, { self: true, optional: true });
  readonly accessibleLabel = computed(() => this.label?.rvMenuLabel() ?? null);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private connection?: PopupConnection;
  private connectedOrigin?: HTMLElement;
  private connectedPlacement?: PopupPlacement;
  private connectedOffset?: number;
  private rendered = false;
  private destroyed = false;

  constructor() {
    effect(
      () => {
        const definitions = this.itemDefinitions();
        for (const definition of definitions) {
          const outlet = definition.createOutlet();
          outlet.setInput('visible', definition.visible() && !this.rvMenuLoading());
        }
        const loading = this.rvMenuLoading();
        const hasVisibleItems = definitions.some((definition) => definition.visible());
        for (const slot of this.loadingTemplates()) slot.setVisible(loading);
        for (const slot of this.emptyTemplates()) slot.setVisible(!loading && !hasVisibleItems);
      },
      { injector: this.injector },
    );
    afterNextRender({
      mixedReadWrite: () => {
        if (this.destroyed) return;
        this.rendered = true;
        effect(
          () => {
            this.syncDefinitionOrder();
            this.syncPanel();
          },
          { injector: this.injector },
        );
      },
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.connection?.destroy();
      this.connection = undefined;
      this.hidePopover();
    });
  }

  private syncDefinitionOrder(): void {
    const definitions = this.itemDefinitions().filter(
      (definition) => definition.root === this.root,
    );
    const legacyItems = this.root.contentItems().filter((item) => item.root === this.root);
    if (definitions.length && legacyItems.length) {
      throw new Error(
        'Use template rvMenuItem definitions or element rvMenuItem directives in a panel, not both.',
      );
    }
    const ids = definitions.map((definition) => {
      const id = definition.rvMenuItem().trim();
      if (!id) throw new Error('rvMenuItem requires a non-empty item id.');
      if (!definition.label?.rvMenuLabel().trim()) {
        throw new Error(`Menu item "${id}" requires rvMenuLabel.`);
      }
      if (definition.kind() === 'action') {
        const activationModes =
          Number(definition.href() !== undefined) +
          Number(definition.navigation !== null) +
          Number(definition.action !== null);
        if (activationModes !== 1) {
          throw new Error(
            `Action menu item "${id}" requires exactly one of rvMenuAction, href, or rvMenuLink.`,
          );
        }
      } else if (definition.href() !== undefined || definition.navigation) {
        throw new Error(`Menu item "${id}" cannot combine href or rvMenuLink with a checked kind.`);
      }
      return id;
    });
    if (new Set(ids).size !== ids.length) {
      throw new Error('rvMenuItem values must be unique within a menu.');
    }
    const registered = new Set(this.controller.items().map((item) => item.id));
    const renderedIds = definitions.length
      ? definitions
          .filter((definition) => definition.visible())
          .map((definition) => definition.rvMenuItem())
      : legacyItems.map((item) => item.id());
    this.controller.setItemOrder(renderedIds.filter((id) => registered.has(id)));
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') this.root.closeAfterNativeTab();
  }

  private syncPanel(): void {
    const open = this.controller.isOpen();
    const panel = this.host.nativeElement;
    const trigger = this.root.triggerElement();
    const placement = this.rvMenuPlacement();
    const offset = this.rvMenuOffset();
    if (!this.rendered || this.destroyed) return;

    if (!open || !trigger || !panel.isConnected) {
      this.connection?.destroy();
      this.connection = undefined;
      this.connectedOrigin = undefined;
      this.connectedPlacement = undefined;
      this.connectedOffset = undefined;
      if (!open) this.hidePopover();
      return;
    }

    if (!panel.matches(':popover-open')) panel.showPopover();
    if (
      this.connection &&
      (this.connectedOrigin !== trigger ||
        this.connectedPlacement !== placement ||
        this.connectedOffset !== offset)
    ) {
      if (this.connectedOrigin !== trigger) {
        this.connection.destroy();
        this.connection = undefined;
      } else {
        this.connection.update({ placement, offset });
        this.connectedPlacement = placement;
        this.connectedOffset = offset;
      }
    }
    if (!this.connection) {
      this.connection = connectPopup({
        origin: trigger,
        panel,
        placement,
        offset,
        onDismiss: (reason) => this.dismiss(reason),
      });
      this.connectedOrigin = trigger;
      this.connectedPlacement = placement;
      this.connectedOffset = offset;
    }

    queueMicrotask(() => {
      if (!this.controller.isOpen()) return;
      if (!this.root.focusActiveItem()) panel.focus();
    });
  }

  private dismiss(reason: PopupDismissReason): void {
    this.connection = undefined;
    this.connectedOrigin = undefined;
    this.connectedPlacement = undefined;
    this.connectedOffset = undefined;
    this.hidePopover();
    this.controller.close();
    if (reason === 'escape') this.root.focusTrigger();
  }

  private hidePopover(): void {
    const panel = this.host.nativeElement;
    if (panel.matches(':popover-open')) panel.hidePopover();
  }
}

@Directive({
  selector: '[rvMenuItem]:not(ng-template)',
  standalone: true,
  host: {
    class: 'rv-menu-item',
    '[attr.role]': 'role()',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.aria-disabled]': 'rvMenuItemDisabled() ? "true" : null',
    '[attr.aria-label]': 'rvMenuItemLabel() ?? null',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-current]': 'ariaCurrent()',
    '[attr.data-rv-menu-kind]': 'rvMenuItemKind()',
    '[attr.data-rv-menu-active]': 'isActive() ? "true" : null',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MenuItemDirective {
  readonly rvMenuItemId = input<MenuItemId>();
  readonly rvMenuItemText = input<string>();
  readonly rvMenuItemLabel = input<string>();
  readonly rvMenuItemDisabled = input(false, { transform: booleanAttribute });
  readonly rvMenuItemKind = input<'action' | 'checkbox' | 'radio'>('action');
  readonly rvMenuItemChecked = input(false, { transform: booleanAttribute });
  readonly rvMenuItemGroup = input<string>();
  readonly rvMenuItemNavigation = input<MenuItemNavigationAdapter | null>(null);
  readonly rvMenuItemActivated = output<MenuActivation>();
  readonly controller = inject(MenuController);
  readonly root = inject(MenuRootDirective);
  private readonly parentRadioGroup = inject(MenuRadioGroupDirective, {
    skipSelf: true,
    optional: true,
  });

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly idValue = Symbol('rv-menu-item');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private unregister?: () => void;
  private currentId?: MenuItemId;

  constructor() {
    effect(() => this.syncRegistration(), { injector: this.injector });
    this.destroyRef.onDestroy(() => {
      this.unregister?.();
      if (this.currentId !== undefined) {
        this.root.unregisterFocusableItem(this.currentId, this.host.nativeElement);
      }
    });
  }

  id(): MenuItemId {
    return this.rvMenuItemId() ?? this.idValue;
  }

  role(): string {
    switch (this.rvMenuItemKind()) {
      case 'checkbox':
        return 'menuitemcheckbox';
      case 'radio':
        return 'menuitemradio';
      default:
        return 'menuitem';
    }
  }

  tabIndex(): number {
    return this.controller.isOpen() && this.controller.activeItemId() === this.id() ? 0 : -1;
  }

  isActive(): boolean {
    return this.controller.activeItemId() === this.id();
  }

  ariaChecked(): 'true' | 'false' | null {
    return this.rvMenuItemKind() === 'action' ? null : this.rvMenuItemChecked() ? 'true' : 'false';
  }

  ariaCurrent(): 'page' | null {
    return this.rvMenuItemNavigation()?.active() ? 'page' : null;
  }

  radioGroup(): string {
    return this.rvMenuItemGroup() ?? this.parentRadioGroup?.rvMenuRadioGroup() ?? 'default';
  }

  focus(): void {
    this.host.nativeElement.focus();
  }

  onClick(event: MouseEvent): void {
    if (this.rvMenuItemDisabled()) {
      event.preventDefault();
      return;
    }
    const navigation = this.rvMenuItemNavigation();
    const target = this.host.nativeElement.getAttribute('target');
    const download = this.host.nativeElement.hasAttribute('download');
    const navigateInApp =
      navigation &&
      event.button === 0 &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !download &&
      (!target || target.toLowerCase() === '_self');

    if (navigateInApp) {
      event.preventDefault();
      const activated = this.activate(event.detail === 0 ? 'keyboard' : 'pointer');
      if (!activated) return;
      void navigation.navigate(event).then(
        (navigated) => {
          if (!navigated) this.root.focusTrigger();
        },
        () => this.root.focusTrigger(),
      );
      return;
    }

    this.activate(event.detail === 0 ? 'keyboard' : 'pointer');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.root.focusItem(this.controller.move('next')?.id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.root.focusItem(this.controller.move('previous')?.id);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.root.focusItem(this.controller.move('first')?.id);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.root.focusItem(this.controller.move('last')?.id);
    } else if (event.key === 'Tab') {
      this.root.closeAfterNativeTab();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (this.host.nativeElement.tagName === 'BUTTON') return;
      if (this.host.nativeElement.tagName === 'A') return;
      event.preventDefault();
      this.activate('keyboard');
    } else if (!event.altKey && !event.ctrlKey && !event.metaKey) {
      const item = this.controller.typeahead(event.key, { locale: this.locale });
      if (item) event.preventDefault();
    }
  }

  private readonly locale = inject(LOCALE_ID);

  private activate(source: MenuActivationSource): boolean {
    const activation = this.controller.activate(this.id(), source);
    if (!activation) return false;
    this.rvMenuItemActivated.emit(activation);
    if (activation.type === 'action' && this.host.nativeElement.tagName !== 'A') {
      this.root.restoreFocusAfterActivation();
    }
    return true;
  }

  private syncRegistration(): void {
    const id = this.id();
    const definition = {
      id,
      textValue: this.rvMenuItemText() ?? this.host.nativeElement.textContent ?? '',
      disabled: this.rvMenuItemDisabled(),
      kind: this.rvMenuItemKind(),
      checked: this.rvMenuItemChecked(),
      radioGroup: this.radioGroup(),
    } as const;

    if (this.currentId !== id) {
      if (this.currentId !== undefined) {
        this.root.unregisterFocusableItem(this.currentId, this.host.nativeElement);
      }
      this.unregister?.();
      this.unregister = this.controller.registerItem(definition);
      this.root.registerFocusableItem(id, this.host.nativeElement);
      this.currentId = id;
      return;
    }
    this.controller.updateItem(id, definition);
    this.root.registerFocusableItem(id, this.host.nativeElement);
  }
}

@Component({
  selector: 'rv-menu-item-outlet',
  standalone: true,
  imports: [MenuItemDirective],
  templateUrl: './menu-item-outlet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'none', style: 'display: contents' },
})
class MenuItemOutletComponent {
  readonly definition = input.required<MenuItemDefDirective>();
  readonly visible = input(true);
  readonly contentOutlet = viewChild('contentOutlet', { read: ViewContainerRef });
  private readonly controller = inject(MenuController);

  constructor() {
    effect(() => {
      const outlet = this.contentOutlet();
      const definition = this.definition();
      if (!outlet) return;
      outlet.clear();
      if (this.controller.isOpen() && this.visible() && definition.visible()) {
        outlet.createEmbeddedView(definition.template);
      }
    });
  }

  onActivated(event: MenuActivation): void {
    const definition = this.definition();
    definition.rvMenuItemActivated.emit(event);
    definition.action?.rvMenuAction()(event);
  }

  linkRel(): string | null {
    const definition = this.definition();
    const rel = new Set((definition.rel() ?? '').split(/\s+/).filter(Boolean));
    if (definition.target()?.toLowerCase() === '_blank') {
      rel.add('noopener');
      rel.add('noreferrer');
    }
    return rel.size ? [...rel].join(' ') : null;
  }
}

@Directive({
  selector: '[rvMenuSeparator]',
  standalone: true,
  host: {
    class: 'rv-menu-separator',
    '[attr.role]': '"separator"',
    '[attr.aria-orientation]': '"horizontal"',
  },
})
export class MenuSeparatorDirective {}
