import { computePopupPosition, type PopupBounds, type PopupPlacement, type PopupPosition } from './geometry';

type BrowserWindow = Window & typeof globalThis;

export type PopupDismissReason = 'outside' | 'escape' | 'anchor-hidden' | 'scroll' | 'resize';
export type PopupScrollStrategy = 'reposition' | 'close';

export interface PopupConnectionUpdate {
  readonly placement?: PopupPlacement;
  readonly offset?: number;
  readonly padding?: number;
  readonly scrollStrategy?: PopupScrollStrategy;
}

export interface PopupConnectionOptions {
  readonly origin: HTMLElement;
  readonly panel: HTMLElement;
  readonly parent?: PopupConnection | 'auto';
  /** Host-owned CSS anchor/fallback positioning; no inline coordinates are owned by Popup. */
  readonly position?: (position: PopupPosition) => void;
  readonly closeOnWidthChange?: boolean;
  readonly placement?: PopupPlacement;
  readonly offset?: number;
  readonly padding?: number;
  readonly scrollStrategy?: PopupScrollStrategy;
  readonly onDismiss: (reason: PopupDismissReason) => void;
}

export interface PopupConnection {
  /** Recomputes visibility and position immediately, optionally changing positioning preferences. */
  update(options?: PopupConnectionUpdate): void;
  /** Disconnects observers and event handling. Safe to call more than once. */
  destroy(): void;
}

interface InlineProperty {
  readonly value: string;
  readonly priority: string;
}

const connections = new WeakMap<PopupConnection, PopupNode>();
const coordinators = new WeakMap<Document, DismissalCoordinator>();
let nextOrder = 0;

function readInline(style: CSSStyleDeclaration, property: string): InlineProperty {
  return { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) };
}

function restoreInline(
  style: CSSStyleDeclaration,
  property: string,
  original: InlineProperty,
): void {
  if (original.value) style.setProperty(property, original.value, original.priority);
  else style.removeProperty(property);
}

function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as Document | ShadowRoot;
  return 'host' in root ? root.host : null;
}

function composedContains(ancestor: Element, descendant: Element): boolean {
  for (let current: Element | null = descendant; current; current = composedParent(current)) {
    if (current === ancestor) return true;
  }
  return false;
}

function clips(value: string): boolean {
  return (
    value === 'auto' ||
    value === 'scroll' ||
    value === 'hidden' ||
    value === 'clip' ||
    value === 'overlay'
  );
}

function clippedOrigin(origin: HTMLElement, bounds: PopupBounds): boolean {
  const view = origin.ownerDocument.defaultView;
  if (!view || !origin.isConnected) return true;
  const originStyle = view.getComputedStyle(origin);
  if (
    originStyle.display === 'none' ||
    originStyle.visibility === 'hidden' ||
    originStyle.visibility === 'collapse'
  ) {
    return true;
  }

  const rect = origin.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;
  let left = rect.left;
  let right = rect.right;
  let top = rect.top;
  let bottom = rect.bottom;

  for (let ancestor = composedParent(origin); ancestor; ancestor = composedParent(ancestor)) {
    const style = view.getComputedStyle(ancestor);
    if (!clips(style.overflowX) && !clips(style.overflowY)) continue;
    const ancestorRect = ancestor.getBoundingClientRect();
    const clipLeft = ancestorRect.left + ancestor.clientLeft;
    const clipTop = ancestorRect.top + ancestor.clientTop;
    if (clips(style.overflowX)) {
      left = Math.max(left, clipLeft);
      right = Math.min(right, clipLeft + ancestor.clientWidth);
    }
    if (clips(style.overflowY)) {
      top = Math.max(top, clipTop);
      bottom = Math.min(bottom, clipTop + ancestor.clientHeight);
    }
    if (right <= left || bottom <= top) return true;
  }

  return (
    right <= bounds.left || left >= bounds.right || bottom <= bounds.top || top >= bounds.bottom
  );
}

