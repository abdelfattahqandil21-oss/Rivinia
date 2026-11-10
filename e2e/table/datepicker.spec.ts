import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Pacific/Apia' });

test('renders a date-only value unchanged when the host timezone skipped that day', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  await page.getByTestId('set-samoa-date').click();

  const trigger = page.locator('rv-datepicker button.rv-datepicker-trigger');
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 30/12/2011');
  await trigger.click();

  const grid = page.getByRole('dialog').getByRole('grid');
  const skippedDay = grid.locator('[data-date="2011-12-30"]');
  await expect(skippedDay).toContainText('30');
  await expect(skippedDay).toHaveAttribute('aria-label', /Friday.*December 30, 2011/);
});

test('updates locale, week start, direction and labels while open without changing the date', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();

  const trigger = page.locator('rv-datepicker button.rv-datepicker-trigger');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const grid = dialog.getByRole('grid');
  const firstWeekday = grid.locator('thead th').first();

  await expect(firstWeekday).toHaveAttribute('abbr', 'Sunday');
  await expect(dialog.locator('.rv-calendar-heading-text')).toHaveText('January 2026');

  await page
    .getByTestId('toggle-date-locale')
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(firstWeekday).toHaveAttribute('abbr', 'السبت');
  await expect(dialog.locator('.rv-calendar-heading-text')).toHaveText('يناير ٢٠٢٦');

  const selected = grid.locator('[data-date="2026-01-15"]');
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(selected).toContainText('١٥');
  await expect(trigger).toHaveAttribute('aria-label', /١٥\/٠١\/٢٠٢٦/);

  await selected.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(grid.locator('[data-date="2026-01-16"]')).toBeFocused();
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(trigger).toHaveAttribute('aria-label', /١٥\/٠١\/٢٠٢٦/);

  await page
    .getByTestId('toggle-date-locale')
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');
  await expect(firstWeekday).toHaveAttribute('abbr', 'Sunday');
  await expect(dialog.locator('.rv-calendar-heading-text')).toHaveText('January 2026');
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 15/01/2026');
});

test('supports calendar keyboard navigation and restores focus on Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  await page.getByTestId('prepare-date-navigation').click();
  const trigger = page.locator('rv-datepicker button.rv-datepicker-trigger');
  await trigger.click();

  const dialog = page.getByRole('dialog');
  const grid = dialog.getByRole('grid');
  const cell = (isoDate: string) => grid.locator(`[data-date="${isoDate}"]`);
  await expect(grid).toHaveAccessibleName('January 2026');
  await expect(cell('2026-01-15')).toBeFocused();

  await page.keyboard.press('PageDown');
  await expect(cell('2026-02-15')).toBeFocused();
  await page.keyboard.press('Shift+PageUp');
  await expect(cell('2025-02-15')).toBeFocused();
  await expect(dialog.locator('.rv-calendar-heading-text')).toHaveText('February 2025');
  await page.keyboard.press('Home');
  await expect(cell('2025-02-09')).toBeFocused();
  await page.keyboard.press('End');
  await expect(cell('2025-02-15')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 15/01/2026');
});

test('synchronizes a Reactive Forms control in the built consumer', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  await page.getByTestId('show-datepicker-form').click();
  await page.getByTestId('set-form-date').click();

  const form = page.getByTestId('datepicker-form-audit');
  const trigger = form.locator('rv-datepicker button.rv-datepicker-trigger');
  await expect(trigger).toHaveAttribute('aria-label', 'Form date: Feb 10, 2026');
  await expect(page.getByTestId('form-date-state')).toHaveText(
    '2026-02-10|dirty=false|touched=false',
  );

  await trigger.click();
  const dialog = page.getByRole('dialog');
  const grid = dialog.getByRole('grid');
  await expect(dialog.locator('.rv-calendar-heading-text')).toHaveText('February 2026');
  await grid.locator('[data-date="2026-02-17"]').click();

  await expect(trigger).toHaveAttribute('aria-label', 'Form date: Feb 17, 2026');
  await expect(page.getByTestId('form-date-state')).toHaveText(
    '2026-02-17|dirty=true|touched=true',
  );
});

test('disabled dates remain focusable but cannot be committed by keyboard or pointer', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('show-performance').click();
  await page.getByTestId('restrict-date-range').click();

  const trigger = page.locator('rv-datepicker button.rv-datepicker-trigger');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const grid = dialog.getByRole('grid');
  const beforeMin = grid.locator('[data-date="2026-01-14"]');
  const min = grid.locator('[data-date="2026-01-15"]');
  const max = grid.locator('[data-date="2026-01-16"]');
  const afterMax = grid.locator('[data-date="2026-01-17"]');
  const pastExpandedMax = grid.locator('[data-date="2026-01-19"]');

  await expect(beforeMin).toHaveAttribute('aria-disabled', 'true');
  await expect(min).not.toHaveAttribute('aria-disabled', 'true');
  await expect(max).not.toHaveAttribute('aria-disabled', 'true');
  await expect(afterMax).toHaveAttribute('aria-disabled', 'true');

  await min.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(beforeMin).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(min).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(max).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(afterMax).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 15/01/2026');
  await page.keyboard.press('Space');
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 15/01/2026');

  await afterMax.evaluate((element) => (element as HTMLElement).click());
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 15/01/2026');
  await page.keyboard.press('ArrowLeft');
  await expect(max).toBeFocused();

  await page
    .getByTestId('expand-date-range')
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(afterMax).not.toHaveAttribute('aria-disabled', 'true');
  await expect(max).toBeFocused();
  await expect(pastExpandedMax).toHaveAttribute('aria-disabled', 'true');

  await page
    .getByTestId('clear-date-range')
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(pastExpandedMax).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(afterMax).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toHaveAttribute('aria-label', 'Filter date: 17/01/2026');
});
