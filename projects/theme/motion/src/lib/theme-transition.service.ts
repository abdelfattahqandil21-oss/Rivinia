import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import {
  RiviniaThemeTransitionCorner,
  RiviniaThemeTransitionOptions,
  RiviniaThemeTransitionPoint,
} from '../contracts/theme-transition.types';

const DIRECTION_ATTRIBUTE = 'data-rv-theme-transition';
const ROOT_PROPERTIES = [
  '--rv-theme-transition-x',
  '--rv-theme-transition-y',
  '--rv-theme-transition-radius',
  '--rv-theme-transition-duration',
  '--rv-theme-transition-easing',
] as const;

interface InlineStyleValue {
  readonly value: string;
  readonly priority: string;
}

interface TransitionState {
  readonly direction: string | null;
  readonly properties: ReadonlyMap<string, InlineStyleValue>;
}

/** Runs a consumer-owned DOM update inside the browser's View Transition lifecycle. */
@Service()
export class RiviniaThemeTransitionService {
  readonly #document = inject(DOCUMENT);
  #running = false;
  // The browser may defer its snapshot update callback. Flush a pending, older
  // change before applying a newer request, so the latest request wins.
  #pendingUpdate: (() => void) | null = null;

  run(
    origin: HTMLElement | null,
    update: () => void,
    options: RiviniaThemeTransitionOptions = {},
  ): Promise<void> {
    const view = this.#document.defaultView;
    const transitionDocument = this.#document;
    const root = this.#document.documentElement;

    // If a View Transition has not yet invoked its update callback, finish
    // that older update first. Its eventual browser callback will be a no-op.
    // Avoids a stale callback undoing the latest consumer update.
    if (this.#running && this.#pendingUpdate) {
      this.#pendingUpdate();
    }

    if (
      this.#running ||
      !view ||
      typeof transitionDocument.startViewTransition !== 'function' ||
      transitionDocument.activeViewTransition ||
      this.#document.visibilityState === 'hidden' ||
      this.#prefersReducedMotion(view)
    ) {
      update();
      return Promise.resolve();
    }

    const state = this.#readState(root);
    let applied = false;
    const applyUpdate = (): void => {
      if (applied) return;
      applied = true;
      if (this.#pendingUpdate === applyUpdate) this.#pendingUpdate = null;
      update();
    };
    const cleanup = (): void => {
      if (this.#pendingUpdate === applyUpdate) this.#pendingUpdate = null;
      this.#restoreState(root, state);
      this.#running = false;
    };

    try {
      const { point, radius } = this.#resolveGeometry(origin, options, view.innerWidth, view.innerHeight);
      root.style.setProperty(ROOT_PROPERTIES[0], `${point.x}px`);
      root.style.setProperty(ROOT_PROPERTIES[1], `${point.y}px`);
      root.style.setProperty(ROOT_PROPERTIES[2], `${radius}px`);
      root.style.setProperty(ROOT_PROPERTIES[3], `${this.#duration(options.duration)}ms`);
      root.style.setProperty(ROOT_PROPERTIES[4], options.easing?.trim() || 'ease-out');
      root.setAttribute(DIRECTION_ATTRIBUTE, options.direction ?? 'expand');
      this.#running = true;
      this.#pendingUpdate = applyUpdate;

      const transition = transitionDocument.startViewTransition(applyUpdate);
      return transition.updateCallbackDone.then(
        () => transition.finished.then(cleanup, cleanup),
        (error: unknown) => {
          cleanup();
          if (!applied) {
            applyUpdate();
            return;
          }
          throw error;
        },
      );
    } catch (error) {
      cleanup();
      if (!applied) {
        applyUpdate();
        return Promise.resolve();
      }
      return Promise.reject(error);
    }
  }

  #prefersReducedMotion(view: Window): boolean {
    try {
      return view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      return true;
    }
  }

  #duration(value: number | undefined): number {
    return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 420;
  }

  #resolveGeometry(
    origin: HTMLElement | null,
    options: RiviniaThemeTransitionOptions,
    width: number,
    height: number,
  ): { point: RiviniaThemeTransitionPoint; radius: number } {
    const bounds = origin?.isConnected ? origin.getBoundingClientRect() : null;
    const point = options.point ?? this.#originPoint(bounds, options.corner, width, height);
    const x = Math.min(Math.max(point.x, 0), width);
    const y = Math.min(Math.max(point.y, 0), height);
    const radius = Math.ceil(
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y),
      ),
    );
    return { point: { x, y }, radius };
  }

  #originPoint(
    bounds: DOMRect | null,
    corner: RiviniaThemeTransitionCorner | undefined,
    width: number,
    height: number,
  ): RiviniaThemeTransitionPoint {
    if (bounds) return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    if (!corner) return { x: width / 2, y: height / 2 };
    return {
      x: corner.endsWith('right') ? width : 0,
      y: corner.startsWith('bottom') ? height : 0,
    };
  }

  #readState(root: HTMLElement): TransitionState {
    return {
      direction: root.getAttribute(DIRECTION_ATTRIBUTE),
      properties: new Map(
        ROOT_PROPERTIES.map((property) => [
          property,
          {
            value: root.style.getPropertyValue(property),
            priority: root.style.getPropertyPriority(property),
          },
        ]),
      ),
    };
  }

  #restoreState(root: HTMLElement, state: TransitionState): void {
    if (state.direction === null) root.removeAttribute(DIRECTION_ATTRIBUTE);
    else root.setAttribute(DIRECTION_ATTRIBUTE, state.direction);
    for (const property of ROOT_PROPERTIES) {
      const original = state.properties.get(property);
      if (original?.value) root.style.setProperty(property, original.value, original.priority);
      else root.style.removeProperty(property);
    }
  }
}
