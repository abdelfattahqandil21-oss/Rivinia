import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * S3 — one popup conformance suite, run against BOTH popup components.
 *
 * The select popup and the menu panel are the same module twice (D86 measures
 * the duplication; extracting the shared core is post-1.0). Two independent
 * suites let one component drift while the other stays green, which is exactly
 * what happened to the close behaviors before this file existed. Every test
 * here is written once and executed per adapter, so a behavior the two
 * components disagree about fails with the disagreement in its name.
 *
 * Eight behaviors run against three hosts — the select popup and the plain menu
 * on `/select`, and the same menu with a consumer input projected into its panel
 * on `/content` — so twenty-four cases. The adapters differ in the selectors and
 * in the one thing the components genuinely do not share: whether the panel has
 * an editable element inside it.
 *
 * The last of S3's seven suite bullets — a server render that must not touch
 * `window` or `document` — is not here, because a browser cannot host one. It is
 * covered by `pnpm check:popup-ssr` (`scripts/check-popup-ssr.mjs`), which renders
 * both components with those globals undefined, so any actual use throws; see D86.
 */
type Adapter = {
  readonly name: string;
  readonly route: string;
  readonly root: string;
  readonly trigger: string;
  readonly panel: string;
  readonly row: string;
  /** An editable element inside the panel, or null when the panel has none. */
  readonly editable: string | null;
  /**
   * Further editables the host offers. The exemption tests `isContentEditable`,
   * an `<input>` and a `<textarea>`; a suite that drives only the `<input>`
   * would stay green with the other two branches deleted, so the projected host
   * drives all three.
   */
  readonly alsoEditable?: readonly string[];
};

const SELECT: Adapter = {
  name: 'select popup',
  route: '/select',
  root: '#single-select',
  trigger: '#single-select .rv-select-trigger',
  panel: '#single-select .rv-select-popup-panel',
  row: '#single-select .rv-select-popup-menu [role="menuitemradio"]',
  editable: '#single-select .rv-select-search',
};

const MENU: Adapter = {
  name: 'menu panel',
  route: '/select',
  root: '#plain-menu',
  trigger: '#plain-menu .rv-menu-trigger button',
  panel: '#plain-menu .rv-menu-panel',
  row: '#plain-menu [rvmenuitem]',
  editable: null,
};

/**
 * The same menu component with a consumer `<input>` projected into its panel
 * (`/content`), which is the ONLY host where the menu's half of the resize
 * exemption can mean anything: the built-in panel has nothing editable, so with
 * `MENU` alone the rule is tested only in the direction where it does nothing.
 * Without this adapter the exemption could be deleted from `menu-panel.ts` and
 * the suite would stay green while the README kept advertising the behavior.
 */
const PROJECTED_MENU: Adapter = {
  name: 'menu panel with a projected field',
  route: '/content',
  root: '#projected-menu',
  trigger: '#projected-menu .rv-menu-trigger button',
  panel: '#projected-menu .rv-menu-panel',
  row: '#projected-menu [rvmenuitem]',
  editable: '#projected-menu .filter',
  alsoEditable: ['#projected-menu .note', '#projected-menu .inline-note'],
};

const ADAPTERS = [SELECT, MENU, PROJECTED_MENU];

/**
 * The S4 acceptance line is a "Playwright mobile viewport test", so the resize
 * cases run at a phone's CSS width — 390 is the iPhone 13/14 logical width — and
 * assert it, because a case that quietly inherited the desktop window would
 * still pass while proving nothing about the device the rule exists for. The
 * on-screen keyboard itself is still the human item: no viewport emulation
 * opens one.
 */
const PHONE = { width: 390, height: 664 } as const;

const POPUP_GLOBALS = [
  'document:pointerdown',
  'document:pointermove',
  'document:pointerup',
  'document:pointercancel',
  'window:scroll',
  'window:resize',
  'visualViewport:scroll',
  'visualViewport:resize',
] as const;

/**
 * Wrap `addEventListener`/`removeEventListener` on the page and keep a running
 * balance of the global listeners a popup owns. Installed as an init script because
 * the app registers its listeners during boot: a script evaluated after
 * `goto()` would miss them and the balance would start from a lie.
 */
