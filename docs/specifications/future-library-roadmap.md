# Future library and component candidates

**Status:** discovery backlog only. Nothing here is approved for implementation,
new package creation, or release-group admission.

These ideas are candidates for consumer research and small prototypes. Keep
related functionality inside an existing package when its API and dependency
boundary remain coherent. Do not create one npm package for every small visual
primitive.

## Candidate families

### Forms

Input, textarea, number, password, checkbox, radio, switch, field composition,
and validation display. Before implementation, verify Angular's installed
Reactive, template-driven, and Signal Forms contracts; cover icons, variants,
RTL/LTR, disabled/readonly, autocomplete, IME, and asynchronous validation.
Prefer native interoperability, and measure any adapter before making it a
required dependency.

### Navigation and disclosure

Accordion, sidebar, navbar, breadcrumbs, tabs, and nested navigation. Explore
flat or grouped items, optional icons, active routes, mobile drawers,
collapsible state, footer actions, and keyboard use. Distinguish ordinary
navigation links from application action menus; choose ARIA roles for the
actual interaction model.

### Feedback and asynchronous work

Progress, spinner, loader, skeleton, empty states, and error states. Determine
whether a small opt-in task-state contract can be shared without forcing a
global service or delaying application startup. Keep determinate progress,
indeterminate activity, and placeholder content as separate concepts.

### Files

File and image upload, preview, and download actions. Research cancellation,
unknown progress, duplicate files, retries, object URL cleanup, network
failure, SSR, and server-side type/size validation. A browser `accept` filter
is not a security check.

### Layout and interaction

Cards, dividers, scroll areas, resizable panels, sliders/range sliders, and
reveal-on-scroll. Prefer native CSS and browser APIs where they fit; respect
reduced motion, clean up observers, and avoid per-frame global scroll work.

## Cross-family candidates

- Command palette for keyboard-first async command search and permissions.
- Stepper/wizard for multi-stage forms, validation and resumable state.
- Tree view for hierarchical navigation and file/permission views.
- Tooltip/help popover that can reuse Popup primitives with its own accessible
  trigger contract.
- Virtualization only when measured data sizes justify the extra behavior.

## Admission and implementation evidence

Before approving a design, show a real consumer flow, ownership boundaries,
headless/UI split, public imports, keyboard and screen-reader behavior, error
and fallback policy, dependency graph, and measured production consumer size.
Test current Angular and browser support rather than relying on blueprint
claims. New npm packages require a separate package-boundary and versioning
decision. See [release-group admission](../engineering/VERSIONING.md#admission-rules-for-a-future-group-member).

Optional `ng add`, `ng generate`, or `ng update` tooling is a separate
validation item: use it only when it measurably reduces setup or migration
work, make generators idempotent, and verify them in a clean consumer. Do not
install a global loader, provider, or persistence service as a side effect of
using an unrelated component.
