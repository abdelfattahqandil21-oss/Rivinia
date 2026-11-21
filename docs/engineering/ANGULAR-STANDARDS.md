# Angular 22 library engineering standard

**Status:** Default review contract for new/modified Rivinia Angular components. Confirm installed `@angular/*` package versions and framework types before relying on recently introduced APIs. Verify against authoritative Angular documentation when behavior matters.

## Component and change detection

- In Angular **22**, `OnPush` is the default component change-detection strategy; **do not add explicit `ChangeDetectionStrategy.OnPush` mechanically** to every new component. Explicit declarations are fine when needed for clarity, but not a migration goal. The previous `Default` behavior is called `Eager` (legacy alias `Default`).
- Never opt into `Eager` to silence a stale view or failing test. Document a concrete compatibility requirement, measure behavior, test projected/consumer components, and justify the exception. A library host that renders user components relying on eager checks needs a dedicated compatibility review.
- Angular **21+** applications are zoneless by default. Do not insert a zone provider merely because older tutorials show one; test actual host configurations and legacy consumers instead.
- Use `standalone` components/feature composition and `input`/`output`/`model`/`viewChild`/`contentChild`/signals where stable and appropriate. Angular forms integration must satisfy the **actual** installed reactive/template/signal form contracts; do not claim universal compatibility from one adapter.
- Model derived values with `computed`; reserve `effect` for synchronized external side effects with an owner and cleanup. Avoid feedback loops, writes while deriving, and redundant copies of state. For async requests use explicit cancellation/latest-intent wins and SSR-safe guards.
- Keep templates accessible, semantic and low-work: `@if`/`@for` where appropriate, stable tracking identities, no expensive repeated computations, and no change-detection workarounds masquerading as performance optimizations.
- Angular unit tests must run with the **configured Angular builder** (`ng test <project> --watch=false` where available), not standalone raw Vitest, unless verified pure-TypeScript tests use their own runner. In some Angular 22 toolchains JIT/TestBed and production AOT have differed in inferred change-detection defaults; explicitly test relevant production behavior when the contract depends on it.

## Services, dependencies and SSR

- Prefer single-purpose services, `inject`, `provideX` and explicit public contracts; use signals for observable state and RxJS only when streams/interoperability are useful. Use `takeUntilDestroyed` or equivalent ownership for subscriptions.
- Keep components independently reusable: no hidden global window listeners, unowned ResizeObservers, stale timers, leaked `ObjectURL`s, or cross-component private service imports. Cleanup follows actual panel/host lifetime.
- Guard DOM/Web APIs (`document`, `window`, storage, `visualViewport`, observers, popover, animations) in code that might execute on the server; prove SSR and hydration where relevant.
- Core/headless never imports UI. Do not import another package's `src/` or internal implementation path; use public entry points and prove no cycles or unintended eager chunks.
- Angular packages are peers, not newly introduced runtime dependencies without package policy review. Preserve honest `sideEffects` for CSS-bearing exports.

## UI, CSS, RTL and mobile

- Follow **component token → semantic token → built-in fallback** at the read site. Consumer CSS customization must win without `!important`, `::ng-deep`, or a competing fake token default.
- Use CSS logical properties and intrinsic/container-aware sizes, not one global fixed input width. Check long Arabic/English strings, narrow widths, **short-height viewports**, keyboard/zoom, nested scroll, and scroll chaining.
- For overlays, preserve topmost dismissal, focus restoration, clipping/anchor-hidden semantics, Escape ownership, and fallback positioning. Fix unwanted auto-scroll at the focus source; do not disable valid dismissal rules to hide defects.
- Check ARIA/APG keyboard interactions, focus visibility, disabled states, high contrast/forced colors, reduced motion, touch targets, and real-browser layout. Unit tests cannot verify computed geometry.

## Test and review contract

1. Change no public API, peer range, or entry point without compatibility, package and consumer review.
2. Run the affected production library build and Angular unit target.
3. For geometry, focus, overlays, RTL, and style: rebuild exact harness and run configured browser suite, at minimum Chromium/Firefox where supported; record WebKit/manual Safari separately.
4. Verify package tarball and production consumer before *release* approval; build alone is not consumer proof.
5. Record evidence as **passed / failed / skipped / not run**, never as one ambiguous “all green”.

**Primary references (reviewed 2026-11-21):** [Angular change-detection configuration](https://angular.dev/guide/components/advanced-configuration), [Angular OnPush subtree guide](https://angular.dev/best-practices/skipping-subtrees), [Angular zoneless guide](https://angular.dev/guide/zoneless), [ChangeDetectionStrategy API](https://angular.dev/api/core/ChangeDetectionStrategy).