const listenerLedger = () => {
  const balance = new Map<string, number>();
  for (const key of [
    'document:pointerdown',
    'document:pointermove',
    'document:pointerup',
    'document:pointercancel',
    'window:scroll',
    'window:resize',
    'visualViewport:scroll',
    'visualViewport:resize',
  ]) {
    balance.set(key, 0);
  }
  const label = (target: EventTarget) =>
    target === window
      ? 'window'
      : target === document
        ? 'document'
        : target === window.visualViewport
          ? 'visualViewport'
          : null;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    ...rest: unknown[]
  ) {
    const owner = label(this);
    if (owner) {
      const key = `${owner}:${type}`;
      balance.set(key, (balance.get(key) ?? 0) + 1);
    }
    return add.apply(this, [type, ...rest] as Parameters<typeof add>);
  };
  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    ...rest: unknown[]
  ) {
    const owner = label(this);
    if (owner) {
      const key = `${owner}:${type}`;
      const next = (balance.get(key) ?? 0) - 1;
      balance.set(key, next);
    }
    return remove.apply(this, [type, ...rest] as Parameters<typeof remove>);
  };
  (window as unknown as Record<string, unknown>).__listenerLedger = () =>
    Object.fromEntries(balance);
  const pendingFrames = new Set<number>();
  const requestFrame = window.requestAnimationFrame.bind(window);
  const cancelFrame = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    let id = 0;
    id = requestFrame((time) => {
      pendingFrames.delete(id);
      callback(time);
    });
    pendingFrames.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pendingFrames.delete(id);
    cancelFrame(id);
  };
  (window as unknown as Record<string, unknown>).__pendingAnimationFrames = () =>
    pendingFrames.size;
};

/** A fresh page with the component under test centered in the viewport. */
async function gotoHost(page: Page, adapter: Adapter): Promise<void> {
  await page.addInitScript(listenerLedger);
  await page.goto(adapter.route);
  // Center the component rather than parking at the document bottom: the panel
  // has to be fully visible below its trigger, and Playwright scrolls into view
  // before clicking anything that is off-screen — a document scroll closes the
  // panel by design, so a harness scroll would answer the question before the
  // behavior under test ever ran.
  await page.evaluate((root) => {
    const host = document.querySelector(root);
    if (!host) throw new Error(`${root} is not on this page`);
    const box = host.getBoundingClientRect();
    scrollTo(0, window.scrollY + box.top - 180);
  }, adapter.root);
  await page.waitForTimeout(50);
}

/**
 * Give the document a scrollport before a test that scrolls it.
 *
 * `/content` ends a few lines below its toolbar, so a `scrollBy` there lands on
 * its own limit, fires no event, and the case would pass by never producing the
 * condition it claims to check. The suite appends the space rather than editing
 * the demo page: the other menu specs click around `/content`, and a document
 * that suddenly scrolls changes what those clicks do to an open panel. It runs
 * for every adapter, so all three measure the scroll rule on the same fixture.
 */
async function makeScrollable(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.id = 'rv-conformance-scrollport';
    spacer.style.height = '300vh';
    document.body.appendChild(spacer);
  });
}

/**
 * Open the host in a phone viewport and prove the viewport is the one the case
 * claims. A `setViewportSize` that a later navigation reset would leave the
 * resize rule running against a desktop window, which is not the device the
 * rule exists for.
 */
async function openOnPhone(page: Page, adapter: Adapter): Promise<void> {
  await page.setViewportSize(PHONE);
  await gotoHost(page, adapter);
  await openAndEnter(page, adapter);
  const width = await page.evaluate(() => window.innerWidth);
  if (width !== PHONE.width) {
    throw new Error(
      `the resize case is not on a phone viewport: innerWidth ${width}, expected ${PHONE.width}`,
    );
  }
}

/** Pointer-open, then step into the rows the way a keyboard user would. */
async function openAndEnter(page: Page, adapter: Adapter): Promise<void> {
  await page.locator(adapter.trigger).click();
  await expect(page.locator(adapter.panel)).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.locator(`${adapter.root} [data-active="true"]`).first().waitFor();
}

/** Keyboard-open: focus the trigger and press Enter. */
async function openFromKeyboard(page: Page, adapter: Adapter): Promise<void> {
  await page.locator(adapter.trigger).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(adapter.panel)).toBeVisible();
}

/**
 * Resize while keeping the anchor inside the visual viewport. Per D99, page
 * scroll repositions an anchored popup and dismisses it only after the trigger
 * leaves the viewport; a changed scrollY alone is not a dismissal cause.
 */
