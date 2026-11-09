import { DestroyRef, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindPopupDismissal, computePopupPosition } from './popup-core';

describe('computePopupPosition', () => {
  const viewport = { width: 1280, height: 900 };
  const panel = { width: 256, height: 300 };

  it('aligns logical start/end using the explicit direction input', () => {
    const trigger = { left: 300, top: 100, width: 120, height: 40 };
    expect(computePopupPosition(trigger, panel, 'bottom-start', viewport, 'ltr')).toEqual({
      left: 300,
      top: 146,
      flipped: false,
    });
    expect(computePopupPosition(trigger, panel, 'bottom-start', viewport, 'rtl').left).toBe(164);
    expect(computePopupPosition(trigger, panel, 'bottom-end', viewport, 'rtl').left).toBe(300);
  });

  it('flips vertically when the preferred side overflows and the opposite side fits', () => {
    expect(
      computePopupPosition(
        { left: 100, top: 700, width: 120, height: 40 },
        panel,
        'bottom-start',
        viewport,
        'ltr',
      ),
    ).toEqual({ left: 100, top: 394, flipped: true });
  });

  it('clamps oversized panels within the viewport inset', () => {
    const result = computePopupPosition(
      { left: 2, top: 2, width: 30, height: 20 },
      { width: 400, height: 500 },
      'top-start',
      { width: 300, height: 400 },
      'ltr',
    );
    expect(result.left).toBe(8);
    expect(result.top).toBe(8);
  });
});

describe('bindPopupDismissal', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  let originalWidthDescriptor: PropertyDescriptor | undefined;

  function makeFrameEvent(type: string, init: Record<string, unknown> = {}): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(init)) {
      Object.defineProperty(event, key, { configurable: true, value });
    }
    return event;
  }

  function installFrameQueue(): void {
    frames.clear();
    nextFrame = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
  }

  function flushFrames(): void {
    const queued = [...frames.entries()];
    frames.clear();
    for (const [id, callback] of queued) callback(id * 16);
  }

  function bind(overrides: Record<string, unknown> = {}) {
    const host = document.createElement('div');
    const panel = document.createElement('div');
    const outside = document.createElement('button');
    const container = document.createElement('section');
    host.append(panel);
    container.append(host, outside);
    document.body.append(container);
    const dismiss = vi.fn();
    let cleanup!: () => void;
    const destroyRef = { onDestroy(callback: () => void) { cleanup = callback; } } as DestroyRef;
    const triggerRect = { value: new DOMRect(20, 20, 80, 30) };
    bindPopupDismissal(
      {
        document,
        window,
        host: () => host,
        panel: () => panel,
        editableFocusInsidePanel: () => false,
        dismiss,
        triggerRect: () => triggerRect.value,
        reposition: vi.fn(),
        ...overrides,
      } as Parameters<typeof bindPopupDismissal>[0],
      destroyRef,
    );
    return { host, panel, outside, container, dismiss, cleanup, triggerRect };
  }

  beforeEach(() => {
    installFrameQueue();
    originalWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  });

  afterEach(() => {
    document.body.querySelectorAll('section').forEach((container) => container.remove());
    if (originalWidthDescriptor) {
      Object.defineProperty(window, 'innerWidth', originalWidthDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('keeps legacy consumers on close-on-scroll when both anchor callbacks are omitted', () => {
    const { dismiss, cleanup } = bind({ reposition: undefined, triggerRect: undefined });
    window.dispatchEvent(new Event('scroll'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('coalesces outside scrolls into one reposition and stays open while the trigger is visible', () => {
    const reposition = vi.fn();
    const { dismiss, cleanup } = bind({ reposition });
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    flushFrames();
    expect(reposition).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
    cleanup();
  });

  it('dismisses after reposition only when the trigger is wholly outside the viewport', () => {
    const reposition = vi.fn();
    const { dismiss, cleanup, triggerRect } = bind({ reposition });
    triggerRect.value = new DOMRect(20, -40, 80, 30);
    window.dispatchEvent(new Event('scroll'));
    flushFrames();
    expect(reposition).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
    cleanup();
  });

  it('repositions on height-only resize but closes on a width change', () => {
    const reposition = vi.fn();
    const { dismiss, cleanup } = bind({ reposition });
    window.dispatchEvent(new Event('resize'));
    flushFrames();
    expect(reposition).toHaveBeenCalledOnce();
    expect(dismiss).not.toHaveBeenCalled();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: window.innerWidth + 1,
    });
    window.dispatchEvent(new Event('resize'));
    expect(dismiss).toHaveBeenCalledOnce();
    cleanup();
  });

  it('does not close on touch down, drag, or cancellation, and closes on a short outside tap', () => {
    const { dismiss, outside, cleanup } = bind();
    outside.dispatchEvent(makeFrameEvent('pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    }));
    expect(dismiss).not.toHaveBeenCalled();
    outside.dispatchEvent(makeFrameEvent('pointermove', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 40,
      clientY: 20,
    }));
    outside.dispatchEvent(makeFrameEvent('pointerup', { pointerId: 7, pointerType: 'touch' }));
    expect(dismiss).not.toHaveBeenCalled();

    outside.dispatchEvent(makeFrameEvent('pointerdown', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    }));
    outside.dispatchEvent(makeFrameEvent('pointercancel', { pointerId: 8, pointerType: 'touch' }));
    expect(dismiss).not.toHaveBeenCalled();

    outside.dispatchEvent(makeFrameEvent('pointerdown', {
      pointerId: 9,
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    }));
    expect(dismiss).not.toHaveBeenCalled();
    outside.dispatchEvent(makeFrameEvent('pointerup', { pointerId: 9, pointerType: 'touch' }));
    expect(dismiss).toHaveBeenCalledOnce();
    cleanup();
  });

  it.each(['mouse', 'pen'])('closes immediately for outside %s pointerdown', (pointerType) => {
    const { dismiss, outside, cleanup } = bind();
    outside.dispatchEvent(makeFrameEvent('pointerdown', { pointerType }));
    expect(dismiss).toHaveBeenCalledOnce();
    cleanup();
  });

  it('cancels a pending animation frame and releases listeners when closed', () => {
    const reposition = vi.fn();
    const { dismiss, cleanup } = bind({ reposition });
    window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    cleanup();
    expect(frames.size).toBe(0);
    flushFrames();
    expect(reposition).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('scroll'));
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('is a no-op for a null server browser context', () => {
    const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
    runInInjectionContext(TestBed.inject(EnvironmentInjector), () => {
      bindPopupDismissal({
        document: null,
        window: null,
        host: () => null,
        panel: () => null,
        editableFocusInsidePanel: () => false,
        dismiss: vi.fn(),
      }, destroyRef);
    });
    expect(destroyRef.onDestroy).not.toHaveBeenCalled();
  });
});
