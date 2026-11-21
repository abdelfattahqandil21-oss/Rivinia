import { expect, test } from '@playwright/test';

test('Escape closes an inner menu before the native modal', async ({ page }) => {
  await page.goto('/overlay-lifecycle');

  await page.locator('#modal-origin').click();

  const dialog = page.locator('dialog:modal');
  await expect(dialog).toHaveCount(1);

  const trigger = page.locator('#modal-menu-trigger');
  await trigger.click();

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const item = page.locator('#modal-menu-item');
  await expect(item).toBeVisible();

  // First Escape closes the menu without closing the native dialog.
  await page.keyboard.press('Escape');

  await expect(item).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog).toHaveCount(1);

  // Second Escape closes the native dialog.
  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
});

test('clipping inside a native modal dismisses the menu', async ({ page }) => {
  await page.goto('/overlay-lifecycle');
  await page.locator('#modal-origin').click();

  const dialog = page.locator('dialog:modal');
  await expect(dialog).toHaveCount(1);

  const trigger = page.locator('#modal-menu-trigger');
  const item = page.locator('#modal-menu-item');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(item).toBeVisible();

  // Completely clip the trigger inside the dialog.
  await page.locator('.rv-modal-body').evaluate((element) => {
    const body = element as HTMLElement;
    body.style.height = '0px';
    body.style.minHeight = '0px';
    body.style.maxHeight = '0px';
    body.style.padding = '0px';
    body.style.overflow = 'hidden';
  });

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(item).toBeHidden();

  // Inner clipping should dismiss the menu, not the native modal.
  await expect(dialog).toHaveCount(1);
});
