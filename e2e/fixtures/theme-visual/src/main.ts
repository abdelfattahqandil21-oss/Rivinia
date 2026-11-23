import { bootstrapApplication } from '@angular/platform-browser';
import { provideRiviniaTheme } from '@rivinia/theme/headless';
import { ThemeVisualApp } from './app/app';

bootstrapApplication(ThemeVisualApp, {
  providers: [provideRiviniaTheme({ persist: true, storageKey: 'rv-theme-visual-lab' })],
}).catch((error: unknown) => console.error(error));
