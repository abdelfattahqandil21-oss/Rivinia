import { expect, test } from '@playwright/test';

test('removes document and window listeners when open projected controls are destroyed', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = new Map<string, number>();
    const targetName = (target: EventTarget) =>
      target === document ? 'document' : target === window ? 'window' : null;
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const target = targetName(this);
      if (target) {
        const key = `${target}:${type}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const target = targetName(this);
      if (target) {
        const key = `${target}:${type}`;
        counts.set(key, Math.max(0, (counts.get(key) ?? 0) - 1));
      }
      return originalRemove.call(this, type, listener, options);
    };
    Object.defineProperty(window, '__riviniaListenerCounts', {
      value: () => Object.fromEntries(counts.entries()),
    });
  });

  await page.goto('/');
  const getCounts = () =>
    page.evaluate(() => {
      const read = (window as Window & { __riviniaListenerCounts: () => Record<string, number> })
        .__riviniaListenerCounts;
      const counts = read();
      const ownedEvents = [
        'document:pointerdown',
        'document:pointermove',
        'document:pointerup',
        'document:pointercancel',
        'window:resize',
        'window:scroll',
      ];
      return Object.fromEntries(ownedEvents.map((event) => [event, counts[event] ?? 0]));
    });
  const baseline = await getCounts();

  for (let index = 0; index < 5; index++) {
    await page.getByTestId('show-performance').click();
    await page.getByTestId('page-size-control').getByRole('button').click();
    await expect(page.getByRole('menu')).toBeVisible();
    const selectOpen = await getCounts();
    expect(selectOpen['document:pointerdown']).toBeGreaterThan(
      baseline['document:pointerdown'] ?? 0,
    );

    await page
      .getByTestId('show-aria-audit')
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByRole('grid', { name: 'Audit grid' })).toBeVisible();
    await expect(await getCounts()).toEqual(baseline);

    await page.getByTestId('show-performance').click();
    await page.locator('rv-datepicker button.rv-datepicker-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const datepickerOpen = await getCounts();
    expect(datepickerOpen['document:pointerdown']).toBeGreaterThan(
      baseline['document:pointerdown'] ?? 0,
    );
    expect(datepickerOpen['window:resize']).toBeGreaterThan(baseline['window:resize'] ?? 0);

    await page
      .getByTestId('show-aria-audit')
      .evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByRole('grid', { name: 'Audit grid' })).toBeVisible();
    await expect(await getCounts()).toEqual(baseline);
  }
});