async function resizeWithAnchorInViewport(
  page: Page,
  adapter: Adapter,
  width: number,
  height: number,
): Promise<void> {
  await page.evaluate(
    ({ triggerSelector, panelSelector }) => {
      const trace: Array<{ event: string; panelOpen: boolean; triggerOutsideViewport: boolean }> =
        [];
      const record = (event: string) => {
        const trigger = document.querySelector(triggerSelector)?.getBoundingClientRect();
        const panel = document.querySelector(panelSelector);
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const right = left + (viewport?.width ?? innerWidth);
        const bottom = top + (viewport?.height ?? innerHeight);
        trace.push({
          event,
          panelOpen: panel?.matches(':popover-open') ?? false,
          triggerOutsideViewport:
            !trigger ||
            trigger.right <= left ||
            trigger.left >= right ||
            trigger.bottom <= top ||
            trigger.top >= bottom,
        });
      };
      window.addEventListener('scroll', () => record('window'), true);
      document.addEventListener('scroll', () => record('document'), true);
      window.visualViewport?.addEventListener('scroll', () => record('visualViewport'), true);
      (window as unknown as Record<string, unknown>).__popupResizeScrollTrace = trace;
    },
    { triggerSelector: adapter.trigger, panelSelector: adapter.panel },
  );

  const snapshot = () =>
    page.evaluate((triggerSelector) => {
      const rect = (element: Element | null) => {
        if (!element) return null;
        const {
          x,
          y,
          width: elementWidth,
          height: elementHeight,
        } = element.getBoundingClientRect();
        return { x, y, width: elementWidth, height: elementHeight };
      };
      const active = document.activeElement;
      const panel = active?.closest('.rv-menu-panel, .rv-select-popup-panel') ?? null;
      const trigger = document.querySelector(triggerSelector);
      const triggerBox = trigger?.getBoundingClientRect() ?? null;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? innerWidth);
      const bottom = top + (viewport?.height ?? innerHeight);
      return {
        window: { width: innerWidth, height: innerHeight, scrollY },
        visualViewport: window.visualViewport
          ? {
              width: visualViewport.width,
              height: visualViewport.height,
              offsetTop: visualViewport.offsetTop,
              pageTop: visualViewport.pageTop,
            }
          : null,
        document: {
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        active: active
          ? {
              tag: active.tagName,
              id: active.id,
              className: (active as HTMLElement).className,
              rect: rect(active),
            }
          : null,
        trigger: rect(trigger),
        triggerOutsideViewport:
          !triggerBox ||
          triggerBox.right <= left ||
          triggerBox.left >= right ||
          triggerBox.bottom <= top ||
          triggerBox.top >= bottom,
        panel: rect(panel),
      };
    }, adapter.trigger);
  const before = await snapshot();
  await page.setViewportSize({ width, height });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const scrollTrace = await page.evaluate(
    () =>
      (window as unknown as Record<string, unknown>).__popupResizeScrollTrace as Array<{
        event: string;
        panelOpen: boolean;
        triggerOutsideViewport: boolean;
      }>,
  );
  const scrollDismissals = scrollTrace.filter(
    (event) => event.panelOpen && event.triggerOutsideViewport,
  );
  if (scrollDismissals.length > 0) {
    throw new Error(
      `viewport resizing scrolled the open Popup's trigger out of view; scroll could dismiss it; events=${JSON.stringify(scrollDismissals)}`,
    );
  }
  const after = await snapshot();
  if (after.triggerOutsideViewport) {
    throw new Error(
      `the viewport change moved the trigger outside the visual viewport; scroll could dismiss the popup; geometry=${JSON.stringify({ before, after })}`,
    );
  }
}

function activeElementKind(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return 'body';
    if (element.matches('.rv-select-trigger')) return 'select-trigger';
    if (element.matches('.rv-menu-trigger button')) return 'menu-trigger';
    return element.tagName.toLowerCase();
  });
}

