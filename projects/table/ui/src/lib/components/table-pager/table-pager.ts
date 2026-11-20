import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { tablePageItems } from '@rivinia/table';

const DEFAULT_LABELS = {
  navigation: 'Pagination', first: 'First page', previous: 'Previous page',
  next: 'Next page', last: 'Last page', size: 'Rows per page', page: 'Page',
};

export type TablePagerLabels = typeof DEFAULT_LABELS;

@Component({
  selector: 'rv-table-pager',
  templateUrl: './table-pager.html',
  styleUrl: './table-pager.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiviniaTablePagerComponent {
  readonly page = model(0);
  readonly pageSize = model(10);
  readonly pageCount = input.required<number>();
  readonly hasNext = input(false);
  readonly pageSizes = input<readonly number[]>([5, 10, 25, 50]);
  readonly labels = input<Partial<TablePagerLabels>>({});
  protected readonly text = computed(() => ({ ...DEFAULT_LABELS, ...this.labels() }));
  protected readonly items = computed(() => tablePageItems(this.page(), this.pageCount()));
  protected readonly sizes = computed(() => [...new Set([...this.pageSizes(), this.pageSize()])]
    .filter((size) => Number.isSafeInteger(size) && size > 0)
    .sort((a, b) => a - b));
  protected readonly canNext = computed(() => this.pageCount() === -1
    ? this.hasNext() : this.page() + 1 < this.pageCount());

  protected go(page: number): void {
    if (!Number.isSafeInteger(page) || page < 0 || page === this.page()) return;
    const count = this.pageCount();
    if (count === -1 ? page <= this.page() || (page === this.page() + 1 && this.hasNext()) : page < count) {
      this.page.set(page);
    }
  }

  protected changeSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (this.sizes().includes(size) && size !== this.pageSize()) this.pageSize.set(size);
  }
}