function viewportBounds(view: BrowserWindow): PopupBounds {
  const visual = view.visualViewport;
  if (visual) {
    return {
      left: visual.offsetLeft,
      top: visual.offsetTop,
      right: visual.offsetLeft + visual.width,
      bottom: visual.offsetTop + visual.height,
    };
  }
  return { left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight };
}

function fixedContainingBlock(panel: HTMLElement, view: BrowserWindow): HTMLElement | null {
  if (
    typeof view.HTMLElement.prototype.showPopover === 'function' &&
    panel.matches(':popover-open')
  ) {
    return null;
  }
  for (let ancestor = composedParent(panel); ancestor; ancestor = composedParent(ancestor)) {
    const style = view.getComputedStyle(ancestor);
    const contain = style.contain.split(/\s+/);
    const willChange = style.willChange.split(/,\s*/);
    if (
      style.transform !== 'none' ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      (style.getPropertyValue('backdrop-filter') !== '' &&
        style.getPropertyValue('backdrop-filter') !== 'none') ||
      contain.some((value) => ['layout', 'paint', 'strict', 'content'].includes(value)) ||
      willChange.some((value) => ['transform', 'perspective', 'filter', 'contain'].includes(value))
    ) {
      return ancestor as HTMLElement;
    }
  }
  return null;
}

function inFixedContainingBlock(
  panel: HTMLElement,
  view: BrowserWindow,
  position: { readonly left: number; readonly top: number },
): { readonly left: number; readonly top: number } {
  const containingBlock = fixedContainingBlock(panel, view);
  if (!containingBlock) return position;

  const rect = containingBlock.getBoundingClientRect();
  const scaleX = containingBlock.offsetWidth ? rect.width / containingBlock.offsetWidth : 1;
  const scaleY = containingBlock.offsetHeight ? rect.height / containingBlock.offsetHeight : 1;
  if (scaleX <= 0 || scaleY <= 0) return position;
  return {
    left: (position.left - rect.left) / scaleX - containingBlock.clientLeft,
    top: (position.top - rect.top) / scaleY - containingBlock.clientTop,
  };
}

function pathContains(path: readonly EventTarget[], element: Element): boolean {
  return path.includes(element);
}

class DismissalCoordinator {
  readonly roots = new Set<PopupNode>();
  private listening = false;
  private viewportWidth: number | undefined;
  private touch: { id: number; x: number; y: number; at: number; moved: boolean; path: readonly EventTarget[] } | undefined;

  constructor(
    private readonly document: Document,
    private readonly view: BrowserWindow,
  ) {}

  add(node: PopupNode): void {
    if (node.parent) node.parent.children.add(node);
    else this.roots.add(node);
    if (!this.listening) this.bind();
  }

  remove(node: PopupNode): void {
    if (node.parent) node.parent.children.delete(node);
    else this.roots.delete(node);
    if (this.roots.size === 0) this.unbind();
  }

  scheduleAll(): void {
    for (const node of this.allNodes()) node.schedule();
  }

  private bind(): void {
    this.listening = true;
    this.viewportWidth = this.view.innerWidth;
    this.document.addEventListener('pointerdown', this.onPointerDown, true);
    this.document.addEventListener('pointermove', this.onPointerMove, true);
    this.document.addEventListener('pointerup', this.onPointerUp, true);
    this.document.addEventListener('pointercancel', this.onPointerCancel, true);
    this.document.addEventListener('keydown', this.onKeyDown);
    this.document.addEventListener('close', this.onDialogClose, true);
    this.document.addEventListener('scroll', this.onScroll, true);
    this.view.addEventListener('resize', this.onViewportChange, true);
    this.view.addEventListener('scroll', this.onScroll, true);
    this.view.visualViewport?.addEventListener('resize', this.onViewportChange, true);
    this.view.visualViewport?.addEventListener('scroll', this.onViewportChange, true);
  }

