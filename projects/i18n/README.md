# @rivinia/i18n — Angular 22 localization, from first translation to SSR

**Version:** 2.0.0-alpha.1 (local V2 naming migration; do not publish this work-in-progress). Headless, Signal-first Angular internationalization with RTL, ICU, lazy dictionary loaders, optional UI, and SSR hydration support.

> **Choose your depth.** Start with a pipe and two JSON files. Add typed keys and Signals when you need them. Advanced loading, diagnostics, and SSR are opt-in. The UI is an optional entry point; core never imports the Select library.

## Install

```bash
npm install @rivinia/i18n
```

Angular 22 is required. Add `<rv-language-toggle>` only when you import `@rivinia/i18n/ui`. The language picker (`@rivinia/i18n/select`) is **on hold** until its `@rivinia/select` dependency is approved; nothing in the quick start needs it.

## Level 1 — Beginner: two languages, minimal configuration

Place `public/i18n/ar.json` and `public/i18n/en.json` in your Angular application. For example:

```json
{ "home": { "welcome": "Welcome" } }
```

```ts
// app.config.ts
import { provideRiviniaI18n } from '@rivinia/i18n';

export const appConfig = {
  providers: [provideRiviniaI18n({
    languages: [
      { id: 'ar', displayName: 'العربية', dir: 'rtl', locale: 'ar-EG' },
      { id: 'en', displayName: 'English', dir: 'ltr', locale: 'en-US' },
    ],
    defaultLanguage: 'ar',
  })],
};
```

Use `RvTranslatePipe` in a standalone Angular component:

```ts
import { Component } from '@angular/core';
import { RvTranslatePipe } from '@rivinia/i18n';

@Component({
  selector: 'app-home',
  imports: [RvTranslatePipe],
  template: `<h1>{{ 'home.welcome' | rvTranslate }}</h1>`,
})
export class Home {}
```

**No HttpClient setup or Select dependency.** The default loader reads `/i18n/{language}.json`. Use `ng add @rivinia/i18n` or `npx rivinia-i18n-keys init` as optional setup helpers, not prerequisites.

## Level 2 — Intermediate: reactive values, typed languages, toggle

`defineRiviniaI18n` infers language IDs once. A `translate()` call returns a string; a `translateSignal()` returns a Signal that updates after a language change or reactive parameter update.

```ts
// i18n.config.ts
import { defineRiviniaI18n } from '@rivinia/i18n';

export const i18nConfig = defineRiviniaI18n({
  languages: [
    { id: 'ar', displayName: 'العربية', dir: 'rtl', locale: 'ar-EG' },
    { id: 'en', displayName: 'English', dir: 'ltr', locale: 'en-US' },
  ],
  defaultLanguage: 'ar',
  fallbackLanguage: 'en',
  detectBrowserLanguage: true,
  storageStrategy: 'local',
  syncDocumentLanguage: true,
  switchStrategy: 'preload-first',
});
// app.config.ts: providers: [i18nConfig.provide()]
```

```ts
import { Component, signal } from '@angular/core';
import { RiviniaLanguageToggle } from '@rivinia/i18n/ui';
import { i18nConfig } from './i18n.config';

@Component({
  selector: 'app-header',
  imports: [RiviniaLanguageToggle],
  template: `
    <h1>{{ heading() }}</h1>
    <p>{{ notice() }}</p>
    <rv-language-toggle [manager]="i18n" label="Switch language" />
  `,
})
export class Header {
  readonly i18n = i18nConfig.inject();
  readonly count = signal(3);
  readonly heading = this.i18n.translateSignal('home.welcome');
  readonly notice = this.i18n.translateSignal('notifications.count',
    () => ({ count: this.count() }));
}
```

`rv-language-toggle` is intended for **exactly two** languages. It keeps keyboard focus, has an accessible name, and emits `(languageChange)` only after a confirmed managed switch. The label is supplied by the app and can itself be translated.

