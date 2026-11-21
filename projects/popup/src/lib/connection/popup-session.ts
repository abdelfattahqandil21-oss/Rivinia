import type {
  PopupConnectionOptions,
  PopupConnectionUpdate,
  PopupDismissReason,
  PopupScrollStrategy,
} from '../contracts/connection.types';
import type { DismissalCoordinator } from '../dismissal/dismissal-coordinator';
import { clippedOrigin } from '../platform/visibility';
import { viewportBounds, type BrowserWindow } from '../platform/viewport';
import { computePopupPosition } from '../positioning/compute-position';
import {
  inFixedContainingBlock,
  readInline,
  restoreInline,
  type InlineProperty,
} from '../positioning/dom-positioning';

import { AutoUpdate } from './auto-update';

let nextOrder = 0;

export class PopupSession {
  readonly children = new Set<PopupSession>();
  readonly order = ++nextOrder;
  readonly depth: number;
  active = true;
  private readonly autoUpdate: AutoUpdate;
  private readonly originalPosition: InlineProperty;
  private readonly originalInset: InlineProperty;
  private readonly originalMargin: InlineProperty;
  private readonly originalLeft: InlineProperty;
  private readonly originalTop: InlineProperty;

  constructor(
    options: PopupConnectionOptions,
    readonly document: Document,
    readonly view: BrowserWindow,
    readonly coordinator: DismissalCoordinator<PopupSession>,
    readonly parent: PopupSession | undefined,
  ) {
    this.options = options;
    this.autoUpdate = new AutoUpdate(
      view,
      options.origin,
      options.panel,
      () => this.update(),
      () => this.coordinator.dismissTree(this, 'anchor-hidden'),
    );
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
    this.autoUpdate.start();
    this.update();
  }

  schedule(): void {
    if (this.active) this.autoUpdate.schedule();
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
    this.autoUpdate.stop();
    if (this.options.position) return;
    restoreInline(this.panel.style, 'position', this.originalPosition);
    restoreInline(this.panel.style, 'inset', this.originalInset);
    restoreInline(this.panel.style, 'margin', this.originalMargin);
    restoreInline(this.panel.style, 'left', this.originalLeft);
    restoreInline(this.panel.style, 'top', this.originalTop);
  }
}
