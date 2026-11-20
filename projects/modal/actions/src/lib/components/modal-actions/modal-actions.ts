import {
  AfterViewInit,
  Component,
  ContentChild,
  Directive,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  effect,
  input,
  inject,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  MenuActionDirective,
  MenuItemDefDirective,
  MenuLabelDirective,
  MenuPanelDirective,
  MenuRootDirective,
  MenuTriggerDirective,
} from '@rivinia/menu/ui';

export type RiviniaActionAppearance = 'solid' | 'outline' | 'flat';
export type RiviniaActionTone = 'neutral' | 'primary' | 'success' | 'danger';
export type RiviniaActionPlacement = 'inline' | 'more' | 'auto' | 'hidden';
export type RiviniaActionLayout = 'buttons' | 'more' | 'adaptive';

export interface RiviniaActionState {
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

export interface RiviniaActionTemplateContext<T extends object> {
  readonly $implicit: T;
  readonly action: T;
  readonly activate: () => void;
}

/** Optional custom content for action buttons and their More menu items. */
@Directive({ selector: 'ng-template[rvActionTemplate]', standalone: true })
export class RiviniaActionTemplate {
  readonly template = inject<TemplateRef<RiviniaActionTemplateContext<object>>>(TemplateRef);
}

let actionBarSequence = 0;

/**
 * Modal action renderer. By default it reads `id`, `name`, `color`, and `order`
 * directly from backend objects. Explicit typed field names or accessors can
 * override those conventions without mapping/copying the objects.
 */
@Component({
  selector: 'rv-action-bar',
  standalone: true,
  imports: [
    MenuRootDirective,
    MenuTriggerDirective,
    MenuPanelDirective,
    MenuItemDefDirective,
    MenuActionDirective,
    MenuLabelDirective,
    NgTemplateOutlet,
  ],
  template: `
    <div #bar class="rv-action-bar" [attr.data-layout]="layout()" [attr.data-appearance]="appearance()">
      <div class="rv-action-bar__items">
        @for (item of inlineItems(); track id(item)) {
          <button
            type="button"
            class="rv-action-bar__button"
            [attr.data-tone]="tone(item)"
            [attr.data-appearance]="itemAppearance(item)"
            [style.--rv-action-custom-color]="customColor(item)"
            [disabled]="state(item).disabled || state(item).loading"
            [attr.aria-busy]="state(item).loading ? 'true' : null"
            (click)="activate(item)"
          >
            @if (state(item).loading) { <span class="rv-action-bar__spinner" aria-hidden="true"></span> }
            @if (actionTemplate) {
              <ng-container [ngTemplateOutlet]="actionTemplate.template" [ngTemplateOutletContext]="templateContext(item)" />
            } @else { {{ label(item) }} }
          </button>
        }
      </div>

      @if (moreItems().length) {
        <div class="rv-action-bar__more" rvMenuRoot [rvMenuRootId]="resolvedMenuId()">
          <button type="button" class="rv-action-bar__button rv-action-bar__more-trigger" rvMenuTrigger>
            {{ moreLabel() }}
          </button>
          <div class="rv-action-bar__menu" rvMenuPanel [rvMenuLabel]="moreLabel()">
            @for (item of moreItems(); track id(item)) {
              <ng-template
                rvMenuItem
                [rvMenuItem]="id(item)"
                [rvMenuAction]="menuAction(item)"
                [rvMenuLabel]="label(item)"
                [disabled]="state(item).disabled || state(item).loading"
              >@if (actionTemplate) { <ng-container [ngTemplateOutlet]="actionTemplate.template" [ngTemplateOutletContext]="templateContext(item)" /> } @else { <span [style.color]="customColor(item)">{{ label(item) }}</span> }</ng-template>
            }
          </div>
        </div>
      }

      @if (layout() === 'adaptive') {
        <div class="rv-action-bar__measure" aria-hidden="true" inert>
          @for (item of measurementItems(); track id(item)) {
            <button #measure type="button" class="rv-action-bar__button" [attr.data-action-id]="id(item)"
              [attr.data-tone]="tone(item)" [attr.data-appearance]="itemAppearance(item)">{{ label(item) }}</button>
          }
          <button #measure type="button" class="rv-action-bar__button rv-action-bar__more-trigger">{{ moreLabel() }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    rv-action-bar { display: block; min-inline-size: 0; }
    .rv-action-bar { position: relative; display: flex; align-items: center; gap: var(--rv-action-gap, .5rem); min-inline-size: 0; }
    .rv-action-bar__items { display: flex; align-items: center; flex-wrap: wrap; gap: var(--rv-action-gap, .5rem); min-inline-size: 0; }
    .rv-action-bar__button { display: inline-flex; align-items: center; justify-content: center; gap: .45em; min-block-size: var(--rv-action-size, 2.5rem); padding: .45em .85em; border: 1px solid var(--rv-action-border, var(--rv-color-border, #cbd2df)); border-radius: var(--rv-action-radius, .55rem); background: var(--rv-action-bg, var(--rv-color-surface-raised, #fff)); color: var(--rv-action-fg, var(--rv-color-text, #1b2230)); font: inherit; cursor: pointer; white-space: nowrap; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease; }
    .rv-action-bar__button:hover:not(:disabled) { background: var(--rv-action-hover-bg, color-mix(in srgb, currentColor 8%, transparent)); }
    .rv-action-bar__button:focus-visible { outline: 2px solid var(--rv-action-focus, var(--rv-color-focus, #2563eb)); outline-offset: 2px; }
    .rv-action-bar__button:disabled { cursor: not-allowed; opacity: .58; }
    .rv-action-bar__button[data-appearance='flat'] { border-color: transparent; background: transparent; }
    .rv-action-bar__button[data-appearance='solid'][data-tone='primary'] { border-color: var(--rv-action-primary-bg, var(--rv-action-custom-color, #2563eb)); background: var(--rv-action-primary-bg, var(--rv-action-custom-color, #2563eb)); color: var(--rv-action-primary-fg, #fff); }
    .rv-action-bar__button[data-appearance='solid'][data-tone='success'] { border-color: var(--rv-action-success-bg, var(--rv-action-custom-color, #16835d)); background: var(--rv-action-success-bg, var(--rv-action-custom-color, #16835d)); color: #fff; }
    .rv-action-bar__button[data-tone='danger'] { color: var(--rv-action-danger-fg, #b42318); border-color: color-mix(in srgb, var(--rv-action-danger-fg, #b42318) 38%, transparent); }
    .rv-action-bar__button[data-appearance='solid'][data-tone='danger'] { background: var(--rv-action-danger-bg, var(--rv-action-custom-color, #b42318)); color: var(--rv-action-danger-on-bg, #fff); }
    .rv-action-bar__button[data-appearance='solid'] { background: var(--rv-action-custom-color, var(--rv-action-bg, #465064)); border-color: var(--rv-action-custom-color, var(--rv-action-bg, #465064)); }
    .rv-action-bar__more { flex: 0 0 auto; }
    .rv-action-bar__menu { min-inline-size: 12rem; }
    .rv-action-bar__spinner { inline-size: .8em; block-size: .8em; border: 2px solid currentColor; border-inline-end-color: transparent; border-radius: 50%; animation: rv-action-spin 650ms linear infinite; }
    .rv-action-bar__measure { position: fixed; inset-inline-start: -100000px; inset-block-start: 0; display: flex; inline-size: max-content; visibility: hidden; pointer-events: none; }
    @keyframes rv-action-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .rv-action-bar__button, .rv-action-bar__spinner { transition: none; animation-duration: 0.01ms; } }
  `,
})
export class RiviniaActionBar<T extends object> implements AfterViewInit, OnDestroy {
  @ViewChildren('measure', { read: ElementRef }) private readonly measureButtons!: QueryList<ElementRef<HTMLButtonElement>>;
  @ContentChild(RiviniaActionTemplate) protected actionTemplate?: RiviniaActionTemplate;

