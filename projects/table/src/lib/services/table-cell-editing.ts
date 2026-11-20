import { signal } from '@angular/core';
import type { TableRowId } from '../models/table.models';

export interface TableCellAddress {
  readonly rowId: TableRowId;
  readonly columnId: string;
}

export interface TableCellChange<V> extends TableCellAddress {
  readonly previousValue: V;
  readonly value: V;
  readonly revision: number;
}

export type TableEditResult =
  | { readonly kind: 'unchanged' | 'committed' | 'inactive' }
  | { readonly kind: 'invalid'; readonly message: string };

export interface TableCellEditor<V> {
  readonly address: TableCellAddress;
  readonly previousValue: V;
  readonly value: V;
  readonly error: string | null;
}

function sameCell(a: TableCellAddress, b: TableCellAddress): boolean {
  return a.rowId === b.rowId && a.columnId === b.columnId;
}

/** Tracks local edits independently of the order and visibility of rendered rows. */
export function createTableCellEditing<V>(options: {
  readonly equals?: (left: V, right: V) => boolean;
  readonly validate?: (value: V, address: TableCellAddress) => string | null;
} = {}) {
  const editor = signal<TableCellEditor<V> | null>(null);
  const changes = signal<readonly TableCellChange<V>[]>([]);
  const equals = options.equals ?? Object.is;
  let revision = 0;

  return {
    editor: editor.asReadonly(),
    changes: changes.asReadonly(),

    start(address: TableCellAddress, sourceValue: V): boolean {
      if (editor()) return false;
      const cell = { rowId: address.rowId, columnId: address.columnId };
      const existing = changes().find((change) => sameCell(change, cell));
      editor.set({
        address: cell,
        previousValue: existing ? existing.previousValue : sourceValue,
        value: existing ? existing.value : sourceValue,
        error: null,
      });
      return true;
    },

    update(value: V): void {
      editor.update((current) => current && { ...current, value, error: null });
    },

    cancel(): void {
      editor.set(null);
    },

    commit(): TableEditResult {
      const current = editor();
      if (!current) return { kind: 'inactive' };
      const { address, previousValue, value } = current;
      const error = options.validate?.(value, address) ?? null;
      if (error !== null) {
        editor.set({ ...current, error });
        return { kind: 'invalid', message: error };
      }

      const previousChange = changes().find((change) => sameCell(change, address));
      editor.set(null);
      if (equals(previousChange ? previousChange.value : previousValue, value)) {
        return { kind: 'unchanged' };
      }

      const remaining = changes().filter((change) => !sameCell(change, address));
      changes.set(equals(previousValue, value)
        ? remaining
        : [...remaining, { ...address, previousValue, value, revision: ++revision }]);
      return { kind: 'committed' };
    },

    revert(address: TableCellAddress): void {
      const current = editor();
      if (current && sameCell(current.address, address)) editor.set(null);
      changes.update((entries) => entries.filter((entry) => !sameCell(entry, address)));
    },

    acknowledge(saved: readonly (TableCellAddress & { readonly revision: number })[]): void {
      const current = editor();
      const entries = changes();
      const isAcknowledged = (entry: TableCellChange<V>) =>
        saved.some((ack) => ack.revision === entry.revision && sameCell(ack, entry));
      const savedActive = current && entries.find(
        (entry) => sameCell(entry, current.address) && isAcknowledged(entry),
      );
      if (current && savedActive) editor.set({ ...current, previousValue: savedActive.value });
      changes.set(entries.filter((entry) => !isAcknowledged(entry)));
    },

    conflictsWith(address: TableCellAddress, sourceValue: V): boolean {
      const current = editor();
      if (current && sameCell(current.address, address)) return !equals(current.previousValue, sourceValue);
      const change = changes().find((entry) => sameCell(entry, address));
      return change !== undefined && !equals(change.previousValue, sourceValue);
    },
  };
}
