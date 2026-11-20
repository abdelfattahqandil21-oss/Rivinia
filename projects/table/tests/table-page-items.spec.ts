import { describe, expect, it } from 'vitest';
import { tablePageItems } from '@rivinia/table';

describe('tablePageItems', () => {
  it('keeps large result sets bounded', () => {
    expect(tablePageItems(500, 1_000)).toEqual([
      { kind: 'page', index: 0 },
      { kind: 'gap', after: 0 },
      { kind: 'page', index: 499 },
      { kind: 'page', index: 500 },
      { kind: 'page', index: 501 },
      { kind: 'gap', after: 501 },
      { kind: 'page', index: 999 },
    ]);
  });
  it('does not invent a last page for unknown totals', () => {
    expect(tablePageItems(4, -1)).toEqual([{ kind: 'page', index: 4 }]);
    expect(tablePageItems(0, 0)).toEqual([]);
  });
});
