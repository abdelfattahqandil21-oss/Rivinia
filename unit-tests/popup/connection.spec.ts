import { connectPopup } from '@rivinia/popup';

describe('connectPopup', () => {
  it('lets a child control consume Escape before applying popup dismissal', () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const control = document.createElement('button');
    panel.append(control);
    control.addEventListener('keydown', event => event.preventDefault());
    const connection = connectPopup({ origin, panel, onDismiss });
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onDismiss).not.toHaveBeenCalled();
    connection.destroy(); origin.remove(); panel.remove();
  });

  it('delegates coordinates to a host writer without overwriting its CSS positioning', () => {
    const { origin, panel } = createPopupElements();
    panel.style.position = 'absolute';
    panel.style.left = '13px';
    const position = vi.fn();
    const connection = connectPopup({ origin, panel, position, onDismiss: vi.fn() });
    expect(position).toHaveBeenCalledOnce();
    expect(panel.style.position).toBe('absolute');
    expect(panel.style.left).toBe('13px');
    connection.destroy();
    expect(panel.style.left).toBe('13px');
    origin.remove(); panel.remove();
  });

  it('discovers a containing popup for auto parent ownership and closes one level', () => {
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    parentElements.panel.append(childElements.origin);
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({ ...childElements, parent: 'auto', onDismiss: childDismiss });
    childElements.panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(parentDismiss).not.toHaveBeenCalled();
    expect(childDismiss).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(childDismiss).toHaveBeenCalledExactlyOnceWith('escape');
    expect(parentDismiss).not.toHaveBeenCalled();
    child.destroy(); parent.destroy();
    parentElements.origin.remove(); parentElements.panel.remove(); childElements.panel.remove();
  });

  it('positions the panel immediately and restores owned inline styles on destroy', () => {
    const origin = document.createElement('button');
    const panel = document.createElement('div');
    document.body.append(origin, panel);
    origin.getBoundingClientRect = () => rect(100, 40, 80, 20);
    panel.getBoundingClientRect = () => rect(0, 0, 120, 60);
    panel.style.position = 'absolute';
    panel.style.inset = '2px 3px 4px 5px';
    panel.style.margin = '3px';
    panel.style.left = '7px';
    panel.style.top = '9px';
    const originalInset = panel.style.inset;

    const connection = connectPopup({ origin, panel, offset: 8, onDismiss: () => undefined });

    expect(panel.style.position).toBe('fixed');
    // CSSOM shorthand serialization differs across DOM implementations.
    expect(['auto', '68px auto auto 100px']).toContain(panel.style.inset);
    expect(panel.style.margin).toBe('0px');
    expect(panel.style.left).toBe('100px');
    expect(panel.style.top).toBe('68px');

    connection.destroy();

    expect(panel.style.position).toBe('absolute');
    expect(panel.style.inset).toBe(originalInset);
    expect(panel.style.margin).toBe('3px');
    expect(panel.style.left).toBe('7px');
    expect(panel.style.top).toBe('9px');
    origin.remove();
    panel.remove();
  });

  it('updates positioning preferences without replacing the connection', () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    connection.update({ placement: 'top-end', offset: 4 });

    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('64px');
    expect(onDismiss).not.toHaveBeenCalled();
    connection.destroy();
    origin.remove();
    panel.remove();
  });

  it('dismisses on an outside pointer and tears down its inline positioning', () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });
    const outside = document.createElement('button');
    document.body.append(outside);

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('outside');
    expect(panel.style.position).toBe('');
    connection.destroy();
    outside.remove();
    origin.remove();
    panel.remove();
  });

  it('keeps the popup open during an outside touch drag, but closes on a short tap', () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });
    const pointer = (type: string, x: number) => document.body.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, pointerType: 'touch', pointerId: 1, clientX: x, clientY: 10,
    }));
    pointer('pointerdown', 10);
    expect(onDismiss).not.toHaveBeenCalled();
    pointer('pointermove', 25);
    pointer('pointerup', 25);
    expect(onDismiss).not.toHaveBeenCalled();
    pointer('pointerdown', 10);
    pointer('pointercancel', 10);
    pointer('pointerup', 10);
    expect(onDismiss).not.toHaveBeenCalled();
    pointer('pointerdown', 10);
    pointer('pointerup', 10);
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('outside');
    connection.destroy();
    origin.remove(); panel.remove();
  });

  it('dismisses only the child when the pointer lands inside its parent', () => {
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    parentElements.panel.append(childElements.origin, childElements.panel);
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({
      ...childElements,
      parent,
      onDismiss: childDismiss,
    });

    parentElements.panel.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    );

    expect(childDismiss).toHaveBeenCalledExactlyOnceWith('outside');
    expect(parentDismiss).not.toHaveBeenCalled();
    child.destroy();
    parent.destroy();
    parentElements.origin.remove();
    parentElements.panel.remove();
    childElements.origin.remove();
    childElements.panel.remove();
  });

  it('dismisses a newer independent popup before an older nested popup', () => {
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    const latestElements = createPopupElements();

    parentElements.panel.append(childElements.origin);

    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const latestDismiss = vi.fn();

    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({ ...childElements, parent, onDismiss: childDismiss });
    const latest = connectPopup({ ...latestElements, onDismiss: latestDismiss });

    const escape = () => document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );

    try {
      escape();
      expect(latestDismiss).toHaveBeenCalledExactlyOnceWith('escape');
      expect(childDismiss).not.toHaveBeenCalled();
      expect(parentDismiss).not.toHaveBeenCalled();

      escape();
      expect(childDismiss).toHaveBeenCalledExactlyOnceWith('escape');
      expect(parentDismiss).not.toHaveBeenCalled();

      escape();
      expect(parentDismiss).toHaveBeenCalledExactlyOnceWith('escape');
    } finally {
      latest.destroy();
      child.destroy();
      parent.destroy();
      parentElements.origin.remove();
      parentElements.panel.remove();
      childElements.origin.remove();
      childElements.panel.remove();
      latestElements.origin.remove();
      latestElements.panel.remove();
    }
  });

  it('closes sibling popups when interacting inside another child', () => {
    const parentElements = createPopupElements();
    const firstElements = createPopupElements();
    const secondElements = createPopupElements();

    parentElements.panel.append(
      firstElements.origin,
      secondElements.origin,
    );

    const parentDismiss = vi.fn();
    const firstDismiss = vi.fn();
    const secondDismiss = vi.fn();

    const parent = connectPopup({
      ...parentElements,
      onDismiss: parentDismiss,
    });
    const first = connectPopup({
      ...firstElements,
      parent,
      onDismiss: firstDismiss,
    });
    const second = connectPopup({
      ...secondElements,
      parent,
      onDismiss: secondDismiss,
    });

    try {
      firstElements.panel.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          composed: true,
          pointerType: 'mouse',
        }),
      );

      expect(parentDismiss).not.toHaveBeenCalled();
      expect(firstDismiss).not.toHaveBeenCalled();
      expect(secondDismiss).toHaveBeenCalledExactlyOnceWith('outside');
    } finally {
      second.destroy();
      first.destroy();
      parent.destroy();

      for (const elements of [
        parentElements,
        firstElements,
        secondElements,
      ]) {
        elements.origin.remove();
        elements.panel.remove();
      }
    }
  });

  it('routes Escape from a portaled child to its logical popup before unrelated connections', () => {
    const dialog = document.createElement('dialog');
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    const unrelatedElements = createPopupElements();

    document.body.append(dialog);
    dialog.open = true;
    dialog.append(parentElements.origin, parentElements.panel);
    parentElements.panel.append(childElements.origin);

    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const unrelatedDismiss = vi.fn();

    const parent = connectPopup({
      ...parentElements,
      onDismiss: parentDismiss,
    });

    const child = connectPopup({
      ...childElements,
      parent,
      onDismiss: childDismiss,
    });

    const unrelated = connectPopup({
      ...unrelatedElements,
      onDismiss: unrelatedDismiss,
    });

    try {
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      });

      childElements.panel.dispatchEvent(escape);

      expect(escape.defaultPrevented).toBe(true);
      expect(childDismiss).toHaveBeenCalledExactlyOnceWith('escape');
      expect(parentDismiss).not.toHaveBeenCalled();
      expect(unrelatedDismiss).not.toHaveBeenCalled();
    } finally {
      unrelated.destroy();
      child.destroy();
      parent.destroy();

      dialog.remove();

      for (const elements of [
        parentElements,
        childElements,
        unrelatedElements,
      ]) {
        elements.origin.remove();
        elements.panel.remove();
      }
    }
  });

  it('uses one Escape for the top popup and leaves dialog cancellation untouched', () => {
    const dialog = document.createElement('dialog');
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    document.body.append(dialog);
    dialog.append(parentElements.origin, parentElements.panel);
    parentElements.panel.append(childElements.origin);
    dialog.append(childElements.panel);
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({ ...childElements, parent, onDismiss: childDismiss });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    document.dispatchEvent(escape);

    expect(escape.defaultPrevented).toBe(true);
    expect(childDismiss).toHaveBeenCalledExactlyOnceWith('escape');
    expect(parentDismiss).not.toHaveBeenCalled();

    const cancel = new Event('cancel', { bubbles: true, cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(false);
    expect(parentDismiss).not.toHaveBeenCalled();

    expect(parentElements.panel.style.position).toBe('fixed');
    child.destroy();
    parent.destroy();
    dialog.remove();
  });

  it('silently destroys dialog-owned nested connections on close and removes Escape handling', () => {
    const dialog = document.createElement('dialog');
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    document.body.append(dialog);
    dialog.append(parentElements.origin, parentElements.panel);
    parentElements.panel.append(childElements.origin);
    dialog.append(childElements.panel);
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({ ...childElements, parent, onDismiss: childDismiss });

    dialog.dispatchEvent(new Event('close'));

    expect(childDismiss).not.toHaveBeenCalled();
    expect(parentDismiss).not.toHaveBeenCalled();
    expect(parentElements.panel.style.position).toBe('');
    expect(childElements.panel.style.position).toBe('');
    const laterEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(laterEscape);
    expect(laterEscape.defaultPrevented).toBe(false);

    child.destroy();
    parent.destroy();
    dialog.remove();
  });

  it('destroys a logical child connection when its parent panel is not its DOM ancestor', () => {
    const parentElements = createPopupElements();
    const childElements = createPopupElements();
    parentElements.panel.append(childElements.origin);
    document.body.append(parentElements.origin, parentElements.panel, childElements.panel);
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    const parent = connectPopup({ ...parentElements, onDismiss: parentDismiss });
    const child = connectPopup({ ...childElements, parent, onDismiss: childDismiss });

    parent.destroy();

    expect(parentDismiss).not.toHaveBeenCalled();
    expect(childDismiss).not.toHaveBeenCalled();
    expect(parentElements.panel.style.position).toBe('');
    expect(childElements.panel.style.position).toBe('');
    const laterEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(laterEscape);
    expect(laterEscape.defaultPrevented).toBe(false);

    child.destroy();
    parent.destroy();
    parentElements.origin.remove();
    parentElements.panel.remove();
    childElements.origin.remove();
    childElements.panel.remove();
  });

  it('dismisses when the origin is fully clipped by an ancestor', () => {
    const clipper = document.createElement('div');
    const origin = document.createElement('button');
    const panel = document.createElement('div');
    clipper.style.overflowX = 'hidden';
    clipper.style.overflowY = 'hidden';
    Object.defineProperty(clipper, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(clipper, 'clientHeight', { configurable: true, value: 100 });
    clipper.getBoundingClientRect = () => rect(0, 0, 100, 100);
    origin.getBoundingClientRect = () => rect(150, 20, 20, 20);
    panel.getBoundingClientRect = () => rect(0, 0, 60, 40);
    clipper.append(origin);
    document.body.append(clipper, panel);
    const onDismiss = vi.fn();

    const connection = connectPopup({ origin, panel, onDismiss });

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    connection.destroy();
    clipper.remove();
    panel.remove();
  });

  it('keeps a partly visible origin and dismisses after it becomes fully clipped', () => {
    const clipper = document.createElement('div');
    const origin = document.createElement('button');
    const panel = document.createElement('div');
    let originLeft = 90;
    clipper.style.overflowX = 'hidden';
    clipper.style.overflowY = 'hidden';
    Object.defineProperty(clipper, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(clipper, 'clientHeight', { configurable: true, value: 100 });
    clipper.getBoundingClientRect = () => rect(0, 0, 100, 100);
    origin.getBoundingClientRect = () => rect(originLeft, 20, 20, 20);
    panel.getBoundingClientRect = () => rect(0, 0, 60, 40);
    clipper.append(origin);
    document.body.append(clipper, panel);
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel.style.position).toBe('fixed');

    originLeft = 150;
    connection.update();

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    clipper.remove();
    panel.remove();
  });

  it('supports a close-on-scroll strategy for an origin inside the scrolling container', () => {
    const scroller = document.createElement('div');
    const origin = document.createElement('button');
    const panel = document.createElement('div');
    scroller.style.overflow = 'auto';
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    scroller.getBoundingClientRect = () => rect(0, 0, 100, 100);
    scroller.append(origin);
    document.body.append(scroller, panel);
    origin.getBoundingClientRect = () => rect(10, 10, 20, 20);
    panel.getBoundingClientRect = () => rect(0, 0, 40, 30);
    const onDismiss = vi.fn();
    connectPopup({ origin, panel, scrollStrategy: 'close', onDismiss });

    scroller.dispatchEvent(new Event('scroll', { bubbles: false }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('scroll');
    scroller.remove();
    panel.remove();
  });

  it('dismisses when the origin inline visibility changes without a geometry update', async () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    origin.style.visibility = 'hidden';
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    expect(panel.style.position).toBe('');
    connection.destroy();
    origin.remove();
    panel.remove();
  });

  it('dismisses when an ancestor class hides the origin without changing its size', async () => {
    const style = document.createElement('style');
    style.textContent = '.popup-origin-hidden { visibility: hidden; }';
    document.head.append(style);
    const ancestor = document.createElement('div');
    const origin = document.createElement('button');
    const panel = document.createElement('div');
    ancestor.append(origin);
    document.body.append(ancestor, panel);
    origin.getBoundingClientRect = () => rect(100, 40, 80, 20);
    panel.getBoundingClientRect = () => rect(0, 0, 120, 60);
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    ancestor.classList.add('popup-origin-hidden');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    expect(panel.style.position).toBe('');
    connection.destroy();
    ancestor.remove();
    panel.remove();
    style.remove();
  });

  it('dismisses when the origin receives the hidden attribute', async () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    origin.hidden = true;
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    expect(panel.style.position).toBe('');
    connection.destroy();
    origin.remove();
    panel.remove();
  });

  it('disconnects visibility observation when a connection is destroyed', async () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    connection.destroy();
    origin.style.visibility = 'hidden';
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(onDismiss).not.toHaveBeenCalled();
    origin.remove();
    panel.remove();
  });

  it('dismisses and cleans up when the origin is detached from the document', async () => {
    const { origin, panel } = createPopupElements();
    const onDismiss = vi.fn();
    const connection = connectPopup({ origin, panel, onDismiss });

    origin.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith('anchor-hidden');
    expect(panel.style.position).toBe('');
    connection.destroy();
    panel.remove();
  });
});

function createPopupElements(): { origin: HTMLButtonElement; panel: HTMLDivElement } {
  const origin = document.createElement('button');
  const panel = document.createElement('div');
  origin.getBoundingClientRect = () => rect(100, 40, 80, 20);
  panel.getBoundingClientRect = () => rect(0, 0, 120, 60);
  document.body.append(origin, panel);
  return { origin, panel };
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}
