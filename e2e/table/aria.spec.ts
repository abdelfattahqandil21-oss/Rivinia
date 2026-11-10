import { expect, test } from '@playwright/test';

test('exposes current-page fallback context in Chromium accessibility tree', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'uses Chromium CDP accessibility inspection');
  await page.goto('/');
  await page.getByTestId('known-total-unknown-indexes').click();
  const gridElement = page.getByRole('grid', { name: 'Audit grid' });
  await expect(gridElement).toHaveAttribute('aria-describedby', /rv-table-page-context-/);
  const describedBy = (await gridElement.getAttribute('aria-describedby'))?.split(' ') ?? [];
  expect(describedBy).toHaveLength(2);
  await expect(page.locator(`#${describedBy[1]}`)).toContainText('The full result has 5 rows');

  const session = await page.context().newCDPSession(page);
  await session.send('Accessibility.enable');
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  const grid = nodes.find(
    (node: any) => node.role?.value === 'grid' && node.name?.value === 'Audit grid',
  );
  const rows = nodes.filter((node: any) => node.role?.value === 'row');

  expect(rows).toHaveLength(3);
  expect(rows.map((node: any) => node.name?.value)).toEqual([
    'Name Actions',
    'Third Inspect Third',
    'Fifth Inspect Fifth',
  ]);
  expect(grid.description?.value).toContain('The full result has 5 rows');
  await session.detach();
});

test('renders absolute row positions and header-inclusive counts in the browser', async ({
  page,
}) => {
  await page.goto('/');
  const grid = page.getByRole('grid', { name: 'Audit grid' });
  const header = grid.locator('.rv-table-head [role="row"]');
  const rows = grid.locator('.rv-table-body [role="row"]');

  await expect(grid).toHaveAttribute('aria-rowcount', '6');
  await expect(header).toHaveAttribute('aria-rowindex', '1');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '4');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '6');

  await page.getByTestId('known-total-unknown-indexes').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '3');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '3');
  const description = await grid.getAttribute('aria-describedby');
  await expect(page.locator(`#${description?.split(' ')[1]}`)).toContainText(
    'full result has 5 rows',
  );

  await page.getByTestId('server-page-two').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '6');
  await expect(header).toHaveAttribute('aria-rowindex', '1');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '4');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '5');

  await page.getByTestId('server-page-three').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '6');
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '6');

  await page.getByTestId('known-total-known-indexes').click();
  await page.getByTestId('unknown-total-known-indexes').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '-1');
  await expect(header).toHaveAttribute('aria-rowindex', '1');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '4');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '6');

  await page.getByTestId('unknown-total-unknown-indexes').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '3');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '3');
  const unknownDescription = await grid.getAttribute('aria-describedby');
  await expect(page.locator(`#${unknownDescription?.split(' ')[1]}`)).toContainText(
    'full result size',
  );
});

test('keeps independent projected actions enabled on duplicate-ID rows', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('duplicate-ids').click();

  const grid = page.getByRole('grid', { name: 'Audit grid' });
  const rows = grid.locator('.rv-table-body [role="row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).not.toHaveAttribute('aria-selected', /.+/);
  await expect(rows.nth(0).locator('.rv-table-select')).toHaveCount(0);

  await rows.nth(0).locator('[role="gridcell"]').first().click();
  await expect(page.getByTestId('selected-count')).toHaveText('0');
  await rows.nth(0).locator('[role="gridcell"]').first().focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('selected-count')).toHaveText('0');

  await rows.nth(0).getByRole('button', { name: 'Inspect First duplicate' }).click();
  await expect(page.getByTestId('inspected')).toHaveText('First duplicate');

  await rows.nth(0).locator('[role="gridcell"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('activated')).toBeEmpty();
  await rows.nth(0).dblclick();
  await expect(page.getByTestId('activated')).toBeEmpty();
});

test('does not invent row positions for invalid and duplicate ordinals', async ({ page }) => {
  await page.goto('/');
  const grid = page.getByRole('grid', { name: 'Audit grid' });
  const rows = grid.locator('.rv-table-body [role="row"]');

  await page.getByTestId('invalid-index').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '3');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '3');

  await page.getByTestId('duplicate-index').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '3');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '3');

  await page.getByTestId('out-of-order-index').click();
  await expect(grid).toHaveAttribute('aria-rowcount', '3');
  await expect(rows.nth(0)).toHaveAttribute('aria-rowindex', '2');
  await expect(rows.nth(1)).toHaveAttribute('aria-rowindex', '3');
});
