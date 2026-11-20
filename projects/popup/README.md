# @rivinia/popup

Headless popup positioning and dismissal mechanics shared by Rivinia UI packages.
This package contains no popup markup, styles, focus policy, or component state.

## Position calculation

`computePopupPosition` calculates viewport coordinates from trigger and panel
geometry. The host supplies direction explicitly, so applications can retain
their own direction source.

```ts
import { computePopupPosition } from '@rivinia/popup';

const position = computePopupPosition(
  { left: 24, top: 40, width: 160, height: 36 },
  { width: 220, height: 180 },
  'bottom-start',
  { width: window.innerWidth, height: window.innerHeight },
  'ltr',
);
```

The result contains `left`, `top`, and whether vertical placement flipped.
Coordinates are clamped to the viewport edge inset. `POPUP_GAP` and
`POPUP_EDGE_INSET` expose the default geometry constants.

## Dismissal binding

`bindPopupDismissal(options, destroyRef)` attaches outside-pointer, scroll,
and resize listeners for one open popup host. The caller supplies the browser
`document` and `window` (or `null` during server rendering), host and panel
lookups, the editable-focus predicate, and a dismiss callback. The binding
cleans up listeners through Angular `DestroyRef` and the optional effect
cleanup callback. Null browser objects make it a no-op, keeping the helper
safe during SSR.

The host remains responsible for open state, focus movement and restoration,
keyboard ownership, event cancellation, row semantics, styling, and sizing.
Select and Menu intentionally retain their different behavior policies.

## Compatibility

Package version: **2.0.0-alpha.1**. This is the first public release of the
shared popup core. See the [core specification](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/popup/v2.0.0-alpha.1/projects/popup/specifications/popup-core.md)
and [release notes](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/popup/v2.0.0-alpha.1/projects/popup/CHANGELOG.md). The
[release policy](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/popup/v2.0.0-alpha.1/docs/engineering/VERSIONING.md)
describes synchronized package versioning.


This package belongs to the `rivinia-1.0` synchronized release group, whose eleven packages share one version.

## Connected panels

`connectPopup` positions an already-rendered panel, observes resize/visibility changes,
and coordinates logical parent/child dismissal. It adds no markup or styles. The host
owns opening/hiding its native popover and restoring focus.

```ts
import { connectPopup } from '@rivinia/popup';

const connection = connectPopup({
  origin: trigger,
  panel,
  placement: 'bottom-center',
  offset: 6,
  padding: 8,
  onDismiss: (reason) => closePanel(reason),
});
// Call after layout shifts not covered by resize or scroll observation.
connection.update();
// Call when the host closes or is destroyed.
connection.destroy();
```

Pass `parent: parentConnection` for a nested panel, including a panel rendered
outside its logical parent's DOM subtree. Dismiss reasons are `outside`, `escape`,
`anchor-hidden`, `scroll`, and `resize`. Outside touch drags preserve the panel; short taps
dismiss it. `scrollStrategy: 'close'` opts into dismissal on a relevant scroll;
the default repositions until the origin is fully clipped or detached.

For Angular, import `PopupPanelDirective` and bind `rvPopupPanelOrigin`,
`rvPopupPanelOpen`, and optionally placement, offset, padding, parent and scroll
strategy. Handle `(rvPopupDismissed)` by updating the host's open state and hiding
its popover. Connections start after browser rendering; importing during SSR is
safe, but calling `connectPopup` requires connected elements in a live document.

The existing positional `computePopupPosition` remains available. The new
`computeConnectedPopupPosition(options)` supports all four sides, start/center/end
alignment and visual viewport bounds. Its result reports the resolved placement.

The optional `position` callback delegates coordinate application to a host-owned
positioning strategy, such as existing CSS anchor positioning. When supplied, Popup
leaves the panel's inline positioning styles untouched. `parent: 'auto'` discovers
the deepest connected panel containing the new origin; explicit connections remain
available for portals. `closeOnWidthChange: true` preserves hosts that close on
viewport width changes while repositioning for height-only changes. Menu and Select
use these options in supported native-popover browsers; their original dismissal
binding remains the no-popover fallback.
