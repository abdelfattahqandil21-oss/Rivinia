import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('fixed popup aligns inside an independent CSS translate ancestor', async ({ page }) => {
  await page.goto('/overlay-lifecycle');

  await page.locator('#popup-transform-enable').click();

  const host = page.locator('#popup-transform-host');
  const origin = page.locator('#popup-transform-origin');
  const panel = page.locator('#popup-transform-panel');

  // Test the independent CSS property, not transform: translate(...).
  await expect(host).toHaveCSS('transform', 'none');
  await expect(host).toHaveCSS('translate', '40px 30px');
  await expect(panel).toHaveCSS('position', 'fixed');

  const originRect = await origin.boundingBox();
  const panelRect = await panel.boundingBox();

  if (originRect === null || panelRect === null) {
    throw new Error('Origin or panel has no measurable bounding box.');
  }

  const horizontalError = Math.abs(panelRect.x - originRect.x);
  const verticalError = Math.abs(
    panelRect.y - (originRect.y + originRect.height + 8),
  );

  expect(horizontalError).toBeLessThan(2);
  expect(verticalError).toBeLessThan(2);
});

test('fixed popup aligns inside an independent CSS scale ancestor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto('/overlay-lifecycle');

  await page.locator('#popup-scale-enable').click();

  const host = page.locator('#popup-scale-host');
  const origin = page.locator('#popup-scale-origin');
  const panel = page.locator('#popup-scale-panel');

  await expect(host).toHaveCSS('transform', 'none');
  await expect(host).toHaveCSS('scale', '1.25');
  await expect(panel).toHaveCSS('position', 'fixed');

  const originRect = await origin.boundingBox();
  const panelRect = await panel.boundingBox();

  if (originRect === null || panelRect === null) {
    throw new Error('Origin or panel has no measurable bounding box.');
  }

  // Keep this geometry test away from viewport edge clamping.
  expect(originRect.x).toBeGreaterThan(20);

  const horizontalError = Math.abs(panelRect.x - originRect.x);
  const verticalError = Math.abs(
    panelRect.y - (originRect.y + originRect.height + 8),
  );

  expect(horizontalError).toBeLessThan(2);
  expect(verticalError).toBeLessThan(2);
});

test('repositions an open connected popup when document direction changes', async ({ page }) => {
  await page.goto('/overlay-lifecycle');

  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
  });

  await page.locator('#popup-transform-enable').click();

  const origin = page.locator('#popup-transform-origin');
  const panel = page.locator('#popup-transform-panel');

  const alignmentError = async (direction: 'ltr' | 'rtl') => {
    const originRect = await origin.boundingBox();
    const panelRect = await panel.boundingBox();

    if (originRect === null || panelRect === null) {
      throw new Error('Popup geometry is unavailable.');
    }

    // This test measures RTL alignment, not viewport clamping.
    expect(originRect.x).toBeGreaterThan(24);
    expect(originRect.x + originRect.width).toBeLessThan(1256);

    if (direction === 'ltr') {
      return Math.abs(panelRect.x - originRect.x);
    }

    return Math.abs(
      panelRect.x + panelRect.width -
      (originRect.x + originRect.width),
    );
  };

  await expect.poll(() => alignmentError('ltr')).toBeLessThan(2);

  // The existing open connection must react without a manual update.
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  await expect.poll(() => alignmentError('rtl')).toBeLessThan(2);

  await expect(panel).toBeVisible();
});
