# @rivinia/theme — styling stacks

Back to [the README](../../projects/theme/README.md) ·
[where overrides have to live](README.md)

| Stack | Integration |
| --- | --- |
| Plain CSS | Import `@rivinia/theme`; override semantic `--rv-*` tokens. |
| Tailwind v4 | Import `@rivinia/theme/tailwind.css`; utilities use `rv-*` names. |
| Bootstrap 5.3 | Import `@rivinia/theme/bootstrap.css`; its `--bs-*` palette maps into Rivinia tokens. |
| Sass / SCSS | `@use '@rivinia/theme/scss';`; the Sass CLI needs `pkg:`. |
| Less | Import the explicit `@rivinia/theme/theme.css` file. |

Import one base or adapter entry. Tailwind and Bootstrap adapters already
include the base theme stylesheet.

## Tailwind v4

```css
@import 'tailwindcss';
@import '@rivinia/theme/tailwind.css';

.promo {
  --rv-color-surface: #f4f7fc;
}
```

The adapter maps the semantic contract with `@theme inline`, so utilities read
tokens at the point of use. Examples include `bg-rv-surface`, `text-rv-text`,
`border-rv-border`, `rounded-rv-md`, `p-rv-4`, and `shadow-rv-md`. A nested
`data-rv-theme` scope or token override therefore applies to descendants.

Set the Rivinia semantic token itself when changing the palette. Tailwind's
`--color-rv-*` values define utility names and are not a second Theme token API.

## Bootstrap 5.3

```css
@import 'bootstrap/dist/css/bootstrap.css';
@import '@rivinia/theme/bootstrap.css';
```

The adapter maps Bootstrap's body, secondary, border, primary, danger, success,
info, and warning variables into the same Rivinia color tokens under
`[data-bs-theme='light']` and `[data-bs-theme='dark']`. It also maps Bootstrap
radius and font variables where available. The adapter rules stay unlayered so
the selected Bootstrap palette takes precedence over Theme defaults.

## Sass

```scss
@use '@rivinia/theme/scss';
```

Bundlers resolve the package export. The Sass CLI does not read package
`exports`, so use the Node package importer:

```bash
sass --pkg-importer=node styles.scss
```

```scss
@use 'pkg:@rivinia/theme/scss';
```

`--pkg-importer=node` requires Dart Sass 1.71+.

## Less

```less
@import (less) '@rivinia/theme/theme.css';
```

Less ignores `exports`, so the explicit CSS file is required. CSS custom
properties pass through normally; Less variables are a separate mechanism.