  readonly items = input.required<readonly T[]>();
  readonly idField = input<keyof T>('id' as keyof T);
  readonly labelField = input<keyof T>('name' as keyof T);
  readonly colorField = input<keyof T>('color' as keyof T);
  readonly orderField = input<keyof T>('order' as keyof T);
  readonly idOf = input<(item: T) => string | number>();
  readonly labelOf = input<(item: T) => string>();
  readonly appearance = input<RiviniaActionAppearance>('outline');
  readonly appearanceOf = input<(item: T) => RiviniaActionAppearance>();
  readonly toneOf = input<(item: T) => RiviniaActionTone>();
  readonly colorOf = input<(item: T) => string | undefined>();
  readonly placementOf = input<(item: T) => RiviniaActionPlacement>();
  readonly pinnedOf = input<(item: T) => boolean>();
  readonly visibleOf = input<(item: T) => boolean>();
  readonly stateOf = input<(item: T) => RiviniaActionState>();
  readonly priorityOf = input<(item: T) => number>();
  readonly layout = input<RiviniaActionLayout>('adaptive');
  readonly moreLabel = input('More actions');
  readonly menuId = input<string>();
  readonly generatedMenuId = `rv-action-bar-more-${++actionBarSequence}`;
  readonly activated = output<T>();

