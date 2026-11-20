/*
 * Public API of `@rivinia/table/ui` — the ready-made grid.
 *
 * The UI depends INWARD on the headless core and never the reverse (D06/D21);
 * it exports components, the cell-template directive, and the label contract
 * a consumer can localise. No core internals leak through here.
 */
export type {
  TableRowAction,
  TableRowActionEvent,
  TableUiCellContext,
  TableUiColumn,
  TableUiDensity,
  TableUiLabels,
  TableUiRow,
  TableUiSelectionChange,
} from './lib/models/ui.types';
export { TABLE_UI_LABELS_AR, TABLE_UI_LABELS_EN } from './lib/models/ui.types';
export { RiviniaTableComponent } from './lib/components/rv-table/rv-table';
export { RvTableCell } from './lib/components/rv-table/rv-table-cell';

/** Creates a non-sortable UI column with a typed action factory. */
export function tableActionColumn<T>(
  definition: Omit<import('./lib/models/ui.types').TableUiColumn, 'actions' | 'accessor' | 'sortable'>
    & { readonly actions: (row: T) => readonly import('./lib/models/ui.types').TableRowAction[] },
) {
  return { ...definition, sortable: false as const };
}
export { RvTableRowDetail, type TableRowDetailContext } from './lib/components/rv-table/rv-table-row-detail';
export { RiviniaTableRecordsComponent, type TableRecordContext } from './lib/components/table-records/table-records';
export { RiviniaTablePagerComponent, type TablePagerLabels } from './lib/components/table-pager/table-pager';
