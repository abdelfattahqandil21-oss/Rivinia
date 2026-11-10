import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRiviniaDatepicker } from '@rivinia/datepicker';
import type { RiviniaDate } from '@rivinia/datepicker';
import { RiviniaDatepickerComponent } from '@rivinia/datepicker/ui';
import type { RiviniaSelectOption } from '@rivinia/select';
import { RiviniaSelectComponent } from '@rivinia/select/ui';
import type { SelectChange } from '@rivinia/select/ui';
import { createTable } from '@rivinia/table';
import type { TableColumn, TableRowId } from '@rivinia/table';
import type { TableState } from '@rivinia/table';
import { RiviniaTableComponent, RvTableCell } from '@rivinia/table/ui';
import type { TableUiRow } from '@rivinia/table/ui';

interface AuditRow {
  readonly id: string;
  readonly ordinal: number;
  readonly name: string;
}

interface PerfRow {
  readonly id: number;
  readonly rank: number;
  readonly name: string;
  readonly date: number;
}

interface PerfMeasurement {
  readonly sequence: number;
  readonly label: string;
  readonly coreMs: number;
  readonly accessorReads: number;
  readonly totalRows: number;
  readonly pageRows: number;
  readonly firstId: TableRowId | null;
  readonly page: number;
}

interface SavedPerfView {
  readonly table: TableState;
  readonly pageSizeValue: SelectChange;
  readonly dateFilter: RiviniaDate | null;
}

const COLUMNS: readonly TableColumn<AuditRow>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'actions', header: 'Actions' },
];

const PAGE: readonly AuditRow[] = [
  { id: 'third', ordinal: 2, name: 'Third' },
  { id: 'fifth', ordinal: 4, name: 'Fifth' },
];

function makePerfRows(count: number): readonly PerfRow[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    rank: count - id,
    name: `row-${String(id).padStart(5, '0')}`,
    date: Date.UTC(2026, 0, (id % 31) + 1),
  }));
}

