import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  PLATFORM_ID,
  Service,
  signal,
} from '@angular/core';
import { RiviniaThemeControllerContract } from '../contracts/theme-controller.types';
import { RiviniaThemePersistenceOptions } from '../contracts/theme-persistence.types';
import {
  isRiviniaThemeMode,
  RiviniaResolvedThemeMode,
  RiviniaThemeMode,
} from '../contracts/theme-mode.types';

const DEFAULT_CONFIGURATION: Required<RiviniaThemePersistenceOptions> = {
  persist: false,
  storageKey: 'rivinia-theme-mode',
};

const RIVINIA_THEME_CONFIGURATION = new InjectionToken<Required<RiviniaThemePersistenceOptions>>(
  'RIVINIA_THEME_CONFIGURATION',
  {
    providedIn: 'root',
    factory: () => DEFAULT_CONFIGURATION,
  },
);

/** Configure optional browser persistence for the root Theme controller. */
export function provideRiviniaTheme(
  configuration: RiviniaThemePersistenceOptions = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: RIVINIA_THEME_CONFIGURATION,
      useValue: {
        persist: configuration.persist === true,
        storageKey: configuration.storageKey?.trim() || DEFAULT_CONFIGURATION.storageKey,
      } satisfies Required<RiviniaThemePersistenceOptions>,
    },
  ]);
}

/** Shared root theme state. Browser DOM and storage synchronization begins after rendering. */
@Service()
export class RiviniaThemeController implements RiviniaThemeControllerContract {
  readonly #mode = signal<RiviniaThemeMode>('light');
  readonly mode = this.#mode.asReadonly();
  readonly #systemPrefersDark = signal(false);
  readonly resolvedMode = computed<RiviniaResolvedThemeMode>(() => {
    const mode = this.#mode();
    return mode === 'system' ? (this.#systemPrefersDark() ? 'dark' : 'light') : mode;
  });

  readonly #document = inject(DOCUMENT);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #configuration = inject(RIVINIA_THEME_CONFIGURATION);
  readonly #destroyRef = inject(DestroyRef);
  #browserReady = false;
  #changedBeforeBrowserReady = false;
  #mediaQuery: MediaQueryList | null = null;
  #browserWindow: Window | null = null;

  constructor() {
    if (!isPlatformBrowser(this.#platformId)) return;

    afterNextRender(() => this.#initializeBrowserState());
    this.#destroyRef.onDestroy(() => this.#cleanupBrowserListeners());
  }

  setMode(mode: RiviniaThemeMode): void {
    if (!isRiviniaThemeMode(mode)) return;

    this.#changedBeforeBrowserReady ||= !this.#browserReady;
    this.#mode.set(mode);
    if (!this.#browserReady) return;

    this.#reflectMode(mode);
    this.#persistMode(mode);
  }

  /** Switch the effective appearance; selecting system resolves to its opposite explicit mode. */
  toggle(): void {
    this.setMode(this.resolvedMode() === 'light' ? 'dark' : 'light');
  }

  #initializeBrowserState(): void {
    if (!isPlatformBrowser(this.#platformId)) return;

    const view = this.#document.defaultView;
    if (!view) return;

    this.#browserReady = true;
    this.#browserWindow = view;
    this.#mediaQuery = view.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.#systemPrefersDark.set(this.#mediaQuery?.matches ?? false);

    const root = this.#document.documentElement;
    const existingMode = root ? this.#readMode(root.getAttribute('data-rv-theme')) : null;
    const storedMode = this.#configuration.persist ? this.#readStoredMode(view) : null;
    const initialMode = this.#changedBeforeBrowserReady
      ? this.#mode()
      : (storedMode ?? existingMode ?? 'light');

    this.#mode.set(initialMode);
    if (root && (this.#changedBeforeBrowserReady || storedMode !== null)) {
      this.#reflectMode(initialMode);
    }

    this.#mediaQuery?.addEventListener('change', this.#handleSystemPreferenceChange);
    if (this.#configuration.persist) {
      view.addEventListener('storage', this.#handleStorageChange);
    }
  }

  #handleSystemPreferenceChange = (event: MediaQueryListEvent): void => {
    this.#systemPrefersDark.set(event.matches);
  };

  #handleStorageChange = (event: StorageEvent): void => {
    if (event.key !== this.#configuration.storageKey || !this.#browserReady) return;
    const mode = this.#readMode(event.newValue);
    if (!mode) return;

    this.#mode.set(mode);
    this.#reflectMode(mode);
  };

  #readStoredMode(view: Window): RiviniaThemeMode | null {
    try {
      return this.#readMode(view.localStorage.getItem(this.#configuration.storageKey));
    } catch {
      return null;
    }
  }

  #persistMode(mode: RiviniaThemeMode): void {
    if (!this.#configuration.persist || !this.#browserWindow) return;
    try {
      this.#browserWindow.localStorage.setItem(this.#configuration.storageKey, mode);
    } catch {
      // A storage denial must never prevent a successful mode change.
    }
  }

  #readMode(value: string | null): RiviniaThemeMode | null {
    return isRiviniaThemeMode(value) ? value : null;
  }

  #reflectMode(mode: RiviniaThemeMode): void {
    this.#document.documentElement?.setAttribute('data-rv-theme', mode);
  }

  #cleanupBrowserListeners(): void {
    this.#mediaQuery?.removeEventListener('change', this.#handleSystemPreferenceChange);
    this.#browserWindow?.removeEventListener('storage', this.#handleStorageChange);
    this.#mediaQuery = null;
    this.#browserWindow = null;
    this.#browserReady = false;
  }
}
