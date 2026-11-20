import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { TableRow, TableRowId } from '@rivinia/table';

export interface TableRecordContext<T> {
  readonly $implicit: TableRow<T>;
}

@Component({
  selector: 'rv-table-records',
  imports: [NgTemplateOutlet],
  templateUrl: './table-records.html',
  styleUrl: './table-records.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiviniaTableRecordsComponent<T> {
  readonly rows = input.required<readonly TableRow<T>[]>();
  readonly recordTemplate = input.required<TemplateRef<TableRecordContext<T>>>();
  readonly mode = input<'cards' | 'stack'>('cards');
  readonly label = input('Records');
  readonly emptyMessage = input('No records to show.');
  readonly loading = input(false);
  readonly loadingMessage = input('Loading…');

  protected readonly entries = computed(() => {
    const counts = new Map<TableRowId, number>();
    for (const row of this.rows()) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
    return this.rows().map((row, index) => ({
      row,
      key: row.identityValid !== false && counts.get(row.id) === 1 ? row.id : { index },
    }));
  });
}
