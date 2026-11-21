import { describe, expect, it } from 'vitest';
import { exportTableCsv } from '@rivinia/table';

describe('exportTableCsv', () => {
  it('quotes fields and preserves line endings and numeric values', () => {
    expect(exportTableCsv([{ name: 'A "quoted", name\nsecond line', amount: -12 }], [
      { header: 'Name', value: (row) => row.name },
      { header: 'Amount', value: (row) => row.amount },
    ])).toBe('"Name","Amount"\r\n"A ""quoted"", name\nsecond line","-12"');
  });

  it('neutralizes formula-like strings in headers and cells', () => {
    expect(exportTableCsv(['  =SUM(A1)', '@A1'], [
      { header: '=Header', value: (row) => row },
    ])).toBe(`"'=Header"\r\n"'  =SUM(A1)"\r\n"'@A1"`);
  });

  it('returns only a header for an empty result and nothing for no columns', () => {
    expect(exportTableCsv([], [{ header: 'Name', value: () => '' }])).toBe('"Name"');
    expect(exportTableCsv([], [])).toBe('');
  });
});
