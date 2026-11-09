import { expect, test } from '@playwright/test';

async function statusColors(page: import('@playwright/test').Page, list: string) {
  return page.locator(list + ' .rv-toast').evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row);
      return {
        kind: row.getAttribute('data-kind'),
        rail: style.borderInlineStartColor,
        background: style.backgroundColor,
      };
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('keeps the status region accessible and uses built-in colors without Theme', async ({
  page,
}) => {
  const hasTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--rv-ok').trim() !== '',
  );

  test.skip(hasTheme, 'Standalone fallback is exercised by the no-Theme build.');
  await expect(page.getByRole('region', { name: 'Notifications' }).first()).toBeVisible();
  await expect(page.getByRole('status').first()).toContainText('success notification');
  const topLayerOpen = await page
    .locator('#default-list .rv-toasts')
    .evaluate((panel) => panel.matches(':popover-open'));
  expect(topLayerOpen).toBe(true);

  const regular = await statusColors(page, '#default-list');
  const rich = await statusColors(page, '#rich-list');
  expect(regular.map(({ rail }) => rail)).toEqual([
    'rgb(22, 163, 74)',
    'rgb(220, 38, 38)',
    'rgb(37, 99, 235)',
    'rgb(217, 119, 6)',
  ]);
  expect(rich.map(({ background }) => background)).toEqual(regular.map(({ rail }) => rail));
});

test('resolves global, scoped, instance, and rich-color overrides independently', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--rv-ok', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--rv-danger', 'rgb(4, 5, 6)');
    document.documentElement.style.setProperty('--rv-info', 'rgb(7, 8, 9)');
    document.documentElement.style.setProperty('--rv-warning', 'rgb(10, 11, 12)');
  });

  const global = await statusColors(page, '#default-list');
  expect(global.map(({ rail }) => rail)).toEqual([
    'rgb(1, 2, 3)',
    'rgb(4, 5, 6)',
    'rgb(7, 8, 9)',
    'rgb(10, 11, 12)',
  ]);
  expect((await statusColors(page, '#rich-list')).map(({ background }) => background)).toEqual(
    global.map(({ rail }) => rail),
  );

  const scopedA = await statusColors(page, '#scope-a .rv-toasts');
  const scopedB = await statusColors(page, '#scope-b .rv-toasts');
  const instance = await statusColors(page, '#instance-override');
  expect(scopedA[0]?.rail).toBe('rgb(18, 52, 86)');
  expect(scopedB[0]?.rail).toBe('rgb(68, 85, 102)');
  expect(instance[0]?.rail).toBe('rgb(200, 1, 2)');
  expect(global[0]?.rail).toBe('rgb(1, 2, 3)');
});

test('follows the Theme light and dark semantic status tokens', async ({ page }) => {
  const hasTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--rv-ok').trim() !== '',
  );

  test.skip(!hasTheme, 'Theme inheritance is exercised by the Theme-enabled build.');

  for (const mode of ['light', 'dark'] as const) {
    await page
      .locator('html')
      .evaluate((root, value) => root.setAttribute('data-rv-theme', value), mode);
    const semantic = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      document.body.append(probe);
      const colors = ['--rv-ok', '--rv-danger', '--rv-info', '--rv-warning'].map((name) => {
        probe.style.color = style.getPropertyValue(name).trim();
        return getComputedStyle(probe).color;
      });
      probe.remove();
      return colors;
    });
    const actual = await statusColors(page, '#default-list');
    expect(actual.map(({ rail }) => rail)).toEqual(semantic);
    expect((await statusColors(page, '#rich-list')).map(({ background }) => background)).toEqual(
      semantic,
    );
  }
});
