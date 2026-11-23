import { Component, computed, inject, signal } from '@angular/core';
import { RiviniaThemeController, type RiviniaThemeMode } from '@rivinia/theme/headless';
import { RiviniaThemeToggleComponent } from '@rivinia/theme/toggle';
import type {
  RiviniaThemeTogglePresentation,
  RiviniaThemeToggleVariant,
  RiviniaThemeToggleShape,
  RiviniaThemeToggleSize,
  RiviniaThemeTransitionCorner,
  RiviniaThemeTransitionOrigin,
} from '@rivinia/theme/toggle';

type DesignSelect = 'presentation' | 'variant' | 'shape' | 'size' | 'origin' | 'corner' | 'easing';

@Component({
  selector: 'rv-theme-visual-app',
  standalone: true,
  imports: [RiviniaThemeToggleComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class ThemeVisualApp {
  readonly theme = inject(RiviniaThemeController);
  readonly presentation = signal<RiviniaThemeTogglePresentation>('segmented');
  readonly variant = signal<RiviniaThemeToggleVariant>('solid');
  readonly shape = signal<RiviniaThemeToggleShape>('pill');
  readonly size = signal<RiviniaThemeToggleSize>('md');
  readonly origin = signal<RiviniaThemeTransitionOrigin | null>('click');
  readonly corner = signal<RiviniaThemeTransitionCorner>('top-right');
  readonly duration = signal(560);
  readonly easing = signal('ease-out');
  readonly direction = signal<'ltr' | 'rtl'>('ltr');
  readonly resolvedName = computed(() => this.theme.resolvedMode() === 'dark' ? 'Dark' : 'Light');
  readonly currentModeLabel = computed(() => this.theme.mode().toUpperCase());
  readonly gallery = [
    { title: 'Soft pill', variant: 'solid' as const, shape: 'pill' as const, size: 'md' as const },
    { title: 'Precision outline', variant: 'outline' as const, shape: 'rounded' as const, size: 'md' as const },
    { title: 'Quiet ghost', variant: 'ghost' as const, shape: 'pill' as const, size: 'md' as const },
    { title: 'Compact square', variant: 'solid' as const, shape: 'square' as const, size: 'sm' as const },
  ];

  change(event: Event, field: DesignSelect): void {
    const value = (event.target as HTMLSelectElement).value;
    switch (field) {
      case 'presentation':
        if (value === 'single' || value === 'segmented') this.presentation.set(value);
        break;
      case 'variant':
        if (value === 'solid' || value === 'outline' || value === 'ghost' || value === 'unstyled') this.variant.set(value);
        break;
      case 'shape':
        if (value === 'pill' || value === 'rounded' || value === 'square') this.shape.set(value);
        break;
      case 'size':
        if (value === 'sm' || value === 'md' || value === 'lg') this.size.set(value);
        break;
      case 'origin':
        if (value === 'none') this.origin.set(null);
        else if (value === 'click' || value === 'center' || value === 'corner') this.origin.set(value);
        break;
      case 'corner':
        if (value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right') this.corner.set(value);
        break;
      case 'easing':
        if (value === 'ease-out' || value === 'ease-in-out' || value === 'linear' || value === 'cubic-bezier(0.16, 1, 0.3, 1)') this.easing.set(value);
        break;
    }
  }

  changeDuration(event: Event): void {
    this.duration.set(Number((event.target as HTMLInputElement).value));
  }

  toggleDirection(): void {
    this.direction.update((direction) => direction === 'ltr' ? 'rtl' : 'ltr');
  }

  usePreset(preset: 'soft' | 'sharp' | 'minimal'): void {
    if (preset === 'soft') {
      this.presentation.set('segmented'); this.variant.set('solid'); this.shape.set('pill'); this.size.set('md');
      this.origin.set('click'); this.duration.set(560); this.easing.set('ease-out');
    } else if (preset === 'sharp') {
      this.presentation.set('segmented'); this.variant.set('outline'); this.shape.set('square'); this.size.set('lg');
      this.origin.set('corner'); this.corner.set('top-right'); this.duration.set(700); this.easing.set('ease-in-out');
    } else {
      this.presentation.set('single'); this.variant.set('ghost'); this.shape.set('rounded'); this.size.set('sm');
      this.origin.set('center'); this.duration.set(420); this.easing.set('linear');
    }
  }

  setModeWithoutAnimation(mode: RiviniaThemeMode): void {
    this.theme.setMode(mode);
  }
}
