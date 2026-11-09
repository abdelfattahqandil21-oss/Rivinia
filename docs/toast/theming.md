# Theming

Package-specific tokens and the shared Rivinia theme entry point.

[Back to @rivinia/toast README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/toast/v1.0.4/projects/toast/README.md)

### The library's own tokens

| Token               | Default                       | Applies to     |
| ------------------- | ----------------------------- | -------------- |
| `--rv-toast-bg`     | `#ffffff`                     | the toast      |
| `--rv-toast-fg`     | `#111111`                     | the toast      |
| `--rv-toast-muted`  | `#555555`                     | the kind rail  |
| `--rv-toast-border` | `#e0e0e0`                     | the toast      |
| `--rv-toast-radius` | `12px`                        | the toast      |
| `--rv-toast-shadow` | `0 12px 32px rgba(0,0,0,.32)` | the toast      |
| `--rv-toast-gap`    | `8px`                         | between toasts |
| `--rv-toast-width`  | `22rem`                       | the list       |
| `--rv-toast-z`      | `1000`                        | the list       |

The kind colors use the package token first, then the inherited semantic token,
then the built-in fallback. The component does not declare status defaults on
the list, so a Theme value or a scoped `--rv-*` override can reach each toast:

| Token                | No-Theme fallback | Semantic token |
| -------------------- | ----------------- | -------------- |
| `--rv-toast-success` | `#16a34a`         | `--rv-ok`      |
| `--rv-toast-error`   | `#dc2626`         | `--rv-danger`  |
| `--rv-toast-info`    | `#2563eb`         | `--rv-info`    |
| `--rv-toast-warning` | `#d97706`         | `--rv-warning` |

With `richColors=true`, each status token is mixed with 45% black for the card
background and the card uses white foreground text. This keeps the Theme's
status hue and package-token override while making the built-in light and dark
Theme palettes readable as text backgrounds. The shipped Theme pairs measure
at least 5.1:1 in both schemes. Browsers without `color-mix()` use an accessible
Toast-owned background pair instead. Rich-color values supplied by another
styling adapter or by a consumer are their responsibility to keep accessible;
Toast does not infer a foreground from arbitrary colors.

For shared semantic tokens and styling-stack setup, see [https://github.com/abdelfattahqandil21-oss/Rivinia theming guide](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/theme/v1.0.4/docs/theme/README.md).