@Component({
  selector: 'table-audit-root',
  imports: [RiviniaTableComponent, RvTableCell, RiviniaSelectComponent, RiviniaDatepickerComponent],
  template: `
    <main>
      @if (performanceMode()) {
        <h1>Table performance audit</h1>
        <div class="controls">
          <button type="button" data-testid="load-1000" (click)="loadRows(1000)">Load 1k</button>
          <button type="button" data-testid="load-10000" (click)="loadRows(10000)">Load 10k</button>
          <button type="button" data-testid="sort-data" (click)="sortRows()">Sort rank</button>
          <button type="button" data-testid="filter-data" (click)="filterRows()">
            Toggle global search
          </button>
          <button type="button" data-testid="clear-search" (click)="clearSearch()">
            Clear search
          </button>
          <button type="button" data-testid="next-page" (click)="changePage()">Toggle page</button>
          <button type="button" data-testid="replace-rows" (click)="replaceRows()">
            Replace row objects
          </button>
          <button type="button" data-testid="select-first" (click)="toggleFirstSelection()">
            Toggle first selection
          </button>
          <button type="button" data-testid="rapid-updates" (click)="rapidUpdates()">
            Rapid combined update
          </button>
          <button type="button" data-testid="save-view" (click)="saveView()">Save view</button>
          <button type="button" data-testid="restore-view" (click)="restoreView()">
            Restore view
          </button>
          <button type="button" data-testid="show-aria-audit" (click)="performanceMode.set(false)">
            Accessibility audit
          </button>
        </div>
        <rv-select
          data-testid="page-size-control"
          label="Page size"
          [options]="pageSizeOptions"
          [(value)]="pageSizeValue"
          (selectionChange)="changePageSize($event)"
        />
        <rv-datepicker
          label="Filter date"
          format="dd/MM/yyyy"
          [(value)]="dateFilter"
          (valueChange)="applyDateFilter($event)"
          [clearable]="true"
        />
        <p data-testid="perf-page-size">{{ perfTable.pageSize() }}</p>
        <p data-testid="date-filter-count">{{ perfTable.rows().length }}</p>
        <p data-testid="perf-measurement">{{ perfMeasurement() }}</p>
        <p data-testid="perf-total">{{ perfTable.total() }}</p>
        <rv-table
          ariaLabel="Performance grid"
          [columns]="perfColumns"
          [rows]="perfTable.pageRows()"
          [totalRows]="perfTable.total()"
          [sort]="perfTable.sorting()"
          (sortChange)="perfTable.sorting.set($event)"
          [selectable]="true"
          [(selected)]="perfSelected"
        />
      } @else {
        <h1>Table accessibility audit</h1>
        <button type="button" data-testid="show-performance" (click)="showPerformance()">
          Performance audit
        </button>
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
      }
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
  readonly performanceMode = signal(false);
  readonly perfData = signal<readonly PerfRow[]>([]);
  readonly perfSelected = signal<ReadonlySet<TableRowId>>(new Set());
  readonly pageSizeOptions: readonly RiviniaSelectOption[] = [
    { id: '25', label: '25 rows' },
    { id: '50', label: '50 rows' },
  ];
  readonly pageSizeValue = signal<SelectChange>('50');
  readonly dateFilter = signal<RiviniaDate | null>({ year: 2026, month: 1, day: 15 });
  readonly perfMeasurement = signal('');
  readonly savedView = signal<SavedPerfView | null>(null);
  private accessorReads = 0;
  private sortDescending = false;
  private filterSecond = false;
  private pageSecond = false;
  private selectFirst = false;
  private measurementSequence = 0;
  readonly perfColumns: readonly TableColumn<PerfRow>[] = [
    {
      id: 'name',
      header: 'Name',
      accessor: (row) => {
        this.accessorReads++;
        return row.name;
      },
    },
    {
      id: 'rank',
      header: 'Rank',
      accessor: (row) => {
        this.accessorReads++;
        return row.rank;
      },
    },
    {
      id: 'date',
      header: 'Date',
      accessor: (row) => {
        this.accessorReads++;
        return row.date;
      },
    },
  ];
  readonly perfTable = createTable<PerfRow>(() => ({
    columns: () => this.perfColumns,
    data: () => this.perfData(),
    pageSize: 50,
    getRowId: (row) => row.id,
  }));
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

  loadRows(count: number): void {
    this.measure(`replace-${count}`, () => {
      this.perfTable.sorting.set([]);
      this.perfTable.filters.set([]);
      this.perfTable.globalSearch.set('');
      this.perfTable.pageSize.set(50);
      this.perfTable.page.set(0);
      this.perfData.set(makePerfRows(count));
    });
  }

  showPerformance(): void {
    this.perfData.set(makePerfRows(10000));
    this.performanceMode.set(true);
  }

  sortRows(): void {
    this.sortDescending = !this.sortDescending;
    this.measure(`sort-${this.sortDescending ? 'desc' : 'asc'}`, () => {
      this.perfTable.sorting.set([
        { column: 'rank', direction: this.sortDescending ? 'desc' : 'asc' },
      ]);
    });
  }

  filterRows(): void {
    this.filterSecond = !this.filterSecond;
    this.measure('global-search', () =>
      this.perfTable.globalSearch.set(this.filterSecond ? 'row-09999' : 'row-09998'),
    );
  }

  clearSearch(): void {
    this.measure('clear-search', () => this.perfTable.globalSearch.set(''));
  }

  changePageSize(value: SelectChange): void {
    if (typeof value === 'string') this.perfTable.pageSize.set(Number(value));
  }

  applyDateFilter(date: RiviniaDate | null): void {
    if (date === null) {
      this.perfTable.filters.set([]);
      return;
    }
    this.perfTable.filters.set([
      {
        column: 'date',
        value: Date.UTC(date.year, date.month - 1, date.day),
      },
    ]);
  }

  saveView(): void {
    this.savedView.set({
      table: this.perfTable.state(),
      pageSizeValue: this.pageSizeValue(),
      dateFilter: this.dateFilter(),
    });
  }

  restoreView(): void {
    const saved = this.savedView();
    if (!saved) return;
    this.perfTable.setState(saved.table);
    this.pageSizeValue.set(saved.pageSizeValue);
    this.dateFilter.set(saved.dateFilter);
  }

  changePage(): void {
    this.pageSecond = !this.pageSecond;
    this.measure('page-change', () => this.perfTable.page.set(this.pageSecond ? 1 : 0));
  }

  replaceRows(): void {
    this.measure('replace-object-instances', () =>
      this.perfData.update((rows) => rows.map((row) => ({ ...row }))),
    );
  }

  toggleFirstSelection(): void {
    this.selectFirst = !this.selectFirst;
    this.measure('selection-change', () => {
      const first = this.perfTable.pageRows()[0];
      this.perfSelected.set(this.selectFirst && first ? new Set([first.id]) : new Set());
    });
  }

  rapidUpdates(): void {
    this.measure('same-turn-data-query-size-page', () => {
      this.perfTable.page.set(7);
      this.perfData.update((rows) => rows.map((row) => ({ ...row })));
      this.perfTable.globalSearch.set('row-09999');
      this.perfTable.pageSize.set(25);
    });
  }

  private measure(label: string, update: () => void): void {
    this.accessorReads = 0;
    const started = performance.now();
    update();
    const pageRows = this.perfTable.pageRows();
    const measurement: PerfMeasurement = {
      sequence: ++this.measurementSequence,
      label,
      coreMs: Number((performance.now() - started).toFixed(2)),
      accessorReads: this.accessorReads,
      totalRows: this.perfTable.total(),
      pageRows: pageRows.length,
      firstId: pageRows[0]?.id ?? null,
      page: this.perfTable.page(),
    };
    this.perfMeasurement.set(JSON.stringify(measurement));
  }
}

bootstrapApplication(TableAuditApp, {
  providers: [provideRiviniaDatepicker({ selected: { year: 2026, month: 1, day: 15 } })],
}).catch((error: unknown) => console.error(error));
