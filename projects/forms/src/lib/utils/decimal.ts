import type { DecimalDraft } from '../models/decimal-draft';

export function decimalSymbols(locale: string) {
  const format = new Intl.NumberFormat(locale, { useGrouping: false });
  const decimal = format.formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  const minus = format.formatToParts(-1).find((part) => part.type === 'minusSign')?.value ?? '-';
  const digits = Array.from({ length: 10 }, (_, index) => format.format(index));
  return { decimal, minus, digits };
}

export function parseDecimalDraft(
  text: string,
  { decimal, minus, digits }: ReturnType<typeof decimalSymbols>,
): DecimalDraft {
  let normalized = text.trim().replace(/[\u061c\u200e\u200f]/g, '');
  for (const [index, digit] of digits.entries()) {
    normalized = normalized.replaceAll(digit, String(index));
  }
  normalized = normalized.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
  );
  normalized = normalized.replaceAll(minus, '-');
  if (decimal !== '.') {
    // A locale with another decimal separator accepts only that separator.
    if (normalized.includes('.')) return { state: 'invalid' };
    normalized = normalized.replaceAll(decimal, '.');
  }
  if (!normalized) return { state: 'empty' };
  if (/^-?(?:\d+)?\.$|^-$/.test(normalized)) return { state: 'incomplete' };
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return { state: 'invalid' };
  const value = normalized.replace(/^(-?)\./, '$10.');
  return { state: 'valid', value };
}
