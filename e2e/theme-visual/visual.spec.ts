import { test, expect } from '@playwright/test';

test('runs the real Rivinia Angular Toggle and changes the DOM theme', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-toggle').locator('rv-theme-toggle');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute('data-presentation', 'segmented');
  await hero.locator('[data-rv-mode="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-rv-theme', 'dark');
  await expect(page.locator('#active-mode')).toHaveText('DARK');
  const background = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
});

test('design controls update actual public component inputs', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-toggle').locator('rv-theme-toggle');
  await page.locator('#variant').selectOption('outline');
  await page.locator('#shape').selectOption('square');
  await page.locator('#size').selectOption('lg');
  await expect(hero).toHaveAttribute('data-variant', 'outline');
  await expect(hero).toHaveAttribute('data-shape', 'square');
  await expect(hero).toHaveAttribute('data-size', 'lg');
  await page.locator('#presentation').selectOption('single');
  await expect(hero).toHaveAttribute('data-presentation', 'single');
  await expect(hero.locator('.single')).toHaveCount(1);
});

test('circular reveal uses native View Transitions when available', async ({ page }) => {
  await page.addInitScript(() => {
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    const original = doc.startViewTransition?.bind(doc);
    (window as Window & { __rvNativeSupported?: boolean; __rvNativeCalls?: number }).__rvNativeSupported = !!original;
    (window as Window & { __rvNativeCalls?: number }).__rvNativeCalls = 0;
    if (original) {
      Object.defineProperty(doc, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          const w = window as Window & { __rvNativeCalls?: number };
          w.__rvNativeCalls = (w.__rvNativeCalls ?? 0) + 1;
          return original(update);
        },
      });
    }
  });
  await page.goto('/');
  await page.locator('#origin').selectOption('click');
  await page.getByTestId('hero-toggle').locator('[data-rv-mode="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-rv-theme', 'dark');
  await expect.poll(() => page.locator('html').getAttribute('data-rv-theme-transition')).toBeNull();
  const { supported, count } = await page.evaluate(() => {
    const w = window as Window & { __rvNativeSupported?: boolean; __rvNativeCalls?: number };
    return { supported: !!w.__rvNativeSupported, count: w.__rvNativeCalls ?? 0 };
  });
  if (supported) expect(count).toBeGreaterThan(0);
});

test('keyboard and RTL mode selection work on actual radios', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-toggle');
  const light = hero.locator('[data-rv-mode="light"]');
  await light.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-rv-theme', 'dark');
  await page.locator('#toggle-rtl').click();
  await page.getByTestId('hero-toggle').locator('[data-rv-mode="dark"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-rv-theme', 'light');
});

test('responsive layout does not overflow a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  await expect(page.getByTestId('hero-toggle')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
