import type { PopupDismissReason } from '../contracts/connection.types';
import type { PopupParticipant } from '../contracts/popup-participant';
import { composedContains, pathContains } from '../platform/composed-dom';
import type { BrowserWindow } from '../platform/viewport';

export class DismissalCoordinator<T extends PopupParticipant<T>> {
  readonly roots = new Set<T>();
  private listening = false;
  private viewportWidth: number | undefined;
  private touch:
    | { id: number; x: number; y: number; at: number; moved: boolean; path: readonly EventTarget[] }
    | undefined;

  constructor(
    private readonly document: Document,
    private readonly view: BrowserWindow,
  ) {}

  add(node: T): void {
    if (node.parent) node.parent.children.add(node);
    else this.roots.add(node);
    if (!this.listening) this.bind();
  }

  remove(node: T): void {
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
      this.touch = {
        id: pointer.pointerId,
        x: pointer.clientX,
        y: pointer.clientY,
        at: this.view.performance.now(),
        moved: false,
        path,
      };
      return;
    }
    this.dismissOutside(path);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const touch = this.touch;
    if (
      touch &&
      touch.id === event.pointerId &&
      Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= 10
    )
      touch.moved = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const touch = this.touch;
    if (!touch || touch.id !== event.pointerId) return;
    this.touch = undefined;
    if (
      !touch.moved &&
      Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 10 &&
      this.view.performance.now() - touch.at <= 500
    )
      this.dismissOutside(touch.path);
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

  findParent(origin: HTMLElement): T | undefined {
    return this.allNodes()
      .filter((node) => composedContains(node.panel, origin))
      .sort((a, b) => b.depth - a.depth || b.order - a.order)[0];
  }

  private allNodes(): T[] {
    const nodes: T[] = [];
    const visit = (node: T): void => {
      if (!node.active) return;
      nodes.push(node);
      for (const child of node.children) visit(child);
    };
    for (const root of this.roots) visit(root);
    return nodes;
  }

  private deepestContaining(node: T, path: readonly EventTarget[]): T | null {
    for (const child of node.children) {
      const deepest = this.deepestContaining(child, path);
      if (deepest) return deepest;
    }
    return pathContains(path, node.origin) || pathContains(path, node.panel) ? node : null;
  }

  dismissTree(node: T, reason: PopupDismissReason): void {
    for (const child of [...node.children].sort((a, b) => b.order - a.order)) {
      this.dismissTree(child, reason);
    }
    node.dismiss(reason);
  }
}
