import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { provideRiviniaI18n, RiviniaI18n, type TranslationLoader } from '../../projects/i18n/src/public-api';

function setup(resolve: () => Promise<TranslationLoader<'ar' | 'en'>>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRiviniaI18n({
    languages: [
      { id: 'ar', nativeName: 'العربية', dir: 'rtl' },
      { id: 'en', nativeName: 'English', dir: 'ltr' },
    ],
    defaultLanguage: 'en', storageStrategy: 'none', preload: false,
    warnOnLoadError: false, warnOnMissingKey: false, loader: { resolve },
  })] });
  return TestBed.inject(RiviniaI18n<'ar' | 'en'>);
}

describe('lazy loader descriptor lifecycle', () => {
  it('resolves one loader for simultaneous dictionaries and reuses it thereafter', async () => {
    let release!: (loader: TranslationLoader<'ar' | 'en'>) => void;
    const ready = new Promise<TranslationLoader<'ar' | 'en'>>(done => { release = done; });
    const resolve = vi.fn(() => ready);
    const load = vi.fn(async (language: string) => ({ title: language }));
    const manager = setup(resolve);
    const ar = manager.loadTranslations('ar');
    const en = manager.loadTranslations('en');
    await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(1);
    release({ load });
    expect(await ar).toEqual({ title: 'ar' });
    expect(await en).toEqual({ title: 'en' });
    expect(load).toHaveBeenCalledTimes(2);
    await manager.reload('en');
    expect(resolve).toHaveBeenCalledTimes(1);
  });
  it('allows retry after shared descriptor failure', async () => {
    const resolve = vi.fn<() => Promise<TranslationLoader<'ar' | 'en'>>>()
      .mockRejectedValueOnce(new Error('Chunk unavailable'))
      .mockResolvedValue({ load: async language => ({ title: language }) });
    const manager = setup(resolve);
    await Promise.all([manager.loadTranslations('ar'), manager.loadTranslations('en')]);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(await manager.loadTranslations('ar')).toEqual({ title: 'ar' });
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
