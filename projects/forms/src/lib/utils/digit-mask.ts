import { normalizeDigits } from './digits';

/** A numeric mask uses # for slots. Literals cannot contain digits. */
export function formatDigitMask(raw: string, pattern: string): string {
  let result = '';
  let index = 0;
  for (const char of pattern) {
    if (index === raw.length) break;
    result += char === '#' ? raw[index++] : char;
  }
  return result;
}

export function maskDigits(text: string, limit: number): string {
  return normalizeDigits(text).replace(/[^0-9]/g, '').slice(0, limit);
}
