import { expect, test } from '@playwright/test';

test('composes Select and Datepicker controls through public Table signals and restores a saved view', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  const grid = page.getByRole('grid', { name: 'Performance grid' });
  await expect(grid.locator('.rv-table-body [role="row"]')).toHaveCount(50);

  const pageSize = page.getByTestId('page-size-control');
  await pageSize.getByRole('button').click();
  await page.getByRole('menuitemradio', { name: '25 rows' }).click();
  await expect(page.getByTestId('perf-page-size')).toHaveText('25');
  await expect(grid.locator('.rv-table-body [role="row"]')).toHaveCount(25);

  await grid.getByRole('button', { name: 'Rank' }).click();
  await expect(grid.locator('.rv-table-body [role="row"]').first()).toContainText('row-09999');

  await page.locator('rv-datepicker button.rv-datepicker-trigger').click();
  const dateDialog = page.getByRole('dialog');
  await dateDialog.locator('[data-date="2026-01-20"]').click();
  await expect(page.getByTestId('date-filter-count')).toHaveText('322');
  await expect(grid).toHaveAttribute('aria-rowcount', '323');
  await expect(grid.locator('.rv-table-body [role="row"]').first()).toContainText('row-09970');

  await page.getByTestId('save-view').click();
  await page.getByTestId('page-size-control').locator('button.rv-select-trigger').click();
  await page.getByRole('menuitemradio', { name: '50 rows' }).click();
  await page.locator('rv-datepicker button.rv-datepicker-clear').click();
  await expect(page.getByTestId('perf-page-size')).toHaveText('50');
  await expect(page.getByTestId('date-filter-count')).toHaveText('10000');

  await page.getByTestId('restore-view').click();
  await expect(page.getByTestId('perf-page-size')).toHaveText('25');
  await expect(page.getByTestId('date-filter-count')).toHaveText('322');
  await expect(grid.locator('.rv-table-body [role="row"]')).toHaveCount(25);
  await expect(grid.locator('.rv-table-body [role="row"]').first()).toContainText('row-09970');

  await page.locator('main').evaluate((element) => element.setAttribute('dir', 'rtl'));
  const firstCell = grid.locator('[data-rv-cell="0:0"]');
  const secondCell = grid.locator('[data-rv-cell="0:1"]');
  await firstCell.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(secondCell).toBeFocused();
});
