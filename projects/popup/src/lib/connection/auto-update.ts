import { composedParent } from '../platform/composed-dom';
import type { BrowserWindow } from '../platform/viewport';

export class AutoUpdate {
  private frame: number | null = null;
  private observer?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(
    private readonly view: BrowserWindow,
    private readonly origin: HTMLElement,
    private readonly panel: HTMLElement,
    private readonly update: () => void,
    private readonly onDetach: () => void,
  ) {}

  start(): void {
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
          this.onDetach();
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
  }

  schedule(): void {
    if (this.frame !== null) return;
    if (typeof this.view.requestAnimationFrame !== 'function') {
      this.update();
      return;
    }
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