  private unbind(): void {
    if (!this.listening) return;
    this.listening = false;
    this.document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.document.removeEventListener('pointermove', this.onPointerMove, true);
    this.document.removeEventListener('pointerup', this.onPointerUp, true);
    this.document.removeEventListener('pointercancel', this.onPointerCancel, true);
    this.touch = undefined;
    this.document.removeEventListener('keydown', this.onKeyDown);
    this.document.removeEventListener('close', this.onDialogClose, true);
    this.document.removeEventListener('scroll', this.onScroll, true);
    this.view.removeEventListener('resize', this.onViewportChange, true);
    this.view.removeEventListener('scroll', this.onScroll, true);
    this.view.visualViewport?.removeEventListener('resize', this.onViewportChange, true);
    this.view.visualViewport?.removeEventListener('scroll', this.onViewportChange, true);
  }

  private readonly onPointerDown = (event: Event): void => {
    const path =
      typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target as EventTarget];
    const pointer = event as PointerEvent;
    if (pointer.pointerType === 'touch') {
      this.touch = { id: pointer.pointerId, x: pointer.clientX, y: pointer.clientY,
        at: this.view.performance.now(), moved: false, path };
      return;
    }
    this.dismissOutside(path);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const touch = this.touch;
    if (touch && touch.id === event.pointerId &&
      Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= 10) touch.moved = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const touch = this.touch;
    if (!touch || touch.id !== event.pointerId) return;
    this.touch = undefined;
    if (!touch.moved && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 10 && this.view.performance.now() - touch.at <= 500) this.dismissOutside(touch.path);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.touch?.id === event.pointerId) this.touch = undefined;
  };

  private dismissOutside(path: readonly EventTarget[]): void {
    for (const root of [...this.roots]) {
      const deepestInside = this.deepestContaining(root, path);
      if (!deepestInside) {
        this.dismissTree(root, 'outside');
        continue;
      }
      for (const child of [...deepestInside.children]) {
        if (!this.deepestContaining(child, path)) this.dismissTree(child, 'outside');
      }
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return;
    const path =
      typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target as EventTarget];
    const dialog = path.find(
      (target): target is HTMLDialogElement =>
        target instanceof this.view.HTMLDialogElement && target.open,
    );
    const candidates = this.allNodes().filter(
      (node) =>
        !dialog || composedContains(dialog, node.origin) || composedContains(dialog, node.panel),
    );
    const top = candidates.sort((a, b) => b.depth - a.depth || b.order - a.order)[0];
    if (!top) return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissTree(top, 'escape');
  };

  private readonly onDialogClose = (event: Event): void => {
    const dialog = event.target;
    if (!(dialog instanceof this.view.Element) || dialog.tagName !== 'DIALOG') return;
    const owned = this.allNodes()
      .filter(
        (node) => composedContains(dialog, node.origin) || composedContains(dialog, node.panel),
      )
      .sort((a, b) => b.depth - a.depth || b.order - a.order);
    for (const node of owned) node.destroy();
  };

  private readonly onScroll = (event: Event): void => {
    const target = event.target;
    const targetElement = target instanceof this.view.Element ? target : null;
    for (const node of this.allNodes()) {
      const relevant =
        target === this.document ||
        target === this.view ||
        target === this.document.documentElement ||
        (targetElement !== null && composedContains(targetElement, node.origin));
      if (!relevant) continue;
      if (node.scrollStrategy === 'close') this.dismissTree(node, 'scroll');
      else node.schedule();
    }
  };

  private readonly onViewportChange = (): void => {
    const width = this.view.innerWidth;
    const changed = this.viewportWidth !== undefined && width !== this.viewportWidth;
    this.viewportWidth = width;
    for (const node of this.allNodes()) {
      if (changed && node.options.closeOnWidthChange) this.dismissTree(node, 'resize');
      else node.schedule();
    }
  };

  findParent(origin: HTMLElement): PopupNode | undefined {
    return this.allNodes().filter(node => composedContains(node.panel, origin))
      .sort((a, b) => b.depth - a.depth || b.order - a.order)[0];
  }

  private allNodes(): PopupNode[] {
    const nodes: PopupNode[] = [];
    const visit = (node: PopupNode): void => {
      if (!node.active) return;
      nodes.push(node);
      for (const child of node.children) visit(child);
    };
    for (const root of this.roots) visit(root);
    return nodes;
  }

  private deepestContaining(node: PopupNode, path: readonly EventTarget[]): PopupNode | null {
    for (const child of node.children) {
      const deepest = this.deepestContaining(child, path);
      if (deepest) return deepest;
    }
    return pathContains(path, node.origin) || pathContains(path, node.panel) ? node : null;
  }

  dismissTree(node: PopupNode, reason: PopupDismissReason): void {
    for (const child of [...node.children].sort((a, b) => b.order - a.order)) {
      this.dismissTree(child, reason);
    }
    node.dismiss(reason);
  }
}

