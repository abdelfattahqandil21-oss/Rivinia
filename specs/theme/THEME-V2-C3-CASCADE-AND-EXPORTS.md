# Theme V2 — C3 Cascade & Package Exports Audit (2026-11-23)

Status: **C3 characterization passed; metadata fix awaiting build/consumer verification**.
Branch: `theme/v.2`; baseline commit: `62e118b156ae0c56db3138d555adbe5a29b54084`.

## Reproduced CSS behavior

Read-only `dist/theme` test: 17 cases in Chromium + 17 in Firefox = **34/34**
expected-characterization assertions passed. These are *descriptive* assertions,
not 34 guarantees of intended dual-theme UX.

- Bootstrap Adapter (`styles/bootstrap.css`) defines unlayered root and
  `[data-bs-theme]` token mappings; base Theme defaults live inside
  `@layer rivinia-theme`.
- When Bootstrap and Rivinia mode attributes disagree on one root, Bootstrap's
  mapped color wins. In particular, with Adapter imported, `data-rv-theme=dark`
  alone can still produce a light root surface.
- A separately nested explicit `data-rv-theme` scope can override an inherited
  root mapping; a conflict on the **same nested node** remains Bootstrap-first.
- Consumer unlayered CSS can override the mapping; `--bs-*` values can drive
  the Rivinia semantic token values.

No CSS or runtime behavior is changed by the C3 metadata cleanup. Consumers
using the Bootstrap adapter must synchronize mode ownership themselves, or
use the base Theme stylesheet instead. Any future bridge is an explicit
separate design decision, not an implicit side effect of importing CSS.

## Package exports

The pre-change source manifest provided `exports['.'].style` *and* a
`default` pointing at CSS, plus a handmade `./package.json` `default`.
`ng-packagr` 22.2.5 overwrote both `default` conditions, issuing two warnings.
The built package already correctly exposes JS `default` at the root and the
CSS `style` condition (shown in the C3 audit). Remove only source conditions
that `ng-packagr` owns; retain the important root `style` and all explicit
CSS/Sass subpaths. Built exports are the source of truth for consumers.

## Verification required after the patch

1. `pnpm run build:theme` must pass with **zero** conflicting-export warnings.
2. `pnpm run check:theme` must validate `dist/theme` including root `.style`.
3. Built exports must still have root `.style`, root JS `default`, and
   `./package.json` and all named CSS/Sass subpath exports.
4. `pnpm run test:theme` and `pnpm run check:docs` must pass.
5. A fresh tarball (not a path into source) must pass `check:theme` and an
   independent CSS consumer. The 34/34 C3 assertions should remain unchanged.

No version bump, commit, push, merge or publication is authorized by C3.
`specs/popup/` is outside scope.
