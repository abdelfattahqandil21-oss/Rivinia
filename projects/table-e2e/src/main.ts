import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { createTable } from '@rivinia/table';
import type { TableColumn } from '@rivinia/table';
import { RiviniaTableComponent, RvTableCell } from '@rivinia/table/ui';
import type { TableUiRow } from '@rivinia/table/ui';

interface AuditRow {
  readonly id: string;
  readonly ordinal: number;
  readonly name: string;
}

const COLUMNS: readonly TableColumn<AuditRow>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'actions', header: 'Actions' },
];

const PAGE: readonly AuditRow[] = [
  { id: 'third', ordinal: 2, name: 'Third' },
  { id: 'fifth', ordinal: 4, name: 'Fifth' },
];

@Component({
  selector: 'table-audit-root',
  imports: [RiviniaTableComponent, RvTableCell],
  template: `
    <main>
      <h1>Table accessibility audit</h1>
      <div class="controls">
        <button type="button" data-testid="known-total-known-indexes" (click)="showKnown()">
          Known total and positions
        </button>
        <button type="button" data-testid="server-page-two" (click)="showSecondServerPage()">
          Second server page
        </button>
        <button type="button" data-testid="server-page-three" (click)="showThirdServerPage()">
          Third server page
        </button>
        <button
          type="button"
          data-testid="known-total-unknown-indexes"
          (click)="unknownPositions()"
        >
          Known total, unknown positions
        </button>
        <button type="button" data-testid="unknown-total-unknown-indexes" (click)="unknownBoth()">
          Unknown total and positions
        </button>
        <button type="button" data-testid="unknown-total-known-indexes" (click)="unknownTotal()">
          Unknown total, known positions
        </button>
        <button type="button" data-testid="invalid-index" (click)="invalidPosition()">
          Invalid position
        </button>
        <button type="button" data-testid="duplicate-index" (click)="duplicatePosition()">
          Duplicate positions
        </button>
        <button type="button" data-testid="out-of-order-index" (click)="outOfOrderPosition()">
          Out-of-order positions
        </button>
        <button type="button" data-testid="duplicate-ids" (click)="duplicateIds()">
          Duplicate IDs
        </button>
      </div>
      <p data-testid="selected-count">{{ selected().size }}</p>
      <p data-testid="activated">{{ activated().join(',') }}</p>
      <p data-testid="inspected">{{ inspected().join(',') }}</p>
      <rv-table
        ariaLabel="Audit grid"
        [columns]="columns"
        [rows]="table.pageRows()"
        [totalRows]="rowCount()"
        [selectable]="true"
        [(selected)]="selected"
        (rowActivate)="activate($event)"
      >
        <ng-template rvTableCell="actions" let-data="data">
          <button type="button" class="inspect" (click)="inspect(data.name)">
            Inspect {{ data.name }}
          </button>
        </ng-template>
      </rv-table>
    </main>
  `,
})
class TableAuditApp {
  readonly columns = COLUMNS;
  readonly data = signal<readonly AuditRow[]>(PAGE);
  readonly known = signal(true);
  readonly rowCount = signal(5);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly activated = signal<string[]>([]);
  readonly inspected = signal<string[]>([]);
  readonly table = createTable<AuditRow>(() => ({
    columns: () => COLUMNS,
    data: () => this.data(),
    manualPagination: true,
    rowCount: () => this.rowCount(),
    getRowId: (row) => row.id,
    getRowIndex: (row) => (this.known() ? row.ordinal : null),
  }));

  showKnown(): void {
    this.data.set(PAGE);
    this.known.set(true);
    this.rowCount.set(5);
  }

  showSecondServerPage(): void {
    this.data.set([
      { id: 'third', ordinal: 2, name: 'Third' },
      { id: 'fourth', ordinal: 3, name: 'Fourth' },
    ]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  showThirdServerPage(): void {
    this.data.set([{ id: 'fifth', ordinal: 4, name: 'Fifth' }]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  unknownPositions(): void {
    this.data.set(PAGE);
    this.known.set(false);
    this.rowCount.set(5);
  }

  unknownBoth(): void {
    this.unknownPositions();
    this.rowCount.set(-1);
  }

  unknownTotal(): void {
    this.data.set(PAGE);
    this.known.set(true);
    this.rowCount.set(-1);
  }

  invalidPosition(): void {
    this.data.set([{ ...PAGE[0], ordinal: -1 }, PAGE[1]]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  duplicatePosition(): void {
    this.data.set([PAGE[0], { ...PAGE[1], ordinal: PAGE[0].ordinal }]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  outOfOrderPosition(): void {
    this.data.set([PAGE[1], PAGE[0]]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  duplicateIds(): void {
    this.data.set([
      { id: 'duplicate', ordinal: 2, name: 'First duplicate' },
      { id: 'duplicate', ordinal: 4, name: 'Second duplicate' },
    ]);
    this.known.set(true);
    this.rowCount.set(5);
  }

  activate(row: TableUiRow): void {
    this.activated.update((names) => [...names, String(row.data.name)]);
  }

  inspect(name: string): void {
    this.inspected.update((names) => [...names, name]);
  }
}

bootstrapApplication(TableAuditApp).catch((error: unknown) => console.error(error));