class PopupNode {
  readonly children = new Set<PopupNode>();
  readonly order = ++nextOrder;
  readonly depth: number;
  active = true;
  private frame: number | null = null;
  private observer?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private readonly originalPosition: InlineProperty;
  private readonly originalInset: InlineProperty;
  private readonly originalMargin: InlineProperty;
  private readonly originalLeft: InlineProperty;
  private readonly originalTop: InlineProperty;

  constructor(
    options: PopupConnectionOptions,
    readonly document: Document,
    readonly view: BrowserWindow,
    readonly coordinator: DismissalCoordinator,
    readonly parent: PopupNode | undefined,
    readonly connection: PopupConnection,
  ) {
    this.options = options;
    this.depth = parent ? parent.depth + 1 : 0;
    this.originalPosition = readInline(options.panel.style, 'position');
    this.originalInset = readInline(options.panel.style, 'inset');
    this.originalMargin = readInline(options.panel.style, 'margin');
    this.originalLeft = readInline(options.panel.style, 'left');
    this.originalTop = readInline(options.panel.style, 'top');
  }

  options: PopupConnectionOptions;

  get origin(): HTMLElement {
    return this.options.origin;
  }

  get panel(): HTMLElement {
    return this.options.panel;
  }

  get scrollStrategy(): PopupScrollStrategy {
    return this.options.scrollStrategy ?? 'reposition';
  }