## Level 3 — Advanced: loading, resilience, user preferences

```ts
import { defineRiviniaI18n, httpLoader } from '@rivinia/i18n';

export const i18nConfig = defineRiviniaI18n({
  languages: [
    { id: 'ar', displayName: 'العربية', dir: 'rtl', locale: 'ar-EG' },
    { id: 'en', displayName: 'English', dir: 'ltr', locale: 'en-US' },
  ],
  defaultLanguage: 'ar',
  fallbackLanguage: 'en',
  loader: httpLoader({ endpoint: '/api/translations' }),
  loadOnInit: true,
  switchStrategy: 'preload-first',
  onLoadError: (language, error) => console.error(language, error),
  onMissingKey: (event) => console.warn(event.key),
});
```

`httpLoader()` uses **Fetch**, not Angular `HttpClient`. Other supported sources are `jsonLoader`, `remoteLoader`, and `customLoader`. Inspect `ready()`, `isLoading()`, `loadingError()`, `missingKeys()` and `activeDictionary()` for UI and diagnostics. Use `loadTranslations(id)` to warm a dictionary and `reload()` to refresh without switching.

`switchLanguage(id)` follows the configured `switchStrategy`: `preload-first` waits for the dictionary load attempt; `instant` initiates the switch immediately and does **not** wait for the network. For a strict preload-first operation independent of configuration use `setLanguageAsync(id)` (legacy API retained during the migration).

## Level 4 — Deep: typed keys, SSR isolation, observability

Use `npx rivinia-i18n-keys --source public/i18n/en.json --out src/i18n-keys.d.ts` to generate typed-key declarations; run `--check` and `--parity` in CI. Compose custom `LoaderDescriptor` / `TranslationLoader` only when the built-in sources do not meet your requirements. `formatIcu`, `formatDate`, and `formatNumber` expose formatting without changing the language state.

**SSR rule:** `localStorage` and `sessionStorage` do not exist on the server. For personalized first server paint, configure `storageStrategy: 'cookie'` and read an incoming language cookie; the application remains responsible for setting server response cookies. SSR dictionaries transfer via Angular `TransferState` so hydration can reuse them without refetching. If browser-only preferences conflict with SSR HTML, hydration behavior needs a dedicated policy/test; do not claim a universal zero-mismatch guarantee.

**Diagnostics:** Missing-key reporting dedupes once per key per service lifetime; missing parameters dedupe per `(key, param)`. They publish after a microtask. `clearMissingKeys()` and `clearMissingParams()` reset their respective reports. `viewTransition` is optional/experimental and must not be required for a basic integration.

## Naming and migration (V2)

| Legacy name (temporarily supported) | Preferred V2 name |
| --- | --- |
| `t()` | `translateSignal()` |
| `nativeName` | `displayName` |
| `currentLanguageObject()` | `currentLanguageInfo()` |
| `loadedTranslations()` | `activeDictionary()` |
| `getLanguage(id)` | `getLanguageInfo(id)` |
| `detectBrowser` | `detectBrowserLanguage` |
| `autoApplyDirection` | `syncDocumentLanguage` |
| `preload` | `loadOnInit` |

Both old and new spellings work during the migration. **New names win if both config properties are set.** This phase intentionally does not remove legacy APIs: real consumers and earlier evidence suites must migrate before a breaking removal.

## Optional entry points and dependencies

| Import | Purpose | Dependency policy |
| --- | --- | --- |
| `@rivinia/i18n` | Headless service, pipe, formatting, loaders | Angular peer only |
| `@rivinia/i18n/ui` | Two-language Toggle | No required Select runtime |
| `@rivinia/i18n/select` | Language picker for 3+ languages | **Deferred** until `@rivinia/select` library passes its own gates |

More detail: [API reference](../../docs/i18n/api.md), [toggle](../../docs/i18n/toggle.md), [V2 phase plan](../../docs/i18n/v2-phase-plan.md). **No version increment, merge or publish is implied by this guide.**
