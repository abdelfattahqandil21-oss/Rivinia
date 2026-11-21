import type { PopupBounds } from '../positioning/compute-position';
import { composedParent } from './composed-dom';

function clips(value: string): boolean {
  return (
    value === 'auto' ||
    value === 'scroll' ||
    value === 'hidden' ||
    value === 'clip' ||
    value === 'overlay'
  );
}

export function clippedOrigin(origin: HTMLElement, bounds: PopupBounds): boolean {
  const view = origin.ownerDocument.defaultView;
  if (!view || !origin.isConnected) return true;
  const originStyle = view.getComputedStyle(origin);
  if (
    originStyle.display === 'none' ||
    originStyle.visibility === 'hidden' ||
    originStyle.visibility === 'collapse'
  ) {
    return true;
  }

  const rect = origin.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;
  let left = rect.left;
  let right = rect.right;
  let top = rect.top;
  let bottom = rect.bottom;

  for (let ancestor = composedParent(origin); ancestor; ancestor = composedParent(ancestor)) {
    const style = view.getComputedStyle(ancestor);
    if (!clips(style.overflowX) && !clips(style.overflowY)) continue;
    const ancestorRect = ancestor.getBoundingClientRect();
    const clipLeft = ancestorRect.left + ancestor.clientLeft;
    const clipTop = ancestorRect.top + ancestor.clientTop;
    if (clips(style.overflowX)) {
      left = Math.max(left, clipLeft);
      right = Math.min(right, clipLeft + ancestor.clientWidth);
    }
    if (clips(style.overflowY)) {
      top = Math.max(top, clipTop);
      bottom = Math.min(bottom, clipTop + ancestor.clientHeight);
    }
    if (right <= left || bottom <= top) return true;
  }

  return (
    right <= bounds.left || left >= bounds.right || bottom <= bounds.top || top >= bounds.bottom
  );
}