  start(): void {
    this.coordinator.add(this);
    const ResizeObserverConstructor = this.view.ResizeObserver;
    if (ResizeObserverConstructor) {
      const observer = new ResizeObserverConstructor(() => this.schedule());
      this.observer = observer;
      observer.observe(this.origin);
      observer.observe(this.panel);
      for (
        let ancestor = composedParent(this.origin);
        ancestor;
        ancestor = composedParent(ancestor)
      ) {
        observer.observe(ancestor);
      }
    }
    const MutationObserverConstructor = this.view.MutationObserver;
    if (MutationObserverConstructor) {
      const observer = new MutationObserverConstructor(() => {
        if (!this.origin.isConnected || !this.panel.isConnected) {
          this.coordinator.dismissTree(this, 'anchor-hidden');
        } else {
          this.schedule();
        }
      });
      this.mutationObserver = observer;
      const relevantAncestors = new Set<Element>();
      for (
        let ancestor = composedParent(this.origin);
        ancestor;
        ancestor = composedParent(ancestor)
      ) {
        relevantAncestors.add(ancestor);
      }
      for (
        let ancestor = composedParent(this.panel);
        ancestor;
        ancestor = composedParent(ancestor)
      ) {
        relevantAncestors.add(ancestor);
      }
      const visibilityAttributes = ['class', 'hidden', 'style'];
      observer.observe(this.origin, {
        attributes: true,
        attributeFilter: visibilityAttributes,
      });
      for (const ancestor of relevantAncestors) {
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: visibilityAttributes,
          childList: true,
        });
      }
    }
    this.update();
  }

  schedule(): void {
    if (!this.active || this.frame !== null) return;
    if (typeof this.view.requestAnimationFrame !== 'function') {
      this.update();
      return;
    }
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  update(options?: PopupConnectionUpdate): void {
    if (!this.active) return;
    if (options) this.options = { ...this.options, ...options };
    if (!this.origin.isConnected || !this.panel.isConnected) {
      this.coordinator.dismissTree(this, 'anchor-hidden');
      return;
    }
    const viewport = viewportBounds(this.view);
    if (clippedOrigin(this.origin, viewport)) {
      this.coordinator.dismissTree(this, 'anchor-hidden');
      return;
    }

    const origin = this.origin.getBoundingClientRect();
    const panel = this.panel.getBoundingClientRect();
    const direction = this.view.getComputedStyle(this.origin).direction === 'rtl' ? 'rtl' : 'ltr';
    const position = computePopupPosition({
      origin: { left: origin.left, top: origin.top, width: origin.width, height: origin.height },
      panel: { width: panel.width, height: panel.height },
      viewport,
      direction,
      placement: this.options.placement,
      offset: this.options.offset,
      padding: this.options.padding,
    });
    if (this.options.position) {
      this.options.position(position);
      return;
    }
    this.panel.style.setProperty('position', 'fixed');
    this.panel.style.setProperty('inset', 'auto');
    this.panel.style.setProperty('margin', '0');
    const panelPosition = inFixedContainingBlock(this.panel, this.view, position);
    this.panel.style.setProperty('left', `${panelPosition.left}px`);
    this.panel.style.setProperty('top', `${panelPosition.top}px`);
  }

  dismiss(reason: PopupDismissReason): void {
    if (!this.active) return;
    this.dispose();
    this.options.onDismiss(reason);
  }

  destroy(): void {
    if (!this.active) return;
    for (const child of [...this.children]) child.destroy();
    this.dispose();
  }

  private dispose(): void {
    this.active = false;
    this.coordinator.remove(this);
    this.observer?.disconnect();
    this.observer = undefined;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.options.position) return;
    restoreInline(this.panel.style, 'position', this.originalPosition);
    restoreInline(this.panel.style, 'inset', this.originalInset);
    restoreInline(this.panel.style, 'margin', this.originalMargin);
    restoreInline(this.panel.style, 'left', this.originalLeft);
    restoreInline(this.panel.style, 'top', this.originalTop);
  }
}

/** Connects an already-rendered panel to its origin until dismissed or destroyed. */
export function connectPopup(options: PopupConnectionOptions): PopupConnection {
  const document = options.origin.ownerDocument;
  const view = document.defaultView as BrowserWindow | null;
  if (!view || options.panel.ownerDocument !== document) {
    throw new TypeError('Popup origin and panel must belong to the same active document.');
  }
  if (!options.origin.isConnected || !options.panel.isConnected) {
    throw new TypeError('Popup origin and panel must be connected before creating a connection.');
  }
  if (!options.onDismiss) throw new TypeError('Popup connections require an onDismiss callback.');

  const coordinator = coordinators.get(document) ?? new DismissalCoordinator(document, view);
  const parent = options.parent === 'auto' ? coordinator.findParent(options.origin)
    : options.parent ? connections.get(options.parent) : undefined;
  if (options.parent && options.parent !== 'auto' && (!parent?.active || parent.document !== document)) {
    throw new TypeError('Popup parent must be an active connection in the same document.');
  }

  let node: PopupNode;
  const connection: PopupConnection = {
    update: (updateOptions) => node.update(updateOptions),
    destroy: () => node.destroy(),
  };
  coordinators.set(document, coordinator);
  node = new PopupNode(options, document, view, coordinator, parent, connection);
  connections.set(connection, node);
  node.start();
  return connection;
}
