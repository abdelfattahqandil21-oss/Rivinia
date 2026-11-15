import { expect, test } from '@playwright/test';

test('template menu owns actions, disabled focus, checked requests, native links and Router links', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/combobox');
  const trigger = page.getByRole('button', { name: 'Composed actions', exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Usage', exact: true }).click();
  await expect(page.locator('#usage-count')).toHaveText('1');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu')).toBeHidden();
  await trigger.click();
  const usage = page.getByRole('menuitem', { name: 'Usage', exact: true });
  await usage.focus();
  await usage.press('ArrowDown');
  const disabled = page.getByRole('menuitem', { name: 'Unavailable', exact: true });
  await expect(disabled).toBeFocused();
  await disabled.press('Enter');
  await expect(page.locator('#usage-count')).toHaveText('1');
  const grid = page.getByRole('menuitemcheckbox', { name: 'Grid', exact: true });
  await grid.click();
  await expect(grid).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menu')).toBeVisible();
  const github = page.getByRole('menuitem', { name: 'GitHub', exact: true });
  await expect(github).toHaveAttribute('href', 'https://github.com/example');
  await expect(github).toHaveAttribute('rel', /noopener/);
  await expect(github).toHaveAttribute('rel', /noreferrer/);
  const before = await page.evaluate(() => {
    (window as Window & { integrationMarker?: string }).integrationMarker = 'same-document';
    return location.origin;
  });
  await page.getByRole('menuitem', { name: 'Basic page', exact: true }).click();
  await expect(page).toHaveURL(`${before}/basic`);
  expect(await page.evaluate(() => (window as Window & { integrationMarker?: string }).integrationMarker)).toBe('same-document');
  expect(errors).toEqual([]);
});
