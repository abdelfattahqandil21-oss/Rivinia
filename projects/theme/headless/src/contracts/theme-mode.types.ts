export type RiviniaThemeMode = 'light' | 'dark' | 'system';
export type RiviniaResolvedThemeMode = 'light' | 'dark';

export const RIVINIA_THEME_MODES: readonly RiviniaThemeMode[] = Object.freeze([
  'light',
  'dark',
  'system',
]);

export function isRiviniaThemeMode(value: unknown): value is RiviniaThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}
