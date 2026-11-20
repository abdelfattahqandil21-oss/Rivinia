import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RiviniaTimepickerComponent } from '../ui/src/public-api';

describe('rv-timepicker confirmation', () => {
  const initial = { hour: 9, minute: 30, second: 0 };

  function mount() {
    const fixture = TestBed.createComponent(RiviniaTimepickerComponent);
    fixture.componentRef.setInput('value', initial);
    fixture.componentRef.setInput('clearable', true);
    fixture.detectChanges();
    return fixture;
  }

  it('stages null, cancels it, and commits it only on Apply', () => {
    const picker = mount().componentInstance;
    const values: unknown[] = [];
    picker.value.subscribe((value) => values.push(value));
    picker.open();
    picker.clear();
    expect(picker.value()).toEqual(initial);
    picker.cancel();
    expect(values).toEqual([]);
    picker.open();
    picker.clear();
    expect(picker.apply()).toBe(true);
    expect(values).toEqual([null]);
  });

  it('reports unchanged Apply once without emitting a value change', () => {
    const picker = mount().componentInstance;
    const events: unknown[] = [];
    picker.applied.subscribe((event) => events.push(event));
    picker.value.subscribe((value) => events.push(value));
    picker.open();
    expect(picker.apply()).toBe(true);
    expect(picker.apply()).toBe(false);
    expect(events).toEqual([{ value: initial, changed: false }]);
  });

  it('rebases a clear when the parent replaces the value and blocks a disabled commit', () => {
    const fixture = mount();
    const picker = fixture.componentInstance;
    const replacement = { hour: 11, minute: 0, second: 0 };
    picker.open();
    picker.clear();
    fixture.componentRef.setInput('value', replacement);
    expect(picker.apply()).toBe(true);
    expect(picker.value()).toEqual(replacement);
    picker.open();
    picker.clear();
    fixture.componentRef.setInput('disabled', true);
    expect(picker.apply()).toBe(false);
    expect(picker.value()).toEqual(replacement);
  });
});
