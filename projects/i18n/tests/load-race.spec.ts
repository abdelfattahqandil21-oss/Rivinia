import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RiviniaI18nConfig } from '../src/lib/models/i18n-config';
import { customLoader } from '../src/lib/models/loaders';
import { provideRiviniaI18n } from '../src/lib/providers/provide-i18n';
import { RiviniaI18n } from '../src/lib/services/rivinia-i18n';

/**
 * RIV-02 — in-flight dedupe must share the FETCH, not the decision to apply.
 *
 * Expected values are derived from the requirement, not the implementation:
 * whichever caller starts a load, the dictionary belongs to the language
 * whenever that language is current when the response arrives.
 */
const AR = { id: 'ar', nativeName: 'العربية', dir: 'rtl' } as const;
const EN = { id: 'en', nativeName: 'English', dir: 'ltr' } as const;
const FR = { id: 'fr', nativeName: 'Français', dir: 'ltr' } as const;

type Ids = 'ar' | 'en' | 'fr';

function setup(config?: Partial<RiviniaI18nConfig<Ids>>): RiviniaI18n<Ids> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRiviniaI18n({
        defaultLanguage: 'ar',
        languages: [AR, EN, FR],
        storageStrategy: 'none',
        warnOnMissingKey: false,
        preload: false,
        loader: customLoader(async () => ({})),
        ...config,
      }),
    ],
  });
  return TestBed.inject(RiviniaI18n<Ids>);
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  TestBed.resetTestingModule();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('RIV-02 in-flight loads across callers', () => {
  it('activates the latest different async request regardless of response order', async () => {
    const ar = deferred<Record<string, unknown>>();
    const fr = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      switchStrategy: 'preload-first',
      loader: customLoader(async (language) => {
        if (language === 'ar') return ar.promise;
        if (language === 'fr') return fr.promise;
        return {};
      }),
    });

    const arabicRequest = i18n.setLanguageAsync('ar');
    const frenchRequest = i18n.setLanguageAsync('fr');
    await flush();

    fr.resolve({ greeting: 'Bonjour' });
    await frenchRequest;
    ar.resolve({ greeting: 'مرحبا' });
    await arabicRequest;

    expect(i18n.currentLanguage()).toBe('fr');
    expect(i18n.dir()).toBe('ltr');
    expect(i18n.translate('greeting')).toBe('Bonjour');
  });

  it('does not let unrelated dictionary preloading supersede a pending switch', async () => {
    const ar = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      loader: customLoader(async (language) => {
        if (language === 'ar') return ar.promise;
        if (language === 'fr') return { greeting: 'Bonjour' };
        return {};
      }),
    });

    const arabicRequest = i18n.setLanguageAsync('ar');
    await flush();
    await i18n.loadTranslations('fr');
    ar.resolve({ greeting: 'مرحبا' });
    await arabicRequest;

    expect(i18n.currentLanguage()).toBe('ar');
    expect(i18n.translate('greeting')).toBe('مرحبا');
  });

  it('keeps the latest preload-first language intent when a previous load resolves late', async () => {
    const ar = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      switchStrategy: 'preload-first',
      loader: customLoader(async (language) => (language === 'ar' ? ar.promise : {})),
    });

    const arabicRequest = i18n.setLanguageAsync('ar');
    await flush();

    // Requesting the already-visible language is still the latest user intent
    // and must invalidate the pending switch to Arabic.
    await i18n.setLanguageAsync('en');
    ar.resolve({ greeting: 'مرحبا' });
    await arabicRequest;

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.dir()).toBe('ltr');
  });

  it('does not let an old preload-first request undo a later instant selection', async () => {
    const ar = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      switchStrategy: 'instant',
      loader: customLoader(async (language) => (language === 'ar' ? ar.promise : {})),
    });

    const arabicRequest = i18n.setLanguageAsync('ar');
    await flush();
    i18n.setLanguage('en');

    ar.resolve({ greeting: 'مرحبا' });
    await arabicRequest;

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.dir()).toBe('ltr');
  });

  it('retries a failed language load instead of reusing a failed or partial result', async () => {
    let attempts = 0;
    const i18n = setup({
      loader: customLoader(async () => {
        attempts++;
        if (attempts === 1) throw new Error('offline');
        return { greeting: 'Hello' };
      }),
    });

    await i18n.setLanguageAsync('en');
    expect(i18n.currentLanguage()).toBe('ar');

    await i18n.setLanguageAsync('en');
    expect(attempts).toBe(2);
    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.translate('greeting')).toBe('Hello');
  });

  it('keeps an older request from activating after the latest requested language fails', async () => {
    const ar = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      loader: customLoader(async (language) => {
        if (language === 'ar') return ar.promise;
        if (language === 'fr') throw new Error('offline');
        return {};
      }),
    });

    const olderArabicRequest = i18n.setLanguageAsync('ar');
    await flush();
    await i18n.setLanguageAsync('fr');
    ar.resolve({ greeting: 'مرحبا' });
    await olderArabicRequest;

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.dir()).toBe('ltr');
  });

  it('keeps the latest locale active when an older request fails late', async () => {
    const ar = deferred<Record<string, unknown>>();
    const i18n = setup({
      defaultLanguage: 'en',
      loader: customLoader(async (language) => {
        if (language === 'ar') return ar.promise;
        return { greeting: 'Hello' };
      }),
    });

    const olderArabicRequest = i18n.setLanguageAsync('ar');
    await flush();
    await i18n.setLanguageAsync('en');
    ar.reject(new Error('offline'));
    await olderArabicRequest;

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.dir()).toBe('ltr');
    expect(i18n.loadingState()).toBe('idle');
    expect(i18n.loadingError()).toBeNull();
  });

  it('deduplicates concurrent async switches to the same language', async () => {
    const en = deferred<Record<string, unknown>>();
    let calls = 0;
    const i18n = setup({
      loader: customLoader(async (language) => {
        if (language === 'en') {
          calls++;
          return en.promise;
        }
        return {};
      }),
    });

    const first = i18n.setLanguageAsync('en');
    const second = i18n.setLanguageAsync('en');
    await flush();
    expect(calls).toBe(1);

    en.resolve({ greeting: 'Hello' });
    await Promise.all([first, second]);

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.translate('greeting')).toBe('Hello');
  });

  it('applies a fallback dictionary when the user switches to it mid-flight', async () => {
    const en = deferred<Record<string, unknown>>();
    const i18n = setup({
      fallbackLanguage: 'en',
      preload: true,
      loader: customLoader(async (language) =>
        language === 'en' ? en.promise : { greeting: 'مرحبا' },
      ),
    });

    // The fallback is fetched in the background while `ar` is current.
    void i18n.initialize();
    await flush();
    expect(i18n.translate('greeting')).toBe('مرحبا');

    // The user taps English before the fallback request settles.
    i18n.setLanguage('en');
    await flush();

    en.resolve({ greeting: 'Hello' });
    await flush();
    await flush();

    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.loadingState()).toBe('idle');
    expect(i18n.translate('greeting')).toBe('Hello');
  });

  it('does not refetch when setLanguage joins a setLanguageAsync load', async () => {
    const en = deferred<Record<string, unknown>>();
    const calls: Ids[] = [];
    const i18n = setup({
      loader: customLoader(async (language) => {
        calls.push(language);
        return language === 'en' ? en.promise : {};
      }),
    });

    const preload = i18n.setLanguageAsync('en');
    await flush();
    // The user switches instantly while the preload-first task is still open.
    i18n.setLanguage('en');
    await flush();

    en.resolve({ greeting: 'Hello' });
    await preload;
    await flush();

    expect(calls.filter((call) => call === 'en')).toHaveLength(1);
    expect(i18n.currentLanguage()).toBe('en');
    expect(i18n.translate('greeting')).toBe('Hello');
  });

  it('reports onLoadError once when several callers share a failed fetch', async () => {
    const en = deferred<Record<string, unknown>>();
    const failures: string[] = [];
    const i18n = setup({
      loader: customLoader(async (language) =>
        language === 'en' ? en.promise : {},
      ),
      onLoadError: (language) => failures.push(language),
    });

    const first = i18n.loadTranslations('en');
    const second = i18n.loadTranslations('en');
    await Promise.resolve();
    en.reject(new Error('offline'));
    await first;
    await second;

    expect(failures).toEqual(['en']);
  });

  it('discards an old response when reload() runs mid-flight', async () => {
    const slow = deferred<void>();
    let version = 1;
    const i18n = setup({
      loader: customLoader(async () => {
        if (version === 1) {
          await slow.promise;
          return { v: 'old' };
        }
        return { v: 'new' };
      }),
    });

    const stale = i18n.loadTranslations('ar');
    await flush();

    version = 2;
    const fresh = i18n.reload();
    await flush();

    slow.resolve();
    await stale;
    await fresh;

    expect(i18n.translate('v')).toBe('new');
    expect(i18n.loadingState()).toBe('idle');
  });

  it('never puts the loading state in error for a background fallback failure', async () => {
    const failures: string[] = [];
    const i18n = setup({
      fallbackLanguage: 'en',
      preload: true,
      loader: customLoader(async (language) => {
        if (language === 'en') throw new Error('offline');
        return { greeting: 'مرحبا' };
      }),
      onLoadError: (language) => failures.push(language),
    });

    void i18n.initialize();
    await flush();
    await flush();

    expect(failures).toContain('en');
    expect(i18n.loadingState()).toBe('idle');
    expect(i18n.translate('greeting')).toBe('مرحبا');
  });
});
