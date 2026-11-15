export interface RiviniaThemeToggleLabels {
  readonly light: string;
  readonly dark: string;
  readonly system: string;
  readonly groupLabel: string;
  readonly currentMode: string;
  readonly switchTo: string;
  readonly noModesAvailable: string;
}

export const DEFAULT_RIVINIA_THEME_TOGGLE_LABELS: RiviniaThemeToggleLabels = Object.freeze({
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  groupLabel: 'Color theme',
  currentMode: 'Current theme',
  switchTo: 'Switch to',
  noModesAvailable: 'No theme modes are available.',
});
