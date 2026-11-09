import assert from 'node:assert/strict';
import { enableProdMode, signal } from '@angular/core';
import { createTable } from '../dist/table/fesm2022/rivinia-table.mjs';

enableProdMode();

for (const mode of ['include', 'exclude']) {
  const data = signal([{ id: 'A' }]);
  const initialState =
    mode === 'include'
      ? { selectionMode: mode, selected: ['A'] }
      : { selectionMode: mode, excluded: ['A'] };
  const table = createTable(() => ({
    columns: () => [],
    data: () => data(),
    selection: { mode: 'multi' },
    initialState,
  }));
  const wasSelected = mode === 'include';

  assert.equal(table.selection.isSelected('A'), wasSelected);
  data.set([{ id: 'A' }, { id: 'A' }]);
  assert.deepEqual(
    table.rows().map((row) => row.identityValid),
    [false, false],
  );
  assert.equal(table.selection.isSelected('A'), false);
  assert.deepEqual(table.state().selected, mode === 'include' ? ['A'] : []);
  assert.deepEqual(table.state().excluded, mode === 'exclude' ? ['A'] : []);
  table.selection.select('A');
  assert.deepEqual(table.state().selected, mode === 'include' ? ['A'] : []);
  assert.deepEqual(table.state().excluded, mode === 'exclude' ? ['A'] : []);

  data.set([{ id: 'A' }]);
  assert.equal(table.selection.isSelected('A'), wasSelected);
}

const data = signal([{ id: 'A' }, { id: 'A' }, { id: 'B' }]);
const table = createTable(() => ({
  columns: () => [],
  data: () => data(),
  selection: { mode: 'multi' },
}));
table.selection.selectAll('all');
assert.deepEqual(table.selection.ids(), ['B']);
table.selection.select('A');
assert.deepEqual(table.selection.ids(), ['B']);

console.log('Production identity smoke passed: retention, gating, bulk selection.');
