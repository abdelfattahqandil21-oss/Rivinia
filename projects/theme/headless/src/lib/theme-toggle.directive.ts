import { computed, Directive, inject, input } from '@angular/core';
import { RiviniaThemeController } from './theme-controller';
import { RiviniaThemeMode, isRiviniaThemeMode } from '../contracts/theme-mode.types';
import {
  DEFAULT_RIVINIA_THEME_TOGGLE_DIRECTIVE_LABELS,
  RiviniaThemeToggleDirectiveLabels,
} from '../contracts/theme-toggle-labels.types';

const DEFAULT_CYCLE: readonly RiviniaThemeMode[] = Object.freeze(['light', 'dark']);

function normalizeCycle(value: readonly unknown[] | string | boolean): readonly RiviniaThemeMode[] {
  if (value === '' || value === true) return DEFAULT_CYCLE;
  if (!Array.isArray(value)) return [];

  const seen = new Set<RiviniaThemeMode>();
  const cycle: RiviniaThemeMode[] = [];
  for (const candidate of value) {
    if (isRiviniaThemeMode(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      cycle.push(candidate);
    }
  }
  return cycle;
}

/** Adds a configurable mode cycle to a native button without imposing visual styles. */
@Directive({
  selector: 'button[rvThemeToggle]',
  standalone: true,
  host: {
    '(click)': 'onClick()',
    '[attr.aria-label]': 'accessibleLabel()',
  },
})
export class RiviniaThemeToggleDirective {
  readonly #controller = inject(RiviniaThemeController);
  readonly cycle = input(DEFAULT_CYCLE, {
    alias: 'rvThemeToggle',
    transform: normalizeCycle,
  });
  readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });
  readonly labels = input<RiviniaThemeToggleDirectiveLabels>(
    DEFAULT_RIVINIA_THEME_TOGGLE_DIRECTIVE_LABELS,
    { alias: 'rvThemeToggleLabels' },
  );
  readonly accessibleLabel = computed(() => {
    const supplied = this.ariaLabel();
    if (supplied?.trim()) return supplied;

    const current = this.#controller.mode();
    const next = this.#nextMode();
    const labels = this.labels();
    return next
      ? `${labels.currentMode}: ${labels.modes[current]}. ${labels.switchTo} ${labels.modes[next]}.`
      : `${labels.currentMode}: ${labels.modes[current]}. ${labels.noModesAvailable}`;
  });

  onClick(): void {
    const next = this.#nextMode();
    if (next) this.#controller.setMode(next);
  }

  #nextMode(): RiviniaThemeMode | null {
    const cycle = this.cycle();
    if (cycle.length === 0) return null;
    const currentIndex = cycle.indexOf(this.#controller.mode());
    return cycle[(currentIndex + 1) % cycle.length] ?? cycle[0] ?? null;
  }
}
