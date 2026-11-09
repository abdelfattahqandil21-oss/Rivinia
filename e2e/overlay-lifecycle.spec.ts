import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

  test('Enter on a footer Menu trigger opens only that Menu', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    await expect(selectMenu).toBeVisible();

    const footerTrigger = page.locator('#select-footer-menu-trigger');
    await footerTrigger.focus();
    await page.keyboard.press('Enter');
    const footerMenu = page.getByRole('menu', { name: 'Select footer menu' });
    await expect(footerMenu).toBeVisible();
    await expect(selectMenu).toBeVisible();
    await expect(selectTrigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('Space on a footer Menu trigger opens only that Menu', async ({ page }) => {
    await page.locator('#overlay-select .rv-select-trigger').click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    const footerTrigger = page.locator('#select-footer-menu-trigger');
    await footerTrigger.focus();

    await page.keyboard.press('Space');

    await expect(page.getByRole('menu', { name: 'Select footer menu' })).toBeVisible();
    await expect(selectMenu).toBeVisible();
  });

  test('a footer Menu owns its arrow keys', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    await expect(selectMenu).toBeVisible();
    const footerTrigger = page.locator('#select-footer-menu-trigger');
    await footerTrigger.focus();
    await page.keyboard.press('Enter');
    const footerMenu = page.getByRole('menu', { name: 'Select footer menu' });
    await expect(footerMenu).toBeVisible();
    const footerItem = page.getByRole('menuitem', { name: 'Footer menu item' });
    await expect(footerItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(footerItem).toBeFocused();
    await expect(footerItem).toHaveAttribute('data-active', 'true');
    await expect(selectMenu).toBeVisible();
  });

  test('Enter in a footer Menu activates one child row only', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    await page.locator('#select-footer-menu-trigger').focus();
    await page.keyboard.press('Enter');
    const footerItem = page.getByRole('menuitem', { name: 'Footer menu item' });
    await expect(footerItem).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('menu', { name: 'Select footer menu' })).toHaveCount(0);
    await expect(selectMenu).toBeVisible();
    await expect(selectTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitemradio', { name: 'One' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('Select semantics keep the projected Menu footer outside the option menu', async ({
    page,
  }) => {
    const trigger = page.locator('#overlay-select .rv-select-trigger');
    await trigger.click();
    const panel = page.locator('#overlay-select .rv-select-popup-panel');
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    const search = page.getByRole('searchbox', { name: 'Search options' });
    const footer = page.locator('#overlay-select [rv-select-popup-footer]');

    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', await selectMenu.getAttribute('id'));
    await expect(trigger).not.toHaveAttribute('role', 'combobox');
    await expect(search).toHaveAttribute('aria-label', 'Search options');
    await expect(page.getByRole('menuitemradio', { name: 'One' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(
      await selectMenu.evaluate((menu, node) => menu.contains(node), await footer.elementHandle()),
    ).toBe(false);
    await expect(page.getByRole('button', { name: 'Footer action' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Footer filter' })).toBeVisible();
    await expect(selectMenu.getByRole('button', { name: 'Footer action' })).toHaveCount(0);
    await expect(selectMenu.getByRole('textbox', { name: 'Footer filter' })).toHaveCount(0);
    await expect(panel.locator('[aria-activedescendant]')).toHaveCount(0);

    if (page.context().browser()?.browserType().name() === 'chromium') {
      const client = await page.context().newCDPSession(page);
      const ax = (await client.send('Accessibility.getFullAXTree')) as {
        nodes: Array<{
          nodeId: string;
          parentId?: string;
          role?: { value?: string };
          name?: { value?: string };
        }>;
      };
      const actionNode = ax.nodes.find(
        (node) => node.role?.value === 'button' && node.name?.value === 'Footer action',
      );
      const filterNode = ax.nodes.find(
        (node) => node.role?.value === 'textbox' && node.name?.value === 'Footer filter',
      );
      expect(actionNode).toBeDefined();
      expect(filterNode).toBeDefined();
      const parents = new Map(ax.nodes.map((node) => [node.nodeId, node]));
      for (const control of [actionNode, filterNode]) {
        let parent = control?.parentId ? parents.get(control.parentId) : undefined;
        while (parent) {
          expect(parent.role?.value).not.toBe('menu');
          parent = parent.parentId ? parents.get(parent.parentId) : undefined;
        }
      }
      await client.detach();
    }

    await page.locator('#select-footer-menu-trigger').click();
    const results = await new AxeBuilder({ page }).include('#overlay-select').analyze();
    expect(results.violations).toEqual([]);
  });

  test('plain projected button and input retain their own keyboard behavior', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    const firstOption = page.getByRole('menuitemradio', { name: 'One' });
    const footerAction = page.getByRole('button', { name: 'Footer action' });
    const footerFilter = page.getByRole('textbox', { name: 'Footer filter' });

    await expect(firstOption).toHaveAttribute('data-active', 'true');
    await footerAction.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(selectMenu).toBeVisible();
    await expect(selectTrigger).toContainText('Select');
    await expect(firstOption).toHaveAttribute('data-active', 'true');

    await footerFilter.focus();
    await footerFilter.fill('local query');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(selectMenu).toBeVisible();
    await expect(selectTrigger).toContainText('Select');
    await expect(page.locator('#overlay-select .rv-select-search')).toHaveValue('');

    const results = await new AxeBuilder({ page }).include('#overlay-select').analyze();
    expect(results.violations).toEqual([]);
  });

  test('Tab traverses the filter, Select row and footer before dismissing', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const panel = page.locator('#overlay-select .rv-select-popup-panel');
    const search = page.getByRole('searchbox', { name: 'Search options' });
    const firstOption = page.getByRole('menuitemradio', { name: 'One' });
    const footerTrigger = page.locator('#select-footer-menu-trigger');
    const footerAction = page.getByRole('button', { name: 'Footer action' });
    const footerFilter = page.getByRole('textbox', { name: 'Footer filter' });
    const afterSelect = page.locator('#after-select');

    await expect(search).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstOption).toBeFocused();
    await expect(page.locator('#overlay-select [role="menuitemradio"][tabindex="0"]')).toHaveCount(
      1,
    );
    await page.keyboard.press('Tab');
    await expect(footerTrigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(footerAction).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(footerFilter).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(footerAction).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(footerTrigger).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(firstOption).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(footerTrigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(footerAction).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(footerFilter).toBeFocused();
    await page.keyboard.press('Tab');

    await expect(afterSelect).toBeFocused();
    await expect(panel).toHaveCount(0);
    await expect(selectTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Shift+Tab from the filter closes the panel onto its trigger', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    await expect(page.getByRole('searchbox', { name: 'Search options' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');

    await expect(selectTrigger).toBeFocused();
    await expect(selectTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Shift+Tab in a footer Menu returns to the Select without closing it', async ({ page }) => {
    const selectTrigger = page.locator('#overlay-select .rv-select-trigger');
    await selectTrigger.click();
    const selectMenu = page.getByRole('menu', { name: 'Overlay select' });
    await expect(selectMenu).toBeVisible();
    await page.locator('#select-footer-menu-trigger').click();
    const footerItem = page.getByRole('menuitem', { name: 'Footer menu item' });
    await footerItem.focus();

    await page.keyboard.press('Shift+Tab');

    await expect(page.getByRole('menu', { name: 'Select footer menu' })).toHaveCount(0);
    await expect(selectMenu).toBeVisible();
    await expect(page.locator('#overlay-select .rv-select-popup-panel :focus')).toHaveCount(1);
  });

  test('Tab from a footer Menu continues through footer controls before leaving Select', async ({
    page,
  }) => {
    await page.locator('#overlay-select .rv-select-trigger').click();
    await page.locator('#select-footer-menu-trigger').click();
    await page.getByRole('menuitem', { name: 'Footer menu item' }).focus();

    await page.keyboard.press('Tab');

    await expect(page.getByRole('menu', { name: 'Select footer menu' })).toHaveCount(0);
    await expect(page.getByRole('menu', { name: 'Overlay select' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Footer action' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Footer filter' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after-select')).toBeFocused();
    await expect(page.locator('#overlay-select .rv-select-popup-panel')).toHaveCount(0);
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