  private readonly autoInlineIds = signal<ReadonlySet<string>>(new Set());
  private resizeObserver?: ResizeObserver;
  private measureChanges?: { unsubscribe(): void };
  private readonly reflowWhenInputsChange = effect(() => {
    this.items(); this.layout(); this.placementOf(); this.priorityOf(); this.pinnedOf(); this.visibleOf(); this.labelOf();
    queueMicrotask(() => this.reflow());
  });

  ngAfterViewInit(): void {
    this.measureChanges = this.measureButtons.changes.subscribe(() => this.reflow());
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.reflow());
      const bar = this.measureButtons.first?.nativeElement.closest('.rv-action-bar') as HTMLElement | null;
      if (bar) this.resizeObserver.observe(bar);
    }
    globalThis.requestAnimationFrame?.(() => this.reflow());
  }

  ngOnDestroy(): void {
    this.measureChanges?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  readonly visibleItems = () => this.sorted(this.items().filter((item) => this.visible(item)));
  readonly measurementItems = () => this.visibleItems();
  readonly inlineItems = () => this.visibleItems().filter((item) => {
    if (this.layout() === 'more') return false;
    if (this.pinned(item)) return true;
    if (this.layout() === 'buttons') return true;
    const placement = this.placement(item);
    return placement === 'inline' || (placement === 'auto' && this.autoInlineIds().has(this.id(item)));
  });
  readonly moreItems = () => this.visibleItems().filter((item) => {
    if (this.layout() === 'more') return !this.pinned(item);
    if (this.layout() === 'buttons') return false;
    const placement = this.placement(item);
    return !this.pinned(item) && (placement === 'more' || (placement === 'auto' && !this.autoInlineIds().has(this.id(item))));
  });

  resolvedMenuId(): string { return this.menuId() || this.generatedMenuId; }
  id(item: T): string { return String(this.idOf()?.(item) ?? this.field(item, this.idField()) ?? this.items().indexOf(item)); }
  label(item: T): string { return String(this.labelOf()?.(item) ?? this.field(item, this.labelField()) ?? this.id(item)); }
  tone(item: T): RiviniaActionTone { return this.toneOf()?.(item) ?? 'neutral'; }
  itemAppearance(item: T): RiviniaActionAppearance { return this.appearanceOf()?.(item) ?? this.appearance(); }
  placement(item: T): RiviniaActionPlacement { return this.placementOf()?.(item) ?? 'auto'; }
  pinned(item: T): boolean { return this.pinnedOf()?.(item) ?? false; }
  customColor(item: T): string | null {
    const candidate = this.colorOf()?.(item) ?? this.field(item, this.colorField());
    if (typeof candidate !== 'string' || !candidate.trim()) return null;
    if (/^#[\da-f]{3,8}$/i.test(candidate) || /^(rgb|hsl)a?\([\d.%\s,/-]+\)$/i.test(candidate)) return candidate;
    if (typeof CSS !== 'undefined' && CSS.supports('color', candidate)) return candidate;
    return null;
  }
  state(item: T): RiviniaActionState { return this.stateOf()?.(item) ?? {}; }
  visible(item: T): boolean { return (this.visibleOf()?.(item) ?? true) && this.placement(item) !== 'hidden'; }
  templateContext(item: T): RiviniaActionTemplateContext<T> {
    return { $implicit: item, action: item, activate: () => this.activate(item) };
  }
  activate(item: T): void {
    if (this.state(item).disabled || this.state(item).loading) return;
    this.activated.emit(item);
  }
  menuAction(item: T): () => void { return () => this.activate(item); }
  private field(item: T, key: keyof T): unknown { return item[key]; }
  private numericOrder(item: T): number {
    const value = this.field(item, this.orderField());
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  private sorted(items: readonly T[]): readonly T[] {
    const order = this.orderField();
    return [...items].sort((a, b) => {
      const av = this.field(a, order), bv = this.field(b, order);
      const ao = typeof av === 'number' ? av : Number.MAX_SAFE_INTEGER;
      const bo = typeof bv === 'number' ? bv : Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
  }

  private reflow(): void {
    if (this.layout() !== 'adaptive') {
      this.autoInlineIds.set(new Set(this.measurementItems().map((item) => this.id(item))));
      return;
    }
    const first = this.measureButtons.first?.nativeElement;
    const bar = first?.closest('.rv-action-bar') as HTMLElement | null;
    if (!bar || !first) {
      const only = this.visibleItems();
      if (only.length === 1) this.autoInlineIds.set(new Set([this.id(only[0])]));
      return;
    }
    const width = bar.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(bar).columnGap) || 8;
    const visible = this.visibleItems();
    const autoItems = visible.filter((item) => this.placement(item) === 'auto' && !this.pinned(item));
    const widths = new Map(this.measureButtons.toArray().map(({ nativeElement }) => [
      nativeElement.dataset['actionId'] ?? '__more__', nativeElement.getBoundingClientRect().width,
    ]));
    const fixed = visible.filter((item) => this.placement(item) === 'inline' || this.pinned(item));
    const fixedWidth = fixed.reduce((sum, item) => sum + (widths.get(this.id(item)) ?? 0), 0);
    const hasForcedMore = visible.some((item) => this.placement(item) === 'more' && !this.pinned(item));
    const reserve = autoItems.length > 1 || hasForcedMore;
    const moreSpace = reserve ? gap + (widths.get('__more__') ?? 0) : 0;
    let remaining = width - fixedWidth - gap * Math.max(0, fixed.length - 1) - moreSpace;
    const keep = new Set<string>();
    if (autoItems.length === 1 && !reserve) keep.add(this.id(autoItems[0]));
    else {
      const byPriority = autoItems.map((item, index) => ({ item, index })).sort((a, b) =>
        (this.priorityOf()?.(b.item) ?? this.numericOrder(b.item)) -
        (this.priorityOf()?.(a.item) ?? this.numericOrder(a.item)) || a.index - b.index,
      );
      for (const { item } of byPriority) {
        const itemWidth = widths.get(this.id(item)) ?? 0;
        const required = itemWidth + (keep.size || fixed.length ? gap : 0);
        if (required <= remaining) { keep.add(this.id(item)); remaining -= required; }
      }
    }
    this.autoInlineIds.set(keep);
  }
}
