import { RiviniaThemeMode } from '@rivinia/theme/headless';

export type RiviniaThemeTogglePresentation = 'single' | 'segmented';
export type RiviniaThemeToggleVariant = 'solid' | 'outline' | 'ghost' | 'unstyled';
export type RiviniaThemeToggleShape = 'pill' | 'rounded' | 'square';
export type RiviniaThemeToggleSize = 'sm' | 'md' | 'lg';

export type RiviniaThemeToggleModes = readonly RiviniaThemeMode[];

export function normalizeRiviniaThemeToggleModes(values: readonly unknown[]): RiviniaThemeMode[] {
  const accepted: RiviniaThemeMode[] = [];
  const seen = new Set<RiviniaThemeMode>();
  for (const value of values) {
    if ((value === 'light' || value === 'dark' || value === 'system') && !seen.has(value)) {
      seen.add(value);
      accepted.push(value);
    }
  }
  return accepted;
}
