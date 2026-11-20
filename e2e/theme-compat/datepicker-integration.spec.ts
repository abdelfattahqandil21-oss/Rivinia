import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('owns one native panel and restores focus after Escape', async ({ page }) => {
  const first = page.locator('#booking-date .rv-datepicker-trigger');
  const second = page.locator('#default-datetime .rv-datepicker-trigger');
  await first.click();
  await expect(page.locator('#booking-date .rv-datepicker-panel')).toBeVisible();
  await second.focus();
  await second.press('Enter');
  await expect(page.locator('.rv-datepicker-panel:not([inert])')).toHaveCount(1);
  const panel = page.locator('#default-datetime .rv-datepicker-panel');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
});

test('typing changes a draft, Escape discards, and Enter commits once', async ({ page }) => {
  const picker = page.locator('#default-datetime');
  const trigger = picker.locator('.rv-datepicker-trigger');
  const before = await trigger.innerText();
  await trigger.click();
  const hour = picker.locator('.rv-time-hour');
  await hour.fill('14');
  await expect(trigger).toHaveText(before);
  await hour.press('Escape');
  await trigger.click();
  await expect(hour).toHaveValue('21');
  await hour.fill('14');
  await hour.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  // This fixture deliberately has a one-way value binding. Commit still updates
  // the component model and its trigger; a later external write would replace it.
  await expect(trigger).toContainText('14:05');
});

test('clipping the anchor closes the panel and does not reopen it on return', async ({ page }) => {
  const picker = page.locator('#booking-date');
  const trigger = picker.locator('.rv-datepicker-trigger');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await picker.evaluate((element) => {
    const parent = element.parentElement!;
    parent.style.height = '1px';
    parent.style.overflow = 'hidden';
    window.dispatchEvent(new Event('scroll'));
  });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await picker.evaluate((element) => {
    element.parentElement!.style.height = '';
    element.parentElement!.style.overflow = '';
  });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('keeps RTL panel inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const trigger = page.locator('#rtl-date .rv-datepicker-trigger');
  await trigger.click();
  const panel = page.locator('#rtl-date .rv-datepicker-panel');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(361);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('date actions stay in the panel and selecting a day waits for OK', async ({ page }) => {
  const picker = page.locator('#booking-date');
  const trigger = picker.locator('.rv-datepicker-trigger');
  const before = await trigger.innerText();
  await expect(picker.locator('.rv-datepicker-now')).toHaveCount(0);
  await trigger.click();
  const panel = picker.locator('.rv-datepicker-panel');
  await expect(panel.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  await panel.locator('[data-date="2026-11-15"]').click();
  await expect(trigger).toHaveText(before);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(trigger).toContainText('Nov 15, 2026');
  await expect(trigger).toBeFocused();
});

test('neighbouring dates are quieter, select correctly and retain panel focus', async ({
  page,
}) => {
  const picker = page.locator('#booking-date');
  const trigger = picker.locator('.rv-datepicker-trigger');
  await trigger.click();
  const current = picker.locator('[data-date="2026-11-10"]');
  const outside = picker.locator('.rv-calendar-day--outside').last();
  const color = await current.evaluate((element) => getComputedStyle(element).color);
  const outsideColor = await outside.evaluate((element) => getComputedStyle(element).color);
  expect(outsideColor).not.toBe(color);
  const date = await outside.getAttribute('data-date');
  await outside.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const selected = picker.locator('[aria-selected="true"]');
  await expect(selected).toHaveAttribute('data-date', date!);
  await expect(selected).toBeFocused();
  await picker.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
