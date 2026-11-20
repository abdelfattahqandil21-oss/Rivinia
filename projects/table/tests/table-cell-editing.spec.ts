import { describe, expect, it } from 'vitest';
import { createTableCellEditing } from '@rivinia/table';

describe('table cell editing', () => {
  const cell = { rowId: 'booking-1', columnId: 'amount' };

  it('keeps source data unchanged, validates and reverts by cell identity', () => {
    const source = { amount: 100 };
    const edits = createTableCellEditing<number>({ validate: (value) => value < 0 ? 'Negative' : null });
    expect(edits.start(cell, source.amount)).toBe(true);
    edits.update(-1);
    expect(edits.commit()).toEqual({ kind: 'invalid', message: 'Negative' });
    expect(edits.changes()).toEqual([]);
    edits.update(120);
    expect(edits.commit()).toEqual({ kind: 'committed' });
    expect(source.amount).toBe(100);
    expect(edits.conflictsWith(cell, 110)).toBe(true);
    expect(edits.conflictsWith(cell, 100)).toBe(false);
    edits.start(cell, source.amount);
    edits.update(100);
    edits.commit();
    expect(edits.changes()).toEqual([]);
  });

  it('acknowledges exact revisions while preserving later changes', () => {
    const edits = createTableCellEditing<number>();
    edits.start(cell, 100);
    edits.update(120);
    edits.commit();
    const saved = edits.changes();
    edits.start(cell, 100);
    edits.update(130);
    edits.commit();
    edits.acknowledge(saved);
    expect(edits.changes()).toHaveLength(1);
    expect(edits.changes()[0].value).toBe(130);
  });

  it('rebases an active draft if its previously committed revision is acknowledged', () => {
    const edits = createTableCellEditing<number>();
    edits.start(cell, 100);
    edits.update(120);
    edits.commit();
    const saved = edits.changes();
    edits.start(cell, 100);
    edits.update(135);
    edits.acknowledge(saved);
    edits.commit();
    expect(edits.changes()[0]).toMatchObject({ previousValue: 120, value: 135 });
  });
});
