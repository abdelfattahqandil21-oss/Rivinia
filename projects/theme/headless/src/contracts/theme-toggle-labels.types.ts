import { RiviniaThemeMode } from './theme-mode.types';

/** Accessible labels used by the native-button theme directive. */
export interface RiviniaThemeToggleDirectiveLabels {
  readonly modes: Readonly<Record<RiviniaThemeMode, string>>;
  readonly currentMode: string;
  readonly switchTo: string;
  readonly noModesAvailable: string;
}

export const DEFAULT_RIVINIA_THEME_TOGGLE_DIRECTIVE_LABELS: RiviniaThemeToggleDirectiveLabels =
  Object.freeze({
    modes: Object.freeze({ light: 'light', dark: 'dark', system: 'system' }),
    currentMode: 'Current theme',
    switchTo: 'Switch to',
    noModesAvailable: 'No alternative theme mode is available.',
  });
