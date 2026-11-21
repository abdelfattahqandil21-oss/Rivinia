import type { PopupBounds } from '../positioning/compute-position';

export type BrowserWindow = Window & typeof globalThis;

export function viewportBounds(view: BrowserWindow): PopupBounds {
  const visual = view.visualViewport;
  if (visual) {
    return {
      left: visual.offsetLeft,
      top: visual.offsetTop,
      right: visual.offsetLeft + visual.width,
      bottom: visual.offsetTop + visual.height,
    };
  }
  return { left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight };
}
