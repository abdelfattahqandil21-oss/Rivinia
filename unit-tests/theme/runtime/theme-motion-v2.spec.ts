import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiviniaThemeTransitionService } from '../../../projects/theme/motion/src/public-api';

const property = '--rv-theme-transition-x';
function createHarness({
  reduced = false,
  start,
}: {
  reduced?: boolean;
  start?: (update: () => void) => { updateCallbackDone: Promise<void>; finished: Promise<void> };
} = {}) {
  const root = document.createElement('div');
  const view = {
    innerWidth: 400,
    innerHeight: 300,
    matchMedia: vi.fn(() => ({ matches: reduced })),
  };
  const startViewTransition = vi.fn(start ?? ((update: () => void) => {
    update();
    return { updateCallbackDone: Promise.resolve(), finished: Promise.resolve() };
  }));
  const fake = {
    defaultView: view,
    documentElement: root,
    visibilityState: 'visible',
    startViewTransition,
  };
  TestBed.configureTestingModule({ providers: [
    { provide: DOCUMENT, useValue: fake },
    RiviniaThemeTransitionService,
  ] });
  return { service: TestBed.inject(RiviniaThemeTransitionService), root, startViewTransition };
}

beforeEach(() => {
  TestBed.resetTestingModule();
});

describe('Theme V2 Motion — lifecycle and reduced motion', () => {
  it('updates synchronously without invoking View Transitions under reduced motion', async () => {
    const { service, root, startViewTransition } = createHarness({ reduced: true });
    const update = vi.fn();
    await service.run(null, update, { duration: 200 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(root.getAttribute('data-rv-theme-transition')).toBeNull();
  });

  it('restores pre-existing inline styles and transition marker after completion', async () => {
    const { service, root, startViewTransition } = createHarness();
    root.style.setProperty(property, '15px', 'important');
    root.setAttribute('data-rv-theme-transition', 'prior');
    const update = vi.fn();
    await service.run(null, update, {
      point: { x: 120, y: 70 },
      duration: 120,
      easing: 'linear',
      direction: 'collapse',
    });
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(root.getAttribute('data-rv-theme-transition')).toBe('prior');
    expect(root.style.getPropertyValue(property)).toBe('15px');
    expect(root.style.getPropertyPriority(property)).toBe('important');
    expect(root.style.getPropertyValue('--rv-theme-transition-duration')).toBe('');
  });

  it('uses a synchronous fallback if browser View Transitions are unavailable', async () => {
    const { service, startViewTransition } = createHarness({ reduced: false });
    // Force the API-missing branch (the fake document is provider-owned).
    const doc = TestBed.inject(DOCUMENT) as Document & { startViewTransition?: unknown };
    Object.defineProperty(doc, 'startViewTransition', { value: undefined, configurable: true });
    const update = vi.fn();
    await service.run(null, update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('does not start overlapping animations while an earlier one is running', async () => {
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => { complete = resolve; });
    const { service, root, startViewTransition } = createHarness({
      start: (update) => {
        update();
        return { updateCallbackDone: Promise.resolve(), finished };
      },
    });
    const first = vi.fn();
    const second = vi.fn();
    const running = service.run(null, first);
    await service.run(null, second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    complete();
    await running;
    expect(root.getAttribute('data-rv-theme-transition')).toBeNull();
  });

  // C7 regression: view-transition callbacks can be scheduled asynchronously.
  // While the first transition is pending, a later theme request must not be
  // overwritten by a stale callback from that earlier request.
  it('keeps the latest requested mode when an older transition update is delayed', async () => {
    let commitFirst!: () => void;
    let resolveFirst!: () => void;
    const firstUpdated = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const { service, startViewTransition } = createHarness({
      start: (update) => {
        commitFirst = () => {
          update();
          resolveFirst();
        };
        return { updateCallbackDone: firstUpdated, finished: Promise.resolve() };
      },
    });

    let appearance = 'light';
    const firstUpdate = vi.fn(() => { appearance = 'dark'; });
    const latestUpdate = vi.fn(() => { appearance = 'light'; });
    const pending = service.run(null, firstUpdate);
    // This update takes the running-transition fallback, executing immediately.
    await service.run(null, latestUpdate);
    expect(appearance).toBe('light');
    expect(startViewTransition).toHaveBeenCalledTimes(1);

    // The browser finally invokes the *older* transition callback.
    commitFirst();
    await pending;
    expect(firstUpdate).toHaveBeenCalledTimes(1);
    expect(latestUpdate).toHaveBeenCalledTimes(1);
    expect(appearance).toBe('light');
  });

});
