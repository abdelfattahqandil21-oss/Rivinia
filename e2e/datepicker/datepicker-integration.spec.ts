import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

for (const { id, confirm } of [
  { id: 'booking-date', confirm: '.rv-datepicker-ok' },
  { id: 'appointment-12-hour', confirm: '.rv-datetimepicker-apply' },
]) {
  test(`${id} closes on disable and reopens with the committed date`, async ({ page }) => {
    const picker = page.locator(`#${id}`);
    const trigger = picker.locator('.rv-datepicker-trigger');
    const panel = picker.locator('.rv-datepicker-panel');
    const nextDay = panel.locator('[data-date="2026-11-10"]');
    const toggle = page.getByTestId('toggle-pickers-disabled');
    const before = await trigger.innerText();

    await trigger.click();
    await nextDay.click();
    await expect(nextDay).toHaveAttribute('aria-selected', 'true');
    await expect(trigger).toHaveText(before);

    // Disable through the input binding while focus is still inside the popup.
    await toggle.evaluate((button: HTMLButtonElement) => button.click());
    await expect(trigger).toBeDisabled();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCount(0);
    await expect(trigger).not.toBeFocused();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveText(before);

    await toggle.click();
    await expect(trigger).toBeEnabled();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(panel.locator('[data-date="2026-11-09"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await nextDay.click();
    await panel.locator(confirm).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveText(before);
    await expect(trigger).toBeFocused();
  });
}

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

test('the time tray aligns each list with its input and keeps the clock after AM/PM', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  const picker = page.locator('#appointment-12-hour');
  const trigger = picker.locator('.rv-datepicker-trigger');
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await trigger.click();
  const clock = picker.locator('.rv-time-toggle');
  const meridiem = picker.locator('.rv-time-meridiem');
  expect(await clock.evaluate((button) => button.previousElementSibling?.className)).toBe(
    'rv-time-meridiem',
  );
  const clockBox = await clock.boundingBox();
  const meridiemBox = await meridiem.boundingBox();
  expect(clockBox!.x).toBeGreaterThanOrEqual(meridiemBox!.x + meridiemBox!.width - 1);
  await clock.click();
  for (const unit of ['Hour', 'Minute', 'Second']) {
    const input = picker.getByRole('spinbutton', { name: unit, exact: true });
    const list = picker.getByRole('listbox', { name: unit, exact: true });
    await expect(list).toBeVisible();
    const field = await input.boundingBox();
    const column = await list.boundingBox();
    expect(field!.width).toBeGreaterThanOrEqual(48);
    expect(column!.width).toBeGreaterThanOrEqual(48);
    expect(Math.abs(column!.x + column!.width / 2 - (field!.x + field!.width / 2))).toBeLessThan(2);
    await expect(list).toHaveCSS('scrollbar-width', 'none');
    await expect(list).toHaveCSS('border-width', '0px');
  }
  const tray = picker.locator('.rv-time-options');
  await expect(tray).toHaveCSS('border-width', '1px');
  await expect(tray).toHaveCSS('border-radius', '8px');
});

test('month and year options keep readable hover contrast and animate between views', async ({
  page,
}) => {
  const picker = page.locator('#booking-date');
  await picker.locator('.rv-datepicker-trigger').click();
  await picker.locator('.rv-calendar-heading').click();
  const months = picker.locator('.rv-calendar-options');
  await expect
    .poll(() =>
      months.evaluate((element) =>
        getComputedStyle(element).animationName.includes('rv-calendar-view-enter'),
      ),
    )
    .toBe(true);
  const december = months.locator('.rv-calendar-option').filter({ hasText: 'December' });
  await december.hover();
  const monthColors = await december.evaluate((option) => {
    const style = getComputedStyle(option);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(monthColors.color).not.toBe('rgb(255, 255, 255)');
  expect(monthColors.background).not.toBe('rgba(0, 0, 0, 0)');

  await picker.locator('.rv-calendar-heading').click();
  const years = picker.locator('.rv-calendar-options');
  await expect
    .poll(() =>
      years.evaluate((element) =>
        getComputedStyle(element).animationName.includes('rv-calendar-view-enter'),
      ),
    )
    .toBe(true);
  const nextYear = years.locator('.rv-calendar-option').filter({ hasText: '2027' });
  await nextYear.hover();
  const yearColor = await nextYear.evaluate((option) => getComputedStyle(option).color);
  expect(yearColor).not.toBe('rgb(255, 255, 255)');
});

test('the time tray keeps each column independently scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const picker = page.locator('#appointment-12-hour');
  const trigger = picker.locator('.rv-datepicker-trigger');
  const clock = picker.locator('.rv-time-toggle');
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await trigger.click();
  await expect(clock).toBeInViewport();
  await clock.click();

  const minutes = picker.getByRole('listbox', { name: 'Minute' });
  const hours = picker.getByRole('listbox', { name: 'Hour' });
  const selectedMinute = minutes.locator('[aria-selected="true"]');
  await expect.poll(() => minutes.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  await expect(selectedMinute).toBeInViewport();
  const initialScroll = await minutes.evaluate((list) => list.scrollTop);
  expect(initialScroll).toBeGreaterThan(0);

  const pageOffset = await page.evaluate(() => window.scrollY);
  await minutes.hover();
  await page.mouse.wheel(0, -200);
  await expect.poll(() => minutes.evaluate((list) => list.scrollTop)).toBeLessThan(initialScroll);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageOffset);

  await minutes.evaluate((list) => {
    list.scrollTop = 0;
  });
  await hours.getByRole('option', { name: '02, 2 PM', exact: true }).click();
  await expect(hours.locator('[aria-selected="true"]')).toHaveText('02');
  expect(await minutes.evaluate((list) => list.scrollTop)).toBe(0);

  const firstMinute = minutes.getByRole('option').first();
  await firstMinute.press('End');
  await expect(minutes.getByRole('option').last()).toBeFocused();
  await expect(minutes.getByRole('option').last()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(pageOffset);
  await page.keyboard.press('Escape');
  await expect(clock).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

test('the date-time OK hover keeps readable foreground contrast', async ({ page }) => {
  const picker = page.locator('#appointment-12-hour');
  await picker.locator('.rv-datepicker-trigger').click();
  const ok = picker.locator('.rv-datetimepicker-ok');
  await ok.hover();
  const ratio = await ok.evaluate((button) => {
    const toRgb = (value: string): [number, number, number] => {
      const match = value.match(/\d+(?:\.\d+)?/g) ?? [];
      const channels = [Number(match[0]), Number(match[1]), Number(match[2])] as const;
      return value.startsWith('color(srgb')
        ? channels.map((channel) => channel * 255) as [number, number, number]
        : [...channels];
    };
    const luminance = (value: string): number => {
      const [r, g, b] = toRgb(value).map((part) => {
        const channel = part / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const style = getComputedStyle(button);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
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
  await expect(panel.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'OK', exact: true })).toBeVisible();
  await panel.locator('[data-date="2026-11-15"]').click();
  await expect(trigger).toHaveText(before);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(trigger).toHaveText(before);
  await trigger.click();
  await picker.locator('[data-date="2026-11-15"]').click();
  await picker.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(trigger).toContainText('Nov 15, 2026');
  await expect(trigger).toBeFocused();
});

test('Clear is an icon with a localized text tooltip', async ({ page }) => {
  const picker = page.locator('#booking-date');
  await picker.locator('.rv-datepicker-trigger').click();
  const clear = picker.locator('.rv-datepicker-clear-action');
  await expect(clear).toHaveText('');
  await expect(clear.locator('svg')).toBeVisible();
  await expect(clear).toHaveAttribute('aria-label', 'Booking date: Clear date');
  await clear.hover();
  await expect
    .poll(() => clear.evaluate((button) => getComputedStyle(button, '::after').content))
    .toContain('Clear date');
  await clear.click();
  await expect(picker.locator('.rv-datepicker-panel')).toBeVisible();
  await picker.locator('.rv-datepicker-ok').click();
  await expect(picker.locator('.rv-datepicker-panel')).toHaveCount(0);
  await expect(picker.locator('.rv-datepicker-trigger')).toHaveAccessibleName(
    'Booking date: Choose date',
  );
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
  await picker.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
