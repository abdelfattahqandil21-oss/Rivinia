/** Adds or subtracts a positive decimal increment using fixed-point integers. */
export function stepDecimal(value: string, increment: string, direction: -1 | 1): string {
  const scale = Math.max(value.split('.')[1]?.length ?? 0, increment.split('.')[1]?.length ?? 0);
  const scaled = (decimal: string) => {
    const [whole, fractional = ''] = decimal.split('.');
    return BigInt(whole + fractional.padEnd(scale, '0'));
  };
  const result = scaled(value) + BigInt(direction) * scaled(increment);
  if (!scale) return String(result);
  const digits = String(result < 0n ? -result : result).padStart(scale + 1, '0');
  return (result < 0n ? '-' : '') + digits.slice(0, -scale) + '.' + digits.slice(-scale);
}
