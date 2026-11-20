# @rivinia/theme — token contract

Back to [the package README](../../projects/theme/README.md) ·
[how tokens cascade](README.md)

Theme exposes one semantic token contract. The same names are consumed by every
Rivinia UI package and are the names consumers override. A theme scope can be
placed on the root or on a nested element with `data-rv-theme="light|dark|system"`.

## Colors

| Token | Purpose | Light | Dark |
| --- | --- | --- | --- |
| `--rv-color-primary` | Brand and selected state | `#005fcc` | `#8ab4ff` |
| `--rv-color-surface` | Main surface | `#ffffff` | `#182028` |
| `--rv-color-surface-raised` | Raised surface | `#f5f7fa` | `#202d38` |
| `--rv-color-text` | Main text | `#101820` | `#f5f7fa` |
| `--rv-color-text-muted` | Secondary text | `#454f58` | `#c4ced8` |
| `--rv-color-border` | Borders | `#767676` | `#8292a1` |
| `--rv-color-focus` | Keyboard focus indicator | `#005fcc` | `#8ab4ff` |
| `--rv-color-danger` | Destructive/error state | `#dc2626` | `#f87171` |
| `--rv-color-success` | Success state | `#16a34a` | `#4ade80` |
| `--rv-color-info` | Informational state | `#2563eb` | `#60a5fa` |
| `--rv-color-warning` | Warning state | `#d97706` | `#fbbf24` |

## Shape, spacing, type, and elevation

| Token | Default |
| --- | --- |
| `--rv-radius-sm` | `0.25rem` |
| `--rv-radius-md` | `0.5rem` |
| `--rv-radius-lg` | `0.75rem` |
| `--rv-space-1` | `0.25rem` |
| `--rv-space-2` | `0.5rem` |
| `--rv-space-3` | `0.75rem` |
| `--rv-space-4` | `1rem` |
| `--rv-shadow-md` | `0 16px 48px rgba(0, 0, 0, 0.22)` light; stronger in dark mode |
| `--rv-font-family` | System UI font stack |

## V1 migration

V1 semantic names and Tailwind utility aliases are removed. Update consumer
overrides to the canonical names below; the package does not emit compatibility
aliases.

| V1 token | V2 token |
| --- | --- |
| `--rv-bg` | `--rv-color-surface` |
| `--rv-fg` | `--rv-color-text` |
| `--rv-muted` | `--rv-color-text-muted` |
| `--rv-border` | `--rv-color-border` |
| `--rv-accent` | `--rv-color-primary` for brand/selected; `--rv-color-focus` for focus rings |
| `--rv-danger` | `--rv-color-danger` |
| `--rv-ok` | `--rv-color-success` |
| `--rv-info` | `--rv-color-info` |
| `--rv-warning` | `--rv-color-warning` |
| `--rv-radius` | `--rv-radius-md` |
| `--rv-shadow` | `--rv-shadow-md` |
| `--rv-font` | `--rv-font-family` |

Component-specific tokens such as `--rv-select-bg` remain owned by their
respective UI packages and fall back to these shared semantic tokens.
