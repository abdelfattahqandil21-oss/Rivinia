# @rivinia/i18n — switching the language

Back to [the README](../../projects/i18n/README.md) ·
[translating text](translating.md) · [resilience](resilience.md) ·
[the language toggle](toggle.md) · [the API](api.md)

```ts
void this.i18n.switchLanguage('ar'); // configured strategy; 'instant' switches now
await this.i18n.switchLanguage('en'); // 'preload-first' waits for the dictionary attempt
this.i18n.toggle(); // flips the first two configured languages
```

`switchLanguage()` follows `switchStrategy`. Under `instant`, its promise settles
after issuing the change, **not** after a dictionary fetch or visual transition.
Under `preload-first`, it waits for the dictionary attempt, and a failed load
leaves the previous language in place instead of an empty page. The two
strategies themselves are in [the configuration
reference](api.md#the-options-that-change-behaviour).

The explicit legacy `setLanguageAsync()` still forces preload-first regardless of
the configured strategy (the Toggle uses that contract). That call resolves
when its dictionary load settles. If a newer switch
request supersedes it, the older dictionary can still enter the cache but the
older call does not activate that language. Loader failures stay in
`loadingState`/`loadingError` and `onLoadError`; they do not reject the promise.

When language switches overlap, the latest requested language wins, even if it
is already visible. An older preload may still finish and populate the
dictionary cache, but it cannot activate, change document direction, or persist
that older choice.

`toggle()` flips the first two languages and logs a dev warning when more are
configured. `next()` and `previous()` cycle through the whole list.

## Everything visual is a signal

```ts
readonly language = this.i18n.currentLanguage; // Signal<'ar' | 'en'>
readonly direction = this.i18n.dir; // Signal<'rtl' | 'ltr'> — also written on <html dir>
readonly locale = this.i18n.locale; // Signal<string>
readonly ready = this.i18n.ready; // gate skeletons on this
```

Nothing needs wiring. `syncDocumentLanguage` (the default) keeps `<html lang>` and
`<html dir>` in sync; `lang` is written with the language's **locale**
(`ar-EG`), not its id, so `Intl` and a screen reader agree with the page.

## Numbers and dates follow the same locale

```ts
this.i18n.formatNumber(1234.5); // ar-EG → ١٬٢٣٤٫٥
this.i18n.formatDate(Date.now(), { dateStyle: 'long' });
```

Both are `Intl.NumberFormat` / `Intl.DateTimeFormat` bound to `locale()`. The
`locale` field of a language entry is what drives them, which is the one
configuration detail that surprises people: a bare `ar` formats Latin digits
(`3`), while `ar-EG` formats Arabic-Indic ones (`٣`). When the dictionary is read
by Arabic readers, pass `ar-EG`.

## Remembering the choice

The choice survives a reload in `localStorage` under `rivinia.i18n.language`,
and is only written after the user actually switches (`persist`, on by default —
the initial language is never written). On a first visit, `detectBrowserLanguage: true`
matches `navigator.languages` (`ar-EG` → `ar`, base tags match); a stored choice
always wins. `storageStrategy` moves the same value to `sessionStorage` or a
cookie, or turns persistence off with `'none'`; `'cookie'` is the strategy that
also works on the server, so the first paint matches the user's choice.

All of it is configurable — [the options table](api.md#the-options-that-change-behaviour).

## View transitions

`viewTransition: { enabled: true }` wraps the direction and text change in a
document view transition, and `skipInitialTransition` keeps the first paint
immediate. The switch itself happens inside the transition callback, so a cached
dictionary and a dictionary that has to load both land on the new language —
including on the second switch and later (fixed in 0.7.2). `ViewTransitionConfig`
and `ViewTransitionInfo` are Experimental; the API tier is in
[the stability table](api.md#api-stability).
