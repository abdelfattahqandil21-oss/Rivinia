import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { createTable, tableColumn } from '@rivinia/table';
import type { TableColumn } from '@rivinia/table';
import type { TableRequest } from '@rivinia/table';
import { RiviniaTableComponent } from '@rivinia/table/ui';
import type { TableUiSelectionChange } from '@rivinia/table/ui';
import { describe, expect, it } from 'vitest';

interface Employee {
  readonly id: number;
  readonly name: string;
}

const EMPLOYEES: readonly Employee[] = [
  { id: 1, name: 'Ahmed' },
  { id: 2, name: 'Mona' },
  { id: 3, name: 'Omar' },
  { id: 4, name: 'Sara' },
  { id: 5, name: 'Emma' },
];

const COLUMNS: readonly TableColumn<Employee>[] = [
  tableColumn<Employee>().accessor('name', { header: 'Name' }),
];

@Component({
  selector: 'rv-table-manual-page-consumer',
  imports: [RiviniaTableComponent],
  template: `
    <rv-table
      ariaLabel="Employees"
      [columns]="columns"
      [rows]="table.pageRows()"
      [totalRows]="table.total()"
      [selectable]="true"
      [selected]="selected()"
      (selectionChange)="onSelectionChange($event)"
    />
  `,
})
class ManualPageConsumer {
  readonly columns = COLUMNS;
  readonly loadedPage = signal<readonly Employee[]>(EMPLOYEES.slice(0, 2));
  readonly rowCount = signal(EMPLOYEES.length);
  readonly absoluteIndexesKnown = signal(true);
  readonly table = createTable<Employee>(() => ({
    columns: () => COLUMNS,
    data: () => this.loadedPage(),
    manualPagination: true,
    pageSize: 2,
    rowCount: () => this.rowCount(),
    getRowIndex: (row) => (this.absoluteIndexesKnown() ? row.id - 1 : null),
    selection: { mode: 'multi' },
  }));
  readonly selected = computed(() => new Set(this.table.selection.ids()));

  onSelectionChange(change: TableUiSelectionChange): void {
    if (change.row !== null) this.table.selection.toggle(change.row.id);
  }

  loadPage(page: number): void {
    this.table.page.set(page);
    this.loadedPage.set(EMPLOYEES.slice(page * 2, page * 2 + 2));
  }
}

@Component({
  selector: 'rv-table-client-pagination-consumer',
  imports: [RiviniaTableComponent],
  template: `
    <rv-table
      ariaLabel="Client paged employees"
      [columns]="columns"
      [rows]="table.pageRows()"
      [totalRows]="table.total()"
      [selectable]="true"
      [selected]="selected()"
      (selectionChange)="onSelectionChange($event)"
    />
  `,
})
class ClientPaginationConsumer {
  readonly columns = COLUMNS;
  readonly data = signal<readonly Employee[]>(EMPLOYEES);
  readonly table = createTable<Employee>(() => ({
    columns: () => COLUMNS,
    data: () => this.data(),
    pageSize: 2,
    selection: { mode: 'multi' },
  }));
  readonly selected = computed(() => new Set(this.table.selection.ids()));

  onSelectionChange(change: TableUiSelectionChange): void {
    if (change.row !== null) this.table.selection.toggle(change.row.id);
  }
}

interface PageResponse {
  readonly items: readonly Employee[];
  readonly total: number;
}

class AsyncServerConsumer {
  readonly columns = COLUMNS;
  readonly loadedRows = signal<readonly Employee[]>([]);
  readonly rowCount = signal(-1);
  readonly table = createTable<Employee>(() => ({
    columns: () => COLUMNS,
    data: () => this.loadedRows(),
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: () => this.rowCount(),
    selection: { mode: 'multi' },
  }));
  readonly pending: Array<{
    readonly request: TableRequest;
    readonly resolve: (response: PageResponse) => void;
  }> = [];
  private generation = 0;

  load(): Promise<void> {
    const generation = ++this.generation;
    const request = this.table.request();
    return new Promise<PageResponse>((resolve) => this.pending.push({ request, resolve })).then(
      (response) => {
        if (generation !== this.generation) return;
        this.loadedRows.set(response.items);
        this.rowCount.set(response.total);
      },
    );
  }
}

@Component({
  selector: 'rv-table-async-server-consumer',
  imports: [RiviniaTableComponent],
  template: `
    <rv-table
      ariaLabel="Asynchronously loaded employees"
      [columns]="columns"
      [rows]="table.pageRows()"
      [totalRows]="table.total()"
    />
  `,
})
class AsyncServerConsumerComponent extends AsyncServerConsumer {}

function mount(): {
  readonly fixture: ComponentFixture<ManualPageConsumer>;
  readonly host: ManualPageConsumer;
  readonly root: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [ManualPageConsumer] });
  const fixture = TestBed.createComponent(ManualPageConsumer);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
}

