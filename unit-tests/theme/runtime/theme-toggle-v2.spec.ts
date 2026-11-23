import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RiviniaThemeController,
  type RiviniaThemeMode,
} from '../../../projects/theme/headless/src/public-api';
import { RiviniaThemeTransitionService } from '../../../projects/theme/motion/src/public-api';
import { RiviniaThemeToggleComponent } from '../../../projects/theme/toggle/src/public-api';

class FakeController {
  readonly mode = signal<RiviniaThemeMode>('light');
  readonly resolvedMode = computed(() => this.mode() === 'system' ? 'light' : this.mode());
  readonly setMode = vi.fn((mode: RiviniaThemeMode) => this.mode.set(mode));
  toggle(): void { this.setMode(this.mode() === 'light' ? 'dark' : 'light'); }
}

@Component({
  imports: [RiviniaThemeToggleComponent],
  template: `<rv-theme-toggle presentation="single" [modes]="['light', 'dark']" />`,
})
class SingleHost {}

@Component({
  imports: [RiviniaThemeToggleComponent],
  template: `<div dir="rtl"><rv-theme-toggle presentation="segmented" /></div>`,
})
class RtlHost {}

let controller: FakeController;
let motion: { run: ReturnType<typeof vi.fn> };

beforeEach(() => {
  TestBed.resetTestingModule();
  controller = new FakeController();
  motion = { run: vi.fn((_origin: HTMLElement | null, update: () => void) => {
    update();
    return Promise.resolve();
  }) };
  TestBed.configureTestingModule({
    providers: [
      { provide: RiviniaThemeController, useValue: controller },
      { provide: RiviniaThemeTransitionService, useValue: motion },
    ],
  });
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('Theme V2 Toggle — native interactions without implicit motion', () => {
  it('single button switches mode without invoking animation when no origin is supplied', () => {
    const fixture = TestBed.createComponent(SingleHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toContain('Dark');
    button.click();
    fixture.detectChanges();
    expect(controller.mode()).toBe('dark');
    expect(button.getAttribute('aria-label')).toContain('Light');
    expect(motion.run).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('segmented variant has a native radiogroup and one tab stop', () => {
    const fixture = TestBed.createComponent(RtlHost);
    fixture.detectChanges();
    const group = fixture.nativeElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[1].click();
    fixture.detectChanges();
    expect(controller.mode()).toBe('dark');
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fixture.destroy();
  });

  it('ArrowRight moves backward in RTL, and Home/End navigate correctly', () => {
    const fixture = TestBed.createComponent(RtlHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const radios = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    radios[1].click();
    fixture.detectChanges();
    radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(controller.mode()).toBe('light');
    expect(document.activeElement === radios[0] || radios[0].tabIndex === 0).toBe(true);
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(controller.mode()).toBe('system');
    expect(motion.run).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