async function settlePopupMotion(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate(async (panel) => {
    await Promise.all(
      panel.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

for (const adapter of ADAPTERS) {
  test.describe(`popup conformance: ${adapter.name}`, () => {
    test('outside pointerdown closes without stealing focus back to the trigger', async ({
      page,
    }) => {
      await gotoHost(page, adapter);
      await openAndEnter(page, adapter);
      // Focus is inside the panel, so a close that "restores" it would land it
      // on the trigger. The pointer is heading somewhere else entirely, and the
      // browser must keep it there (APG non-modal, WCAG focus-visible).
      expect(await activeElementKind(page)).not.toBe('body');

      // A raw pointer event at an empty corner of the page. `locator.click()`
      // on any element outside the fold scrolls the document first, and that
      // scroll closes the panel — the test would then measure the scroll rule
      // while claiming to measure the pointerdown rule.
      const size = page.viewportSize();
      if (!size) throw new Error('the test has no viewport to click in');
      await page.mouse.click(2, size.height - 8);

      await expect(page.locator(adapter.panel)).toHaveCount(0);
      const after = await activeElementKind(page);
      expect(after).not.toContain('trigger');
    });

    test('Escape closes and returns focus to the trigger', async ({ page }) => {
      await gotoHost(page, adapter);
      await openFromKeyboard(page, adapter);

      // The precondition the restore needs: focus must have LEFT the trigger.
      // Opening from the keyboard leaves it there until the deferred focus
      // lands, so without this the final assertion would also be true with the
      // restore code deleted — the focus would simply never have moved.
      await expect
        .poll(() => activeElementKind(page), {
          message: 'Escape can only prove a restore if opening moved focus into the panel',
        })
        .not.toContain('trigger');

      await page.keyboard.press('Escape');

      await expect(page.locator(adapter.panel)).toHaveCount(0);
      expect(await activeElementKind(page)).toContain('trigger');
    });

    test('page scroll keeps the panel attached while its trigger stays visible', async ({
      page,
    }) => {
      await gotoHost(page, adapter);
      await makeScrollable(page);
      await openAndEnter(page, adapter);
      const panel = page.locator(adapter.panel);
      await settlePopupMotion(page, adapter.panel);
      const before = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            scrollY,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );

      await page.evaluate(() => window.scrollBy(0, 40));
      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);
      const after = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            scrollY,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );
      expect(after.scrollY).toBeGreaterThan(before.scrollY);
      expect(after.triggerTop).toBeLessThan(before.triggerTop);
      expect(Math.abs(after.gap - before.gap)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(after.panelTop - before.panelTop - (after.triggerTop - before.triggerTop)),
      ).toBeLessThanOrEqual(1);
    });

    test('scrolling the trigger completely out of view closes it', async ({ page }) => {
      await gotoHost(page, adapter);
      await makeScrollable(page);
      await openAndEnter(page, adapter);
      const trigger = page.locator(adapter.trigger);
      await page.evaluate(() => window.scrollBy(0, 600));
      const box = await trigger.boundingBox();
      const viewportHeight = page.viewportSize()?.height ?? 0;
      if (!box || (box.bottom > 0 && box.top < viewportHeight)) {
        throw new Error(
          'the trigger must be fully outside the viewport before asserting dismissal',
        );
      }
      await expect(page.locator(adapter.panel)).toHaveCount(0);
    });

    test('scroll inside the panel leaves it open', async ({ page }) => {
      await gotoHost(page, adapter);
      await openAndEnter(page, adapter);

      // The panel's own scrollport. A `scroll` event does not bubble, but the
      // components listen on `window` with capture, which still sees it — and
      // their handler exempts any target inside the panel.
      await page.locator(adapter.panel).evaluate((panel) => {
        panel.dispatchEvent(new Event('scroll'));
      });
      await page.waitForTimeout(50);

      await expect(page.locator(adapter.panel)).toBeVisible();
    });

    test('closing cancels pending positioning work and removes every listener', async ({
      page,
    }) => {
      await gotoHost(page, adapter);
      const before = await page.evaluate(() => window.__listenerLedger());
      await openAndEnter(page, adapter);
      const open = await page.evaluate(() => window.__listenerLedger());
      expect(
        POPUP_GLOBALS.map((key) => `${key}=${open[key]}`).join(' '),
        'each popup dismissal and viewport listener is registered once',
      ).toBe(POPUP_GLOBALS.map((key) => `${key}=1`).join(' '));

      await page.evaluate((selector) => {
        window.dispatchEvent(new Event('scroll'));
        const panel = document.querySelector(selector);
        panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }, adapter.panel);
      await expect(page.locator(adapter.panel)).toHaveCount(0);
      expect(await page.evaluate(() => window.__listenerLedger())).toEqual(before);
      expect(await page.evaluate(() => window.__pendingAnimationFrames())).toBe(0);
    });

    test('destroying the open panel removes every global listener', async ({ page }) => {
      // Counted on the page itself: every add on `window`, `document` or
      // `visualViewport` of the events the popups use, minus every matching remove. The baseline is
      // read BEFORE the panel is ever opened, and the panel is then destroyed
      // while still open, so a cleanup that only runs on close cannot pass.
      await gotoHost(page, adapter);
      const before = await page.evaluate(() => window.__listenerLedger());
      expect(
        POPUP_GLOBALS.reduce((total, key) => total + before[key], 0),
        'the app boots with none of the popup globals registered',
      ).toBe(0);

      await openAndEnter(page, adapter);
      const open = await page.evaluate(() => window.__listenerLedger());
      // Per key so duplicate registrations cannot cancel missing listeners in
      // the total.
      expect(
        POPUP_GLOBALS.map((key) => `${key}=${open[key]}`).join(' '),
        'an open panel registers every dismissal and viewport listener exactly once',
      ).toBe(POPUP_GLOBALS.map((key) => `${key}=1`).join(' '));

      // A route change destroys the component. The panel never gets a chance to
      // close itself, so only the effect cleanup can release the listeners.
      // `__probeMarker` is the guard against the vacuous pass this test would
      // otherwise have: a full page load resets the ledger to zero and looks
      // exactly like a clean cleanup, so the marker has to survive the jump.
      // The click is dispatched inside the page because Playwright would scroll
      // the nav link into view first, and that scroll would close the panel —
      // testing the close path while claiming to test the destroy path.
      await expect(page.locator(adapter.panel)).toBeVisible();
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__probeMarker = 'alive';
        const link = document.querySelector('nav a[href="/basic"]') as HTMLAnchorElement | null;
        if (!link) throw new Error('the fixture has no in-app link to navigate with');
        link.click();
      });
      await expect(page).toHaveURL(/\/basic$/);
      await expect(page.locator(adapter.root)).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as unknown as Record<string, unknown>).__probeMarker),
        'an in-app navigation must not reload the page',
      ).toBe('alive');
      await page.waitForTimeout(50);

      expect(await page.evaluate(() => window.__listenerLedger())).toEqual(before);
    });

    test('a height-only resize keeps the panel open and attached', async ({ page }) => {
      await openOnPhone(page, adapter);
      if (adapter.editable) await page.locator(adapter.editable).focus();
      await settlePopupMotion(page, adapter.panel);
      const before = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );

      await resizeWithAnchorInViewport(page, adapter, PHONE.width, PHONE.height - 100);
      const panel = page.locator(adapter.panel);
      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);
      const after = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );
      expect(Math.abs(after.gap - before.gap)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(after.panelTop - before.panelTop - (after.triggerTop - before.triggerTop)),
      ).toBeLessThanOrEqual(1);
    });

    test('a width change closes it while focus remains inside the panel', async ({ page }) => {
      // The exemption has to LOSE here: width is the axis the anchor sits on, so
      // the coordinates are stale no matter where the caret is. Without the
      // focus step this would pass even if the width check were deleted — and
      // going from a phone's portrait width to its landscape one is the real
      // event this rule is for, an orientation flip.
      await openOnPhone(page, adapter);
      if (adapter.editable) await page.locator(adapter.editable).focus();

      await resizeWithAnchorInViewport(page, adapter, PHONE.height, PHONE.width);
      await expect(page.locator(adapter.panel)).toHaveCount(0);
    });

    test('without the top layer it still opens, positions and picks', async ({ page }) => {
      // The flag is read once, when the component is constructed, so the
      // prototype has to lose the method before the app boots.
      await page.addInitScript(() => {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).showPopover;
      });
      await gotoHost(page, adapter);
      await openAndEnter(page, adapter);

      await expect(page.locator(adapter.panel)).toBeVisible();
      const box = await page.locator(adapter.panel).boundingBox();
      const trigger = await page.locator(adapter.trigger).boundingBox();
      if (!box || !trigger) throw new Error('the fallback panel has no box to measure');
      // The absolute fallback still lands the panel against its trigger rather
      // than at the document origin.
      expect(Math.abs(box.x - trigger.x)).toBeLessThan(40);

      await page.keyboard.press('Enter');
      await expect(page.locator(adapter.panel)).toHaveCount(0);
    });
  });
}

