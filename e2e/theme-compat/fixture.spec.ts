import { expect, test } from '@playwright/test';

const configuration = process.env['RV_THEME_CONFIG'] ?? 'plain';

async function resolvedTokenColor(locator: import('@playwright/test').Locator, token = '--rv-bg') {
  return locator.evaluate((element, property) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${property})`;
    element.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

test('loads the isolated consumer fixture', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Theme compatibility fixture' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Booking status/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Booking date/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Appointment:/ })).toBeVisible();
});

test('opens Select and both Datepicker panels as native popovers', async ({ page }) => {
  await page.goto('/');

  const dateTrigger = page.locator('#booking-date').getByRole('button', { name: /^Booking date/ });
  await dateTrigger.click();
  const datePanel = page.locator('#booking-date .rv-datepicker-panel');
  await expect(datePanel).toBeVisible();
  await expect(datePanel.getByRole('grid')).toBeVisible();
  expect(await datePanel.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  await expect(datePanel.locator('[role="gridcell"][aria-selected="true"]')).toHaveCount(1);
  await expect(datePanel.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(datePanel).toBeHidden();
  await expect(dateTrigger).toBeFocused();

  const datetimeTrigger = page
    .locator('#appointment-12-hour')
    .getByRole('button', { name: /^Appointment:/ });
  await datetimeTrigger.click();
  const datetimePanel = page.locator('#appointment-12-hour .rv-datetimepicker-panel');
  await expect(datetimePanel).toBeVisible();
  await expect(datetimePanel.locator('.rv-time-row')).toBeVisible();
  await expect(datetimePanel.locator('.rv-time-second')).toHaveCount(1);
  await expect(datetimePanel.locator('.rv-time-meridiem')).toBeVisible();
  await expect(datetimePanel.locator('.rv-time-hour')).toHaveAttribute('aria-valuemax', '12');
  expect(await datetimePanel.evaluate((element) => element.matches(':popover-open'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(datetimePanel).toBeHidden();

  const selectTrigger = page.locator('#booking-select').getByRole('button', { name: /Booking status/ });
  await selectTrigger.click();
  const selectPanel = page.locator('#booking-select .rv-select-popup-panel');
  await expect(selectPanel).toBeVisible();
  expect(await selectPanel.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  await expect(selectPanel.getByRole('menuitemradio', { name: 'Draft' })).toBeVisible();
  await expect(selectPanel.getByRole('menuitemradio', { name: 'Cancelled' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(selectPanel).toBeHidden();
});

test('keeps semantic, scoped and instance tokens through native top-layer popovers', async ({ page }) => {
  await page.goto('/');
  const rootBackground = await resolvedTokenColor(page.locator('html'));
  const scopedBackground = await resolvedTokenColor(page.getByTestId('booking-scope'));
  expect(scopedBackground).toBe('rgb(218, 235, 255)');
  expect(scopedBackground).not.toBe(rootBackground);

  const scopedDateTrigger = page.locator('#booking-date').getByRole('button', { name: /^Booking date/ });
  await scopedDateTrigger.click();
  const scopedDatePanel = page.locator('#booking-date .rv-datepicker-panel');
  await expect(scopedDatePanel).toBeVisible();
  await expect
    .poll(() => scopedDatePanel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(218, 235, 255)');
  await page.keyboard.press('Escape');

  const instanceDateTrigger = page.locator('#instance-date').getByRole('button', { name: /^Instance date/ });
  await instanceDateTrigger.click();
  const instanceDatePanel = page.locator('#instance-date .rv-datepicker-panel');
  await expect(instanceDatePanel).toBeVisible();
  await expect
    .poll(() => instanceDatePanel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(255, 224, 224)');
  await page.keyboard.press('Escape');

  const instanceSelectTrigger = page
    .locator('#instance-select')
    .getByRole('button', { name: /Instance status/ });
  await instanceSelectTrigger.click();
  const instanceSelectPanel = page.locator('#instance-select .rv-select-popup-panel');
  await expect(instanceSelectPanel).toBeVisible();
  await expect
    .poll(() => instanceSelectPanel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(255, 224, 224)');
  await page.keyboard.press('Escape');
});

test('retains DateTime business values when editing a seconds-enabled 24-hour control', async ({ page }) => {
  await page.goto('/');

  const trigger = page
    .locator('#appointment-24-hour')
    .getByRole('button', { name: /^Appointment 24 hour:/ });
  await trigger.click();
  const panel = page.locator('#appointment-24-hour .rv-datetimepicker-panel');
  const hour = panel.locator('.rv-time-hour');
  await expect(hour).toHaveAttribute('aria-valuemax', '23');
  await expect(panel.locator('.rv-time-second')).toHaveCount(1);
  await expect(panel.locator('.rv-time-meridiem')).toHaveCount(0);

  await hour.fill('22');
  await panel.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('appointment-24-value')).toHaveText('22:5:7');
  await expect(panel).toBeHidden();
});

test('keeps overlays within a narrow RTL viewport and exposes focus-visible styling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');

  const trigger = page.locator('#rtl-select').getByRole('button', { name: 'الحالة' });
  await trigger.focus();
  await expect(trigger).toBeFocused();
  const outlineStyle = await trigger.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outlineStyle).not.toBe('none');
  await trigger.click();
  const panel = page.locator('#rtl-select .rv-select-popup-panel');
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');

  const dateTrigger = page.locator('#rtl-date').getByRole('button', { name: /^التاريخ/ });
  await dateTrigger.click();
  const datePanel = page.locator('#rtl-date .rv-datepicker-panel');
  await expect(datePanel).toBeVisible();
  const dateBounds = await datePanel.boundingBox();
  expect(dateBounds).not.toBeNull();
  expect(dateBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dateBounds!.x + dateBounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('applies dark and light themes at the root and scoped Bootstrap boundary', async ({ page }) => {
  await page.goto('/');

  if (configuration === 'bootstrap') {
    const root = page.locator('html');
    const defaultScope = page.getByTestId('default-scope');
    await root.evaluate((element) => element.setAttribute('data-bs-theme', 'dark'));
    const rootDark = await resolvedTokenColor(root);
    const scopedLight = await resolvedTokenColor(defaultScope);
    expect(rootDark).toBe('rgb(33, 37, 41)');
    expect(scopedLight).toBe('rgb(255, 255, 255)');
    expect(scopedLight).not.toBe(rootDark);

    const bookingScope = page.getByTestId('booking-scope');
    await bookingScope.evaluate((element) => element.setAttribute('data-bs-theme', 'dark'));
    await expect.poll(() => resolvedTokenColor(bookingScope)).toBe(rootDark);
    await expect
      .poll(() => resolvedTokenColor(defaultScope))
      .toBe(scopedLight);
  } else {
    const root = page.locator('html');
    const bookingScope = page.getByTestId('booking-scope');
    await root.evaluate((element) => element.setAttribute('data-rv-theme', 'dark'));
    await expect.poll(() => resolvedTokenColor(root)).toBe('rgb(22, 22, 22)');
    await expect
      .poll(() => resolvedTokenColor(bookingScope))
      .toBe('rgb(218, 235, 255)');

    await root.evaluate((element) => element.setAttribute('data-rv-theme', 'light'));
    await expect.poll(() => resolvedTokenColor(root)).toBe('rgb(255, 255, 255)');
  }
});

test('emits usable Tailwind v4 utilities only in Tailwind configurations', async ({ page }) => {
  test.skip(!configuration.startsWith('tailwind'), 'This browser assertion is specific to Tailwind builds.');
  await page.goto('/');

  const selector = configuration === 'tailwind-prefix' ? '#tailwind-prefix-probe' : '#tailwind-utility-probe';
  const probe = page.locator(selector);
  await expect(probe).toBeVisible();
  await expect(probe).toHaveCSS('padding', '16px');
  const probeBackground = await probe.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(probeBackground).toBe('rgb(255, 255, 255)');
});