function mountClient(): {
  readonly fixture: ComponentFixture<ClientPaginationConsumer>;
  readonly host: ClientPaginationConsumer;
  readonly root: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [ClientPaginationConsumer] });
  const fixture = TestBed.createComponent(ClientPaginationConsumer);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
}

function mountAsync(): {
  readonly fixture: ComponentFixture<AsyncServerConsumerComponent>;
  readonly host: AsyncServerConsumerComponent;
  readonly root: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [AsyncServerConsumerComponent] });
  const fixture = TestBed.createComponent(AsyncServerConsumerComponent);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
}

function dataRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.rv-table-body .rv-table-row[role="row"]'));
}

function clickRow(root: HTMLElement, index: number): void {
  const cell = dataRows(root)[index]?.querySelector<HTMLElement>('[role="gridcell"]');
  if (!cell) throw new Error(`Missing grid cell for visible row ${index}`);
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('@rivinia/table built-package consumer', () => {
  it('uses later sort levels when a custom comparator returns NaN', () => {
    interface SortableRow {
      readonly id: number;
      readonly group: string;
      readonly rank: number;
    }
    const rows: readonly SortableRow[] = [
      { id: 1, group: 'same', rank: 2 },
      { id: 2, group: 'same', rank: 1 },
      { id: 3, group: 'same', rank: 3 },
    ];
    const columns: readonly TableColumn<SortableRow>[] = [
      { id: 'group', accessor: (row) => row.group, comparator: () => Number.NaN },
      { id: 'rank', accessor: (row) => row.rank },
    ];
    const table = createTable<SortableRow>(() => ({
      columns: () => columns,
      data: () => rows,
    }));

    table.sorting.set([
      { column: 'group', direction: 'asc' },
      { column: 'rank', direction: 'asc' },
    ]);

    expect(table.rows().map((row) => row.id)).toEqual([2, 1, 3]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('retains a selected row through externally loaded page replacement and return', () => {
    const { fixture, host, root } = mount();
    expect(dataRows(root).map((row) => row.getAttribute('aria-rowindex'))).toEqual(['2', '3']);

    clickRow(root, 0);
    fixture.detectChanges();
    expect(host.table.state()).toMatchObject({ selected: [1], selectionMode: 'include' });
    expect(dataRows(root)[0].getAttribute('aria-selected')).toBe('true');

    host.loadPage(1);
    fixture.detectChanges();
    expect(host.table.selection.ids()).toEqual([]);
    expect(host.table.state().selected).toEqual([1]);

    host.loadPage(0);
    fixture.detectChanges();
    expect(dataRows(root)[0].getAttribute('aria-selected')).toBe('true');
    expect(host.table.selection.isSelected(1)).toBe(true);
    fixture.destroy();
  });

  it('retains an exclude-mode exception through page replacement', () => {
    const { fixture, host, root } = mount();
    host.table.selection.selectAll('all');
    host.table.selection.deselect(2);
    fixture.detectChanges();
    expect(dataRows(root)[1].getAttribute('aria-selected')).toBe('false');

    host.loadPage(1);
    fixture.detectChanges();
    expect(host.table.state()).toMatchObject({ excluded: [2], selectionMode: 'exclude' });

    host.loadPage(0);
    fixture.detectChanges();
    expect(dataRows(root)[1].getAttribute('aria-selected')).toBe('false');
    fixture.destroy();
  });

  it('clears persistent selections when the consumer changes query scope', () => {
    const { fixture, host } = mount();
    host.table.selection.select(1);
    host.loadPage(1);
    host.table.selection.clear();
    expect(host.table.state()).toMatchObject({ selected: [], selectionMode: 'include' });
    host.loadPage(0);
    fixture.detectChanges();
    expect(host.table.selection.isSelected(1)).toBe(false);
    fixture.destroy();
  });

  it('announces absolute row positions after an externally loaded page change', () => {
    const { fixture, host, root } = mount();
    host.loadPage(1);
    fixture.detectChanges();
    expect(dataRows(root).map((row) => row.getAttribute('aria-rowindex'))).toEqual(['4', '5']);
    fixture.destroy();
  });

  it('supports noncontiguous server rows and a partial final page', () => {
    const { fixture, host, root } = mount();
    host.loadedPage.set([EMPLOYEES[0], EMPLOYEES[3]]);
    fixture.detectChanges();
    expect(dataRows(root).map((row) => row.getAttribute('aria-rowindex'))).toEqual(['2', '5']);

    host.loadPage(2);
    fixture.detectChanges();
    expect(dataRows(root).map((row) => row.getAttribute('aria-rowindex'))).toEqual(['6']);
    expect(root.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe('6');
    fixture.destroy();
  });

  it('reports unknown row positions and totals without inventing offsets', () => {
    const { fixture, host, root } = mount();
    host.absoluteIndexesKnown.set(false);
    host.rowCount.set(-1);
    fixture.detectChanges();
    expect(dataRows(root).map((row) => row.hasAttribute('aria-rowindex'))).toEqual([false, false]);
    expect(root.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe('-1');
    fixture.destroy();
  });

  it('preserves the first visible row and selection when page size changes', () => {
    const { fixture, host, root } = mountClient();
    host.table.page.set(2);
    fixture.detectChanges();
    clickRow(root, 0);
    fixture.detectChanges();
    expect(host.table.selection.ids()).toEqual([5]);

    host.table.pageSize.set(3);
    fixture.detectChanges();
    expect(host.table.page()).toBe(1);
    expect(host.table.pageRows().map((row) => row.id)).toEqual([4, 5]);
    expect(host.table.selection.ids()).toEqual([5]);
    expect(dataRows(root)[1].getAttribute('aria-selected')).toBe('true');
    expect(dataRows(root).map((row) => row.getAttribute('aria-rowindex'))).toEqual(['5', '6']);
    fixture.destroy();
  });

  it('clamps a client page when the current dataset shrinks', () => {
    const { fixture, host } = mountClient();
    host.table.page.set(2);
    fixture.detectChanges();
    expect(host.table.pageRows().map((row) => row.id)).toEqual([5]);

    host.data.set(EMPLOYEES.slice(0, 3));
    fixture.detectChanges();
    expect(host.table.page()).toBe(1);
    expect(host.table.pageRows().map((row) => row.id)).toEqual([3]);
    expect(host.table.total()).toBe(3);

    host.data.set([]);
    fixture.detectChanges();
    expect(host.table.page()).toBe(0);
    expect(host.table.pageRows()).toEqual([]);
    fixture.destroy();
  });

  it('reconciles page state when pagination switches from manual to client mode', () => {
    const manualPagination = signal(true);
    const table = createTable<Employee>(() => ({
      columns: () => COLUMNS,
      data: () => EMPLOYEES,
      manualPagination: manualPagination(),
      pageSize: 2,
    }));

    table.page.set(4);
    manualPagination.set(false);
    expect(table.page()).toBe(2);
    expect(table.pageRows().map((row) => row.id)).toEqual([5]);

    table.page.set(4);
    manualPagination.set(true);
    expect(table.page()).toBe(4);
  });

  it('leaves manual page reconciliation to the consumer when its total shrinks', () => {
    const { fixture, host } = mount();
    host.table.page.set(2);
    host.rowCount.set(3);
    host.loadedPage.set([]);
    fixture.detectChanges();
    expect(host.table.page()).toBe(2);
    expect(host.table.pageRows()).toEqual([]);
    fixture.destroy();
  });

  it('lets the consumer discard late server responses after a newer query wins', async () => {
    const { fixture, host, root } = mountAsync();
    host.table.page.set(3);
    host.table.filters.set([{ column: 'name', value: 'A' }]);
    const stale = host.load();
    host.table.filters.set([{ column: 'name', value: 'Mona' }]);
    const current = host.load();

    expect(host.pending.map((entry) => entry.request.page)).toEqual([0, 0]);
    expect(host.pending.map((entry) => entry.request.filters[0]?.value)).toEqual(['A', 'Mona']);

    host.pending[1].resolve({ items: [EMPLOYEES[1]], total: 1 });
    await current;
    fixture.detectChanges();
    host.pending[0].resolve({ items: [EMPLOYEES[0]], total: 1 });
    await stale;
    fixture.detectChanges();

    expect(host.table.rows().map((row) => row.id)).toEqual([2]);
    expect(dataRows(root)[0].querySelector('[role="gridcell"]')?.textContent?.trim()).toContain(
      'Mona',
    );
    fixture.destroy();
  });

  it('renders an empty server result instead of retaining the previous query rows', async () => {
    const { fixture, host, root } = mountAsync();
    host.table.filters.set([{ column: 'name', value: 'Mona' }]);
    const first = host.load();
    host.pending[0].resolve({ items: [EMPLOYEES[1]], total: 1 });
    await first;
    fixture.detectChanges();
    expect(dataRows(root)).toHaveLength(1);

    host.table.filters.set([{ column: 'name', value: 'Nobody' }]);
    const empty = host.load();
    host.pending[1].resolve({ items: [], total: 0 });
    await empty;
    fixture.detectChanges();

    expect(host.table.rows()).toEqual([]);
    expect(host.table.total()).toBe(0);
    expect(host.table.pageCount()).toBe(0);
    expect(dataRows(root)).toEqual([]);
    fixture.destroy();
  });
});
