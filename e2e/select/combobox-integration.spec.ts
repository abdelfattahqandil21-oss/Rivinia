import { expect, test } from '@playwright/test';

test('composed select virtualizes, restores selection, permits free scroll, and binds Forms', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/combobox');
  const input = page.getByRole('combobox', { name: 'Egyptian cities' });
  await expect(input).toHaveValue('Egyptian city 140');
  await input.click();
  const panel = page.locator('[rvSelectPanel]');
  const active = page.getByRole('option', { name: 'Egyptian city 140', exact: true });
  await expect(active).toBeVisible();
  // Wait for the scale entrance to finish before comparing actual geometry.
  await expect.poll(async () => {
    const inputBox = await input.boundingBox();
    const panelBox = await panel.boundingBox();
    return Math.abs(inputBox!.width - panelBox!.width);
  }).toBeLessThan(2);
  expect(await page.getByRole('option').count()).toBeLessThan(40);
  await expect(input).toHaveAttribute('aria-activedescendant', await active.getAttribute('id') ?? '');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('#city-value')).toHaveText('141');
  await expect(panel).toHaveCount(0);
  await input.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Egyptian city 141', exact: true })).toBeVisible();
  await panel.evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('option', { name: 'Egyptian city 1', exact: true })).toBeVisible();
  await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBe(0);
  await input.fill('Egyptian city 4');
  await expect(page.getByRole('option', { name: 'Egyptian city 4', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Egyptian city 4', exact: true })).toHaveAttribute('aria-posinset', '1');
  await input.press('Escape');
  await expect(input).toHaveValue('Egyptian city 141');
  await page.locator('#disable').click();
  await expect(input).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const [name, output] of [['Template city', '#template-value'], ['Signal city', '#signal-value']]) {
  test(`composed select integrates directly with ${name}`, async ({ page }) => {
    await page.goto('/combobox');
    const input = page.getByRole('combobox', { name, exact: true });
    await expect(input).toHaveValue('Egyptian city 1');
    await input.click();
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator(output)).toHaveText('2');
    await expect(input).toHaveValue('Egyptian city 2');
  });
}
