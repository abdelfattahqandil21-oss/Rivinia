import { expect, test } from '@playwright/test';

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unexpected computed color: ${color}`);
    const [red, green, blue] = channels.map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function statusColors(page: import('@playwright/test').Page, list: string) {
  return page.locator(list + ' .rv-toast').evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row);
      return {
        kind: row.getAttribute('data-kind'),
        rail: style.borderInlineStartColor,
        background: style.backgroundColor,
      };
    }),
  );
}

async function richBackgroundsFrom(
  page: import('@playwright/test').Page,
  statusColors: string[],
): Promise<string[]> {
  return page.evaluate((colors) => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const resolved = colors.map((color) => {
      probe.style.backgroundColor = `color-mix(in srgb, ${color} 55%, #000000)`;
      return getComputedStyle(probe).backgroundColor;
    });
    probe.remove();
    return resolved;
  }, statusColors);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('keeps the status region accessible and uses built-in colors without Theme', async ({
  page,
}) => {
  const hasTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--rv-ok').trim() !== '',
  );

  test.skip(hasTheme, 'Standalone fallback is exercised by the no-Theme build.');
  await expect(page.getByRole('region', { name: 'Notifications' }).first()).toBeVisible();
  await expect(page.getByRole('status').first()).toContainText('success notification');
  const topLayerOpen = await page
    .locator('#default-list .rv-toasts')
    .evaluate((panel) => panel.matches(':popover-open'));
  expect(topLayerOpen).toBe(true);

  const regular = await statusColors(page, '#default-list');
  const rich = await statusColors(page, '#rich-list');
  expect(regular.map(({ rail }) => rail)).toEqual([
    'rgb(22, 163, 74)',
    'rgb(220, 38, 38)',
    'rgb(37, 99, 235)',
    'rgb(217, 119, 6)',
  ]);
  expect(rich.map(({ background }) => background)).toEqual(
    await richBackgroundsFrom(
      page,
      regular.map(({ rail }) => rail),
    ),
  );
});

test('resolves global, scoped, instance, and rich-color overrides independently', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--rv-ok', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--rv-danger', 'rgb(4, 5, 6)');
    document.documentElement.style.setProperty('--rv-info', 'rgb(7, 8, 9)');
    document.documentElement.style.setProperty('--rv-warning', 'rgb(10, 11, 12)');
  });

  const global = await statusColors(page, '#default-list');
  expect(global.map(({ rail }) => rail)).toEqual([
    'rgb(1, 2, 3)',
    'rgb(4, 5, 6)',
    'rgb(7, 8, 9)',
    'rgb(10, 11, 12)',
  ]);
  expect((await statusColors(page, '#rich-list')).map(({ background }) => background)).toEqual(
    await richBackgroundsFrom(
      page,
      global.map(({ rail }) => rail),
    ),
  );

  const scopedA = await statusColors(page, '#scope-a .rv-toasts');
  const scopedB = await statusColors(page, '#scope-b .rv-toasts');
  const instance = await statusColors(page, '#instance-override');
  expect(scopedA[0]?.rail).toBe('rgb(18, 52, 86)');
  expect(scopedB[0]?.rail).toBe('rgb(68, 85, 102)');
  expect(instance[0]?.rail).toBe('rgb(200, 1, 2)');
  expect(global[0]?.rail).toBe('rgb(1, 2, 3)');
  const [richScopeA] = await richBackgroundsFrom(page, [scopedA[0]!.rail]);
  const [richScopeB] = await richBackgroundsFrom(page, [scopedB[0]!.rail]);
  const [richInstance] = await richBackgroundsFrom(page, [instance[0]!.rail]);
  expect(scopedA[0]?.background).toBe(richScopeA);
  expect(scopedB[0]?.background).toBe(richScopeB);
  expect(instance[0]?.background).toBe(richInstance);
});

test('follows the Theme light and dark semantic status tokens', async ({ page }) => {
  const hasTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--rv-ok').trim() !== '',
  );

  test.skip(!hasTheme, 'Theme inheritance is exercised by the Theme-enabled build.');

  for (const mode of ['light', 'dark'] as const) {
    await page
      .locator('html')
      .evaluate((root, value) => root.setAttribute('data-rv-theme', value), mode);
    const semantic = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      document.body.append(probe);
      const colors = ['--rv-ok', '--rv-danger', '--rv-info', '--rv-warning'].map((name) => {
        probe.style.color = style.getPropertyValue(name).trim();
        return getComputedStyle(probe).color;
      });
      probe.remove();
      return colors;
    });
    const actual = await statusColors(page, '#default-list');
    expect(actual.map(({ rail }) => rail)).toEqual(semantic);
    expect((await statusColors(page, '#rich-list')).map(({ background }) => background)).toEqual(
      await richBackgroundsFrom(page, semantic),
    );
  }
});

test('rich status text, controls, icons, and focus indicators meet contrast thresholds', async ({
  page,
}) => {
  const hasTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--rv-ok').trim() !== '',
  );
  const modes = hasTheme ? ['light', 'dark'] : ['standalone'];

  for (const mode of modes) {
    if (mode !== 'standalone') {
      await page
        .locator('html')
        .evaluate((root, value) => root.setAttribute('data-rv-theme', value), mode);
    }

    const action = page.locator('#rich-list .rv-toast-action').first();
    await action.focus();
    const rows = await page.locator('#rich-list .rv-toast').evaluateAll((elements) =>
      elements.map((row) => {
        const foreground = (element: Element) => getComputedStyle(element).color;
        const message = row.querySelector('.rv-toast-message')!;
        const icon = row.querySelector('.rv-toast-icon')!;
        const buttons = [...row.querySelectorAll('button')];
        const focused = row.querySelector(':focus-visible');
        const outline = focused ? getComputedStyle(focused) : null;
        return {
          kind: row.getAttribute('data-kind'),
          background: getComputedStyle(row).backgroundColor,
          message: foreground(message),
          icon: foreground(icon),
          buttons: buttons.map(foreground),
          focusedOutline: outline
            ? {
                color: outline.outlineColor,
                style: outline.outlineStyle,
                width: outline.outlineWidth,
              }
            : null,
        };
      }),
    );

    for (const row of rows) {
      expect(
        contrastRatio(row.message, row.background),
        `${mode} ${row.kind} message foreground/background`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(row.icon, row.background),
        `${mode} ${row.kind} status icon/background`,
      ).toBeGreaterThanOrEqual(3);
      for (const button of row.buttons) {
        expect(
          contrastRatio(button, row.background),
          `${mode} ${row.kind} action/dismiss label/background`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    const focused = rows[0]?.focusedOutline;
    expect(focused?.style).toBe('solid');
    expect(Number.parseFloat(focused?.width ?? '0')).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(focused?.color ?? '', rows[0]!.background)).toBeGreaterThanOrEqual(3);
  }
});
