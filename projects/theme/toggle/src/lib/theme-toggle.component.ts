import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChildren, inject, input, PLATFORM_ID } from '@angular/core';
import {
  RiviniaThemeController,
  RiviniaThemeMode,
  RIVINIA_THEME_MODES,
} from '@rivinia/theme/headless';
import {
  RiviniaThemeTransitionService,
  type RiviniaThemeTransitionCorner,
} from '@rivinia/theme/motion';
import {
  DEFAULT_RIVINIA_THEME_TOGGLE_LABELS,
  RiviniaThemeToggleLabels,
} from '../contracts/theme-toggle-labels.types';
import {
  normalizeRiviniaThemeToggleModes,
  RiviniaThemeTogglePresentation,
  RiviniaThemeToggleShape,
  RiviniaThemeToggleSize,
  RiviniaThemeToggleVariant,
} from '../contracts/theme-toggle.types';
import { RiviniaThemeIconTemplateDirective } from './theme-icon-template.directive';
import type { RiviniaThemeTransitionOrigin } from '../contracts/theme-transition.types';

@Component({
  selector: 'rv-theme-toggle',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
  host: {
    '[attr.data-presentation]': 'presentation()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-shape]': 'shape()',
    '[attr.data-size]': 'size()',
    '[attr.data-rv-resolved-mode]': 'controller.resolvedMode()',
  },
})
export class RiviniaThemeToggleComponent {
  readonly controller = inject(RiviniaThemeController);
  readonly #document = inject(DOCUMENT);
  readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #transition = inject(RiviniaThemeTransitionService);
  readonly iconTemplates = contentChildren(RiviniaThemeIconTemplateDirective, {
    descendants: true,
  });
  readonly #iconsByMode = computed(
    () => new Map(this.iconTemplates().map((icon) => [icon.mode(), icon.template])),
  );

  readonly presentation = input<RiviniaThemeTogglePresentation>('segmented');
  readonly variant = input<RiviniaThemeToggleVariant>('solid');
  readonly shape = input<RiviniaThemeToggleShape>('pill');
  readonly size = input<RiviniaThemeToggleSize>('md');
  readonly modes = input<readonly RiviniaThemeMode[], readonly unknown[]>(RIVINIA_THEME_MODES, {
    transform: normalizeRiviniaThemeToggleModes,
  });
  readonly labels = input<RiviniaThemeToggleLabels>(DEFAULT_RIVINIA_THEME_TOGGLE_LABELS);
  readonly transitionOrigin = input<RiviniaThemeTransitionOrigin | null>(null);
  readonly transitionCorner = input<RiviniaThemeTransitionCorner>('top-left');
  readonly transitionDuration = input(420);
  readonly transitionEasing = input('ease-out');

  readonly availableModes = computed(() => this.modes());
  readonly nextMode = computed<RiviniaThemeMode | null>(() => {
    const modes = this.availableModes();
    if (modes.length === 0) return null;
    const currentIndex = modes.indexOf(this.controller.mode());
    return modes[(currentIndex + 1) % modes.length] ?? modes[0] ?? null;
  });
  readonly radioTabStop = computed<RiviniaThemeMode | null>(() => {
    const modes = this.availableModes();
    const current = this.controller.mode();
    return modes.includes(current) ? current : (modes[0] ?? null);
  });
  readonly singleAccessibleLabel = computed(() => {
    const labels = this.labels();
    const current = this.controller.mode();
    const next = this.nextMode();
    return next
      ? `${labels.currentMode}: ${labels[current]}. ${labels.switchTo} ${labels[next]}.`
      : `${labels.currentMode}: ${labels[current]}. ${labels.noModesAvailable}`;
  });

  iconTemplate(mode: RiviniaThemeMode) {
    return this.#iconsByMode().get(mode);
  }

  selectMode(mode: RiviniaThemeMode, event: Event): void {
    this.#setMode(mode, event);
  }

  advance(event: Event): void {
    const next = this.nextMode();
    if (next) this.#setMode(next, event);
  }

  onRadioKeydown(event: KeyboardEvent): void {
    if (!(event.target instanceof HTMLElement)) return;

    const group = event.currentTarget as HTMLElement;
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-rv-mode]'));
    const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0 || buttons.length === 0) return;

    const view = this.#document.defaultView;
    const explicitDirection = group.closest('[dir]')?.getAttribute('dir');
    const direction = explicitDirection || view?.getComputedStyle(group).direction;
    const reverse = direction === 'rtl';
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + (reverse ? -1 : 1) + buttons.length) % buttons.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex + (reverse ? 1 : -1) + buttons.length) % buttons.length;
        break;
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextButton = buttons[nextIndex];
    const mode = nextButton?.dataset['rvMode'];
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    this.#setMode(mode, event);
    nextButton.focus();
  }

  #setMode(mode: RiviniaThemeMode, event: Event): void {
    const transitionOrigin = this.transitionOrigin();
    if (!transitionOrigin || !this.#isBrowser) {
      this.controller.setMode(mode);
      return;
    }

    const pointerPoint =
      transitionOrigin === 'click' &&
      event.type === 'click' &&
      'detail' in event &&
      typeof event.detail === 'number' &&
      event.detail > 0 &&
      'clientX' in event &&
      'clientY' in event
        ? { x: Number(event.clientX), y: Number(event.clientY) }
        : undefined;
    const elementOrigin =
      transitionOrigin === 'click' && !pointerPoint && event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : null;

    void this.#transition.run(elementOrigin, () => this.controller.setMode(mode), {
      ...(pointerPoint ? { point: pointerPoint } : {}),
      ...(transitionOrigin === 'corner' ? { corner: this.transitionCorner() } : {}),
      duration: this.transitionDuration(),
      easing: this.transitionEasing(),
    });
  }
}
