import { Signal } from '@angular/core';
import { RiviniaResolvedThemeMode, RiviniaThemeMode } from './theme-mode.types';

export interface RiviniaThemeControllerContract {
  readonly mode: Signal<RiviniaThemeMode>;
  readonly resolvedMode: Signal<RiviniaResolvedThemeMode>;
  setMode(mode: RiviniaThemeMode): void;
  toggle(): void;
}
