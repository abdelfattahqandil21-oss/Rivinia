# V2 naming migration — consumer guide

The API now prefers **intent-revealing names**. The legacy spellings are still available for migration and old tests. Update application code incrementally; no forced codemod is needed.

```ts
// Before
const title = i18n.t('home.title');
const language = i18n.currentLanguageObject();
const dictionary = i18n.loadedTranslations();
await i18n.setLanguageAsync('en');

// Preferred V2
const title = i18n.translateSignal('home.title');
const language = i18n.currentLanguageInfo();
const dictionary = i18n.activeDictionary();
await i18n.switchLanguage('en'); // obeys configured switchStrategy
```

**Important difference:** `switchLanguage` is strategy-dependent. If the config is `instant`, `await` does not guarantee that dictionary fetching is finished; `setLanguageAsync` still requests a preload-first switch. Do not replace calls mechanically where load-completion timing is essential.

```ts
// Before
{ id: 'ar', nativeName: 'العربية', dir: 'rtl' }
// Preferred V2
{ id: 'ar', displayName: 'العربية', dir: 'rtl', locale: 'ar-EG' }
```

Config preferences: `detectBrowserLanguage` replaces `detectBrowser`; `syncDocumentLanguage` replaces `autoApplyDirection`; `loadOnInit` replaces `preload`. If both spellings are set, the V2 property takes precedence. The `nativeName` fallback is present in the Toggle but not yet fully migrated in `@rivinia/i18n/select` (explicitly frozen pending the Select/Theme work).

Do **not** remove legacy APIs or assume old 211/211 browser evidence certifies the new implementation. Follow the validation gates in [the plan](v2-phase-plan.md).
