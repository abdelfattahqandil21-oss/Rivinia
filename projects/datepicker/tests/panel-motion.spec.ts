// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { panelViewportShift } from '../ui/src/lib/utils/panel-motion';

const trigger = document.createElement('button');

function panelAt(top: number, height: number, appliedShift = 0): HTMLElement {
  const panel = document.createElement('div');
  panel.style.setProperty('--rv-datepicker-panel-shift', `${appliedShift}px`);

  panel.getBoundingClientRect = () => ({
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 308,
    width: 308,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

  return panel;
}

describe('panelViewportShift', () => {
  it('preserves a panel already inside the viewport', () => {
    expect(panelViewportShift(panelAt(80, 200), trigger, 568)).toBe(0);
  });

  it('clamps the bottom edge after anchor positioning', () => {
    expect(panelViewportShift(panelAt(30, 404), trigger, 420)).toBe(-22);
  });

  it('moves an already-flipped panel down when above the viewport', () => {
    expect(panelViewportShift(panelAt(-208, 404), trigger, 420)).toBe(216);
  });

  it('does not accumulate shifts across repeated measurements', () => {
    expect(panelViewportShift(panelAt(8, 404, -22), trigger, 420)).toBe(-22);
  });

  it('handles taller datetime panels after CSS height constraints', () => {
    expect(panelViewportShift(panelAt(30, 464), trigger, 480)).toBe(-22);
  });

  it('does nothing without measurable browser geometry', () => {
    expect(panelViewportShift(panelAt(0, 0), trigger, 420)).toBe(0);
    expect(panelViewportShift(panelAt(30, 404), null, 420)).toBe(0);
    expect(panelViewportShift(panelAt(30, 404), trigger, 0)).toBe(0);
  });
});
