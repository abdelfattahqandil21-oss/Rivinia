import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RiviniaI18nConfig } from '../../projects/i18n/src/lib/models/i18n-config';
import { customLoader } from '../../projects/i18n/src/lib/models/loaders';
import { provideRiviniaI18n } from '../../projects/i18n/src/lib/providers/provide-i18n';
import { RiviniaI18n } from '../../projects/i18n/src/lib/services/rivinia-i18n';

const AR = { id: 'ar', displayName: 'العربية', dir: 'rtl', locale: 'ar-EG' } as const;
const EN = { id: 'en', displayName: 'English', dir: 'ltr', locale: 'en-US' } as const;

function setup(config: Partial<RiviniaI18nConfig<'ar' | 'en'>> = {}): RiviniaI18n<'ar' | 'en'> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRiviniaI18n({
      languages: [AR, EN],
      defaultLanguage: 'ar',
      storageStrategy: 'none',
      loadOnInit: false,
      translations: { ar: { count: '{count} إشعار', heading: 'الرئيسية' }, en: { heading: 'Home' } },
      loader: customLoader(async () => ({})),
      warnOnMissingKey: false,
      warnOnLoadError: false,
      ...config,
    })],
  });
  return TestBed.inject(RiviniaI18n<'ar' | 'en'>);
}

beforeEach(() => {
  TestBed.resetTestingModule();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('V2 canonical naming — coexistence with previous API', () => {
  it('returns current metadata, visible dictionary and the precise name', async () => {
    const i18n = setup();
    await i18n.initialize();
    expect(i18n.currentLanguage()).toBe('ar');
    expect(i18n.currentLanguageInfo().displayName).toBe('العربية');
    expect(i18n.currentLanguageObject()).toBe(i18n.currentLanguageInfo());
    expect(i18n.getLanguageInfo('en')?.displayName).toBe('English');
    expect(i18n.getLanguage('en')).toBe(i18n.getLanguageInfo('en'));
    expect(i18n.activeDictionary()).toBe(i18n.loadedTranslations());
    expect(i18n.activeDictionary()).toHaveProperty('heading', 'الرئيسية');
  });

  it('translateSignal tracks parameter signals; legacy t remains equivalent', async () => {
    const i18n = setup();
    await i18n.initialize();
    const count = signal(1);
    const title = i18n.translateSignal('heading');
    const message = i18n.translateSignal('count', () => ({ count: count() }));
    expect(title()).toBe('الرئيسية');
    expect(message()).toBe('1 إشعار');
    count.set(4);
    expect(message()).toBe('4 إشعار');
    expect(i18n.t('heading')()).toBe(title());
    expect(i18n.translate('heading')).toBe('الرئيسية');
  });

  it('uses the new detection config over its legacy alias', () => {
    const i18n = setup({ detectBrowserLanguage: false, detectBrowser: true });
    // English navigator preference, but explicit V2 opt-out wins.
    expect(i18n.currentLanguage()).toBe('ar');
  });

  it('switchLanguage requests a switch using the configured instant strategy', async () => {
    const i18n = setup({ switchStrategy: 'instant' });
    await i18n.initialize();
    await i18n.switchLanguage('en');
    expect(i18n.currentLanguage()).toBe('en');
  });

  it('switchLanguage with preload-first waits and keeps the old language on failure', async () => {
    const i18n = setup({
      switchStrategy: 'preload-first',
      loader: customLoader(async (language) => {
        if (language === 'en') throw new Error('network failure');
        return { heading: 'الرئيسية' };
      }),
    });
    await i18n.initialize();
    await i18n.switchLanguage('en');
    expect(i18n.currentLanguage()).toBe('ar');
    expect(i18n.translate('heading')).toBe('الرئيسية');
  });
});
