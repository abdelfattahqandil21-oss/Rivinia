import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expect, it } from 'vitest';
import { RiviniaRangeComponent } from '../src/public-api';

@Component({
  imports: [ReactiveFormsModule, RiviniaRangeComponent],
  template: `
    <rv-range id="volume" label="Volume" [formControl]="volume"
      [min]="0" [max]="100" [step]="5" [valueText]="volume.value + '%'" />
  `,
})
class Host {
  readonly volume = new FormControl(25, { nonNullable: true });
}

it('preserves the native slider and updates Angular Forms with a number', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const slider = root.querySelector<HTMLInputElement>('input#volume')!;
  expect(root.querySelectorAll('#volume')).toHaveLength(1);
  expect(slider.type).toBe('range');
  expect(slider.step).toBe('5');
  expect(slider.getAttribute('aria-valuetext')).toBe('25%');
  slider.value = '30';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
  expect(fixture.componentInstance.volume.value).toBe(30);
  expect(slider.getAttribute('aria-valuetext')).toBe('30%');
  fixture.componentInstance.volume.disable();
  fixture.detectChanges();
  expect(slider.disabled).toBe(true);
});
