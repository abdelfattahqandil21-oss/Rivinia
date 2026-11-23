import { Component, inject, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  provideRiviniaTheme,
  RiviniaThemeController,
  type RiviniaThemeMode,
} from '../../../projects/theme/headless/src/public-api';

@Component({ template: '<span data-testid="theme-c4-probe">ready</span>' })
class BrowserHost {
  readonly controller = inject(RiviniaThemeController);
}

const key = 'rv-theme-c4-runtime';

beforeEach(() => {
  TestBed.resetTestingModule();
  document.documentElement.removeAttribute('data-rv-theme');
  window.localStorage.removeItem(key);
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-rv-theme');
  window.localStorage.removeItem(key);
});

describe('Theme V2 headless controller — runtime contracts', () => {
  it('does not access browser DOM on the server but keeps valid signal state', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }, RiviniaThemeController],
    });
    const controller = TestBed.inject(RiviniaThemeController);
    expect(controller.mode()).toBe('light');
    controller.setMode('dark');
    expect(controller.resolvedMode()).toBe('dark');
    controller.toggle();
    expect(controller.mode()).toBe('light');
    expect(document.documentElement.hasAttribute('data-rv-theme')).toBe(false);
    controller.setMode('sepia' as RiviniaThemeMode);
    expect(controller.mode()).toBe('light');
  });

  it('restores a stored mode only after the browser render cycle', async () => {
    window.localStorage.setItem(key, 'dark');
    TestBed.configureTestingModule({
      providers: [provideRiviniaTheme({ persist: true, storageKey: key })],
    });
    const fixture = TestBed.createComponent(BrowserHost);
    expect(fixture.componentInstance.controller.mode()).toBe('light');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.controller.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-rv-theme')).toBe('dark');
    fixture.componentInstance.controller.setMode('light');
    expect(window.localStorage.getItem(key)).toBe('light');
    fixture.destroy();
  });

  it('reacts to OS preference changes and cleans up when the root injector is destroyed', async () => {
    const on = vi.fn();
    const off = vi.fn();
    const media = { matches: true, addEventListener: on, removeEventListener: off };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    TestBed.configureTestingModule({ providers: [provideRiviniaTheme()] });
    const fixture = TestBed.createComponent(BrowserHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const controller = fixture.componentInstance.controller;
    controller.setMode('system');
    expect(controller.resolvedMode()).toBe('dark');
    expect(on).toHaveBeenCalledWith('change', expect.any(Function));
    const handler = on.mock.calls.find(([event]) => event === 'change')?.[1];
    expect(handler).toBeTypeOf('function');
    handler({ matches: false });
    expect(controller.resolvedMode()).toBe('light');
    fixture.destroy();
    // The controller is root-provided; destroying this component does not destroy its injector.
    expect(off).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    expect(off).toHaveBeenCalledWith('change', handler);
  });
});
