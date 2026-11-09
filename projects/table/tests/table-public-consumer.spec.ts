import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { createTable, tableColumn } from '@rivinia/table';
import type { TableColumn } from '@rivinia/table';
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

function dataRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.rv-table-body .rv-table-row[role="row"]'));
}

function clickRow(root: HTMLElement, index: number): void {
  const cell = dataRows(root)[index]?.querySelector<HTMLElement>('[role="gridcell"]');
  if (!cell) throw new Error(`Missing grid cell for visible row ${index}`);
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('@rivinia/table built-package consumer', () => {
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
});
