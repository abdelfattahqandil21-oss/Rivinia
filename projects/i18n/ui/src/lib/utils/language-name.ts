import type { LanguageLike } from '../models/language-view';

/** One lookup per (locale, id); the key cannot collide because of the NUL separator. */
const cache = new Map<string, string>();

/** Resolution order: displayName → legacy nativeName → Intl.DisplayNames → id. */
export function resolveLanguageDisplayName(entry: LanguageLike): string {
  if (entry.displayName) {
    return entry.displayName;
  }
  if (entry.nativeName) {
    return entry.nativeName;
  }

  const locale = entry.locale ?? entry.id;
  const key = `${locale}\u0000${entry.id}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let name = entry.id;
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    try {
      name = new Intl.DisplayNames([locale], { type: 'language' }).of(entry.id) ?? entry.id;
    } catch {
      name = entry.id;
    }
  }

  cache.set(key, name);
  return name;
}

/** @deprecated V2: use `resolveLanguageDisplayName`. */
export const languageName = resolveLanguageDisplayName;
