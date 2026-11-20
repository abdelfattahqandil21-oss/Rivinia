export interface TableCsvColumn<T> {
  readonly header: string;
  readonly value: (row: T) => string | number | boolean | null | undefined;
}

function encodeCell(value: ReturnType<TableCsvColumn<unknown>['value']>): string {
  let text = value == null ? '' : String(value);
  // Spreadsheet programs may evaluate formula-like text even inside CSV quotes.
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replaceAll('"', '""') + '"';
}

/** Serializes exactly the caller-selected rows and columns, without DOM or IO. */
export function exportTableCsv<T>(
  rows: readonly T[],
  columns: readonly TableCsvColumn<T>[],
): string {
  if (!columns.length) return '';
  const lines = [columns.map((column) => encodeCell(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => encodeCell(column.value(row))).join(','));
  }
  return lines.join('\r\n');
}
