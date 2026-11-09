import { expect, test } from '@playwright/test';

test.describe('cross-package overlay lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/overlay-lifecycle');
  });

  test('restores consumer-owned scrollbar gutter after modal close', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.style.setProperty('scrollbar-gutter', 'stable both-edges');
    });
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter))
      .toBe('stable both-edges');

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole('button', { name: 'Open modal' }).click();
      await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter))
        .toBe('stable both-edges');
    }

    await page.getByRole('button', { name: 'Open modal' }).click();
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeVisible();
    await expect
      .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).overflow))
      .toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open modal' })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter))
      .toBe('stable both-edges');
  });

  test('keeps an open menu beneath the modal and closes one layer per Escape', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open menu' });
    await trigger.click();
    await expect(page.getByRole('menu', { name: 'Overlay test menu' })).toBeVisible();

    await page
      .getByRole('button', { name: 'Open modal' })
      .evaluate((el: HTMLButtonElement) => el.click());
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toHaveCount(0);
    await expect(page.getByRole('menu', { name: 'Overlay test menu' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Menu item' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Overlay test menu' })).toHaveCount(0);
  });

  test('Escape closes only the nested menu that owns focus', async ({ page }) => {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Open nested menu' }).click();
    const outerMenu = page.getByRole('menu', { name: 'Overlay test menu' });
    const innerMenu = page.getByRole('menu', { name: 'Nested overlay test menu' });
    await expect(innerMenu).toBeVisible();
    await page.getByRole('menuitem', { name: 'Nested menu item' }).focus();

    await page.keyboard.press('Escape');

    await expect(innerMenu).toHaveCount(0);
    await expect(outerMenu).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Open nested menu' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(outerMenu).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  });

  test('Escape in a Select footer menu leaves the owning Select open', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    await expect(selectMenu).toBeVisible();

    await page.locator('#select-footer-menu-trigger').click();
    const footerMenu = page.getByRole('menu', { name: 'Select footer menu' });
    await expect(footerMenu).toBeVisible();
    await page.getByRole('menuitem', { name: 'Footer menu item' }).focus();

    await page.keyboard.press('Escape');

    await expect(footerMenu).toHaveCount(0);
    await expect(selectMenu).toBeVisible();
    await expect(page.locator('#select-footer-menu-trigger')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(selectMenu).toHaveCount(0);
    await expect(selectTrigger).toBeFocused();
  });

  test('keeps a modal-owned toast interactive while the dialog is open', async ({ page }) => {
    await page.getByRole('button', { name: 'Open modal' }).click();
    await page
      .getByRole('button', { name: 'Emit toast' })
      .evaluate((el: HTMLButtonElement) => el.click());

    const toast = page.getByRole('status').filter({ hasText: 'Notification above the dialog' });
    await expect(toast).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeFocused();
    await page.getByRole('button', { name: 'Retry notification' }).click();
    await expect(page.getByTestId('toast-action')).toHaveText('action=1');
  });

  test('releases modal scroll lock when the active dialog owner is destroyed', async ({ page }) => {
    await page.getByRole('button', { name: 'Open modal' }).click();
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toBeVisible();
    await page
      .getByRole('button', { name: 'Destroy modal owner' })
      .evaluate((el: HTMLButtonElement) => el.click());
    await expect(page.getByRole('dialog', { name: 'Overlay lifecycle dialog' })).toHaveCount(0);
    await expect
      .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).overflow))
      .not.toBe('hidden');
  });

  test('clears pending exit work when the modal owner is destroyed mid-transition', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open modal' }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    const closingDialog = page.locator('dialog[data-state="closing"]');
    await expect(closingDialog).toBeVisible();

    await page
      .getByRole('button', { name: 'Destroy modal owner' })
      .evaluate((el: HTMLButtonElement) => el.click());
    await expect(closingDialog).toHaveCount(0);
    await expect
      .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).overflow))
      .not.toBe('hidden');
  });
});
