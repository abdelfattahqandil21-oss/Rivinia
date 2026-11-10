import { expect, test } from '@playwright/test';

interface Measurement {
  readonly sequence: number;
  readonly label: string;
  readonly coreMs: number;
  readonly accessorReads: number;
  readonly totalRows: number;
  readonly pageRows: number;
  readonly firstId: number | null;
  readonly page: number;
}

test('records production-consumer performance and recomputation baseline', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const initialGrid = page.getByRole('grid', { name: 'Performance grid' });
  const initialMountSamples: number[] = [];
  for (let index = 0; index < 5; index++) {
    const started = await page.evaluate(() => performance.now());
    await page.getByTestId('show-performance').click();
    await expect(initialGrid.getByRole('row')).toHaveCount(51);
    initialMountSamples.push(
      Number(((await page.evaluate(() => performance.now())) - started).toFixed(2)),
    );
    if (index < 4) {
      await page.getByTestId('show-aria-audit').click();
      await expect(page.getByRole('grid', { name: 'Audit grid' })).toBeVisible();
    }
  }
  const metric = page.getByTestId('perf-measurement');
  let sequence = 0;

  const measure = async (button: string) => {
    const started = await page.evaluate(() => performance.now());
    await page.getByTestId(button).click();
    sequence++;
    await expect(metric).toContainText(`"sequence":${sequence}`);
    const finished = await page.evaluate(() => performance.now());
    const value = JSON.parse((await metric.textContent()) ?? '{}') as Measurement;
    return { ...value, browserMs: Number((finished - started).toFixed(2)) };
  };

  const load1k = await measure('load-1000');
  await expect(page.getByTestId('perf-total')).toHaveText('1000');
  await expect(initialGrid.getByRole('row')).toHaveCount(51);
  const sort1k = await measure('sort-data');
  expect(sort1k.totalRows).toBe(1000);
  const load10k = await measure('load-10000');
  await expect(page.getByTestId('perf-total')).toHaveText('10000');
  const grid = page.getByRole('grid', { name: 'Performance grid' });
  await expect(grid.getByRole('row')).toHaveCount(51);
  await expect(grid.locator('.rv-table-body [role="row"]')).toHaveCount(50);
  const domNodes = await grid.evaluate((element) => element.querySelectorAll('*').length);

  await measure('sort-data'); // warm-up
  const sorting = [];
  for (let index = 0; index < 5; index++) sorting.push(await measure('sort-data'));
  expect(sorting.every((item) => item.totalRows === 10000 && item.pageRows === 50)).toBe(true);
  await expect(grid.locator('.rv-table-body [role="row"]').first()).toContainText('row-00000');

  const filtering = [];
  for (let index = 0; index < 5; index++) filtering.push(await measure('filter-data'));
  expect(filtering.every((item) => item.totalRows === 1 && item.pageRows === 1)).toBe(true);
  await expect(grid.locator('.rv-table-body [role="row"]').first()).toContainText('row-09999');

  await measure('clear-search');
  const paging = [];
  for (let index = 0; index < 5; index++) paging.push(await measure('next-page'));
  expect(paging.every((item) => item.totalRows === 10000 && item.pageRows === 50)).toBe(true);
  expect(paging.every((item) => item.accessorReads === 0)).toBe(true);

  const replacements = [];
  for (let index = 0; index < 5; index++) replacements.push(await measure('replace-rows'));
  expect(replacements.every((item) => item.totalRows === 10000 && item.pageRows === 50)).toBe(true);

  const selections = [];
  for (let index = 0; index < 5; index++) selections.push(await measure('select-first'));
  expect(selections.every((item) => item.accessorReads === 0)).toBe(true);
  const firstVisibleRow = grid.locator('.rv-table-body [role="row"]').first();
  await expect(firstVisibleRow).toHaveAttribute('aria-selected', 'true');
  await measure('replace-rows');
  await expect(firstVisibleRow).toHaveAttribute('aria-selected', 'true');

  const rapid = await measure('rapid-updates');
  expect(rapid).toMatchObject({ totalRows: 1, pageRows: 1, page: 0 });

  const median = (values: readonly number[]) =>
    [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
  const summary = (values: readonly number[]) => ({
    median: median(values),
    maxOfFive: Math.max(...values),
  });
  const report = {
    browser: browserName,
    methodology:
      'Production Angular consumer; 50-row client page; 10k generated rows; five initial-mount samples; one sort warm-up and five measured repetitions per interaction; browserMs spans browser click through updated DOM assertion; coreMs is synchronous state update plus forced pageRows evaluation.',
    initialAndReplacement: {
      initialMountBrowserMs: summary(initialMountSamples),
      load1k,
      sort1k,
      load10k,
      domNodes,
      renderedRows: 51,
    },
    interactionSamples: {
      sort: {
        coreMs: summary(sorting.map((item) => item.coreMs)),
        browserMs: summary(sorting.map((item) => item.browserMs)),
        accessorReads: summary(sorting.map((item) => item.accessorReads)),
      },
      filter: {
        coreMs: summary(filtering.map((item) => item.coreMs)),
        browserMs: summary(filtering.map((item) => item.browserMs)),
        accessorReads: summary(filtering.map((item) => item.accessorReads)),
      },
      page: {
        coreMs: summary(paging.map((item) => item.coreMs)),
        browserMs: summary(paging.map((item) => item.browserMs)),
        accessorReads: summary(paging.map((item) => item.accessorReads)),
      },
      replacement: {
        coreMs: summary(replacements.map((item) => item.coreMs)),
        browserMs: summary(replacements.map((item) => item.browserMs)),
        accessorReads: summary(replacements.map((item) => item.accessorReads)),
      },
      selection: {
        coreMs: summary(selections.map((item) => item.coreMs)),
        browserMs: summary(selections.map((item) => item.browserMs)),
        accessorReads: summary(selections.map((item) => item.accessorReads)),
      },
    },
    rapid,
  };
  console.log(`TABLE_PERF_BASELINE ${JSON.stringify(report)}`);
  await test.info().attach(`table-perf-${browserName}.json`, {
    body: JSON.stringify({ report, sorting, filtering, paging, replacements, selections }, null, 2),
    contentType: 'application/json',
  });
});

test('recreates the UI component without stale rows or duplicate grid instances', async ({
  page,
}) => {
  await page.goto('/');

  for (let index = 0; index < 20; index++) {
    await page.getByTestId('show-performance').click();
    await expect(page.getByRole('grid', { name: 'Performance grid' })).toBeVisible();
    await expect(page.locator('rv-table')).toHaveCount(1);
    await page.getByTestId('show-aria-audit').click();
    await expect(page.getByRole('grid', { name: 'Audit grid' })).toBeVisible();
    await expect(page.locator('rv-table')).toHaveCount(1);
  }

  await page.getByRole('button', { name: 'Inspect Third' }).click();
  await expect(page.getByTestId('inspected')).toHaveText('Third');
});

test('preserves roving cell focus through external sort, page and row replacement updates', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  const grid = page.getByRole('grid', { name: 'Performance grid' });
  const firstCell = grid.locator('[data-rv-cell="0:0"]');
  const activeCells = grid.locator('[data-rv-cell][tabindex="0"]');

  await firstCell.focus();
  await expect(firstCell).toBeFocused();
  await expect(activeCells).toHaveCount(1);

  for (const update of ['sort-data', 'next-page', 'replace-rows']) {
    await page.getByTestId(update).evaluate((element) => (element as HTMLButtonElement).click());
    await expect(grid.locator('[data-rv-cell="0:0"]')).toBeFocused();
    await expect(activeCells).toHaveCount(1);
  }
});
