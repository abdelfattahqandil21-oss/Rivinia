# Theming

`@rivinia/modal/ui` ships plain CSS and can be themed by setting custom
properties on an ancestor or on a specific modal. It does not require
`@rivinia/theme`. Palette fallbacks are read at each use site so inherited
semantic tokens remain effective; the dialog defines only modal layout and
motion defaults.

## Dialog tokens

| Token | Fallback | Purpose |
| --- | --- | --- |
| `--rv-modal-bg` | `--rv-color-surface`, then white | Dialog surface |
| `--rv-modal-fg` | `--rv-color-text`, then near-black | Dialog text |
| `--rv-modal-muted` | `--rv-color-text-muted`, then gray | Supporting and loader text |
| `--rv-modal-border` | `--rv-color-border`, then gray | Dialog border |
| `--rv-modal-radius` | `--rv-radius-md`, then 12px | Dialog corner radius |
| `--rv-modal-shadow` | `--rv-shadow-md`, then modal shadow | Dialog elevation |
| `--rv-modal-backdrop` | translucent black | Native backdrop |
| `--rv-modal-section-divider` | `--rv-color-border-subtle`, then current-color mix | Header/footer separators |
| `--rv-modal-pad` | 20px | Header, body, footer padding |
| `--rv-modal-gap` | 12px | Section spacing |
| `--rv-modal-width-sm/md/lg/xl` | responsive `clamp()` presets | Size presets |
| `--rv-modal-width-panel` | 24rem | Side panel width |
| `--rv-modal-max-height` | `min(86dvh, 100%)` | Dialog height cap |
| `--rv-modal-radius-sheet` | 1.25rem | Mobile sheet corners |
| `--rv-modal-duration/in/out` | 150ms / 150ms / 120ms | Open and close timing |
| `--rv-modal-easing/in/out` | ease-out / ease-out / ease-in | Motion curves |
| `--rv-modal-size-duration` | 180ms | Size and position changes |
| `--rv-modal-loading-*` | documented in CSS fallbacks | Loader gap, padding, size, minimum height |
| `--rv-modal-spinner-*` | documented in CSS fallbacks | Spinner dimensions and speed |

The current dialog defaults are intentionally component layout values. They do
not install semantic color tokens on `.rv-modal`; a consumer or future Theme
adapter can provide those values from outside.

## Action tokens

`@rivinia/modal/actions` uses the following optional properties:
`--rv-action-bg`, `--rv-action-fg`, `--rv-action-border`,
`--rv-action-hover-bg`, `--rv-action-focus`, `--rv-action-gap`,
`--rv-action-size`, `--rv-action-radius`, `--rv-action-primary-bg`,
`--rv-action-primary-fg`, `--rv-action-success-bg`,
`--rv-action-danger-bg`, `--rv-action-danger-fg`, and
`--rv-action-danger-on-bg`. Their fallbacks use the shared semantic colors
when present, then local CSS fallback values. `--rv-action-custom-color` is
internal per-item state populated only from a validated CSS color string.

```css
:root {
  --rv-modal-bg: var(--app-surface);
  --rv-modal-fg: var(--app-text);
  --rv-modal-border: var(--app-border);
  --rv-modal-width-lg: min(72rem, calc(100vw - 2rem));
  --rv-modal-section-divider: color-mix(in srgb, var(--app-text) 12%, transparent);
  --rv-action-radius: .4rem;
}

.billing-dialog {
  --rv-modal-shadow: 0 1rem 3rem rgb(0 0 0 / 24%);
  --rv-modal-pad: 1.25rem;
}
```

Consumer styling should use ordinary CSS selectors or classes on the dialog
content and avoid `::ng-deep`. Plain CSS is the package's authored format.
SCSS, Less, Tailwind, and Bootstrap are consumer CSS toolchains rather than
Modal package dependencies; their compatibility is not claimed until a
Modal-specific consumer fixture validates each stack.