test.describe('mobile touch-scroll dismissal reproduction', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
  });

  for (const adapter of [SELECT, MENU]) {
    test(`${adapter.name}: an outside touch tap closes on pointerup`, async ({ page }) => {
      await gotoHost(page, adapter);
      await page.locator(adapter.trigger).click();
      const panel = page.locator(adapter.panel);
      await expect(panel).toBeVisible();

      await page.evaluate((root) => {
        const target = document.elementFromPoint(4, innerHeight - 4)!;
        if (document.querySelector(root)!.contains(target)) {
          throw new Error('tap target must be outside the popup host');
        }
        target.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            pointerId: 23,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 4,
            clientY: innerHeight - 4,
          }),
        );
      }, adapter.root);
      await expect(panel).toBeVisible();

      await page.evaluate(() => {
        const target = document.elementFromPoint(4, innerHeight - 4)!;
        target.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            pointerId: 23,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 4,
            clientY: innerHeight - 4,
          }),
        );
      });
      await expect(panel).toHaveCount(0);
    });

    test(`${adapter.name}: page scroll alone keeps the visible trigger's panel attached`, async ({
      page,
    }) => {
      await gotoHost(page, adapter);
      await makeScrollable(page);
      await page.locator(adapter.trigger).click();
      const panel = page.locator(adapter.panel);
      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);

      const before = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            scrollY,
            viewportHeight: innerHeight,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );
      await page.evaluate(() => window.scrollBy(0, 40));
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);
      const after = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            scrollY,
            viewportHeight: innerHeight,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );
      expect(after.scrollY).toBeGreaterThan(before.scrollY);
      expect(after.viewportHeight).toBe(before.viewportHeight);
      expect(after.triggerTop).toBeLessThan(before.triggerTop);
      expect(Math.abs(after.gap - before.gap)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(after.panelTop - before.panelTop - (after.triggerTop - before.triggerTop)),
      ).toBeLessThanOrEqual(1);
    });

    test(`${adapter.name}: a drag-scroll with a visible trigger keeps the panel attached`, async ({
      page,
    }) => {
      await gotoHost(page, adapter);
      await makeScrollable(page);
      await page.locator(adapter.trigger).click();
      const panel = page.locator(adapter.panel);
      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);

      const before = await page.evaluate(
        ({ root, trigger, panel }) => {
          const host = document.querySelector(root)!;
          const triggerEl = document.querySelector(trigger)!;
          const panelEl = document.querySelector(panel)!;
          const triggerBox = triggerEl.getBoundingClientRect();
          const panelBox = panelEl.getBoundingClientRect();
          if (
            !document.elementFromPoint(4, innerHeight - 4) ||
            host.contains(document.elementFromPoint(4, innerHeight - 4))
          ) {
            throw new Error('touch drag start must be outside the popup host');
          }
          return {
            scrollY,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { root: adapter.root, trigger: adapter.trigger, panel: adapter.panel },
      );

      // Dispatch the touch pointer sequence that starts outside the host. A
      // browser-generated scroll follows the drag; scrollBy keeps this repro
      // deterministic across engines while mobile emulation supplies touch
      // capabilities and the real popup/harness are exercised.
      await page.evaluate(() => {
        const target = document.elementFromPoint(4, innerHeight - 4)!;
        const event = (type: string, clientY: number, buttons: number) =>
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 17,
              pointerType: 'touch',
              isPrimary: true,
              button: 0,
              buttons,
              clientX: 4,
              clientY,
            }),
          );
        event('pointerdown', innerHeight - 4, 1);
        event('pointermove', innerHeight - 54, 1);
        window.scrollBy(0, 40);
        event('pointerup', innerHeight - 54, 0);
      });
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );

      await expect(panel).toBeVisible();
      await settlePopupMotion(page, adapter.panel);
      const after = await page.evaluate(
        ({ trigger, panel }) => {
          const triggerBox = document.querySelector(trigger)!.getBoundingClientRect();
          const panelBox = document.querySelector(panel)!.getBoundingClientRect();
          return {
            scrollY,
            triggerTop: triggerBox.top,
            panelTop: panelBox.top,
            gap: panelBox.top - triggerBox.bottom,
          };
        },
        { trigger: adapter.trigger, panel: adapter.panel },
      );
      expect(after.scrollY).toBeGreaterThan(before.scrollY);
      expect(after.triggerTop).toBeLessThan(before.triggerTop);
      expect(Math.abs(after.gap - before.gap)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(after.panelTop - before.panelTop - (after.triggerTop - before.triggerTop)),
      ).toBeLessThanOrEqual(1);
    });
  }
});

declare global {
  interface Window {
    __listenerLedger(): Record<string, number>;
    __pendingAnimationFrames(): number;
  }
}
