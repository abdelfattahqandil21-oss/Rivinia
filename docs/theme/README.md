# Theming Rivinia components

Owned by [`@rivinia/theme`](../../projects/theme/README.md), this shared CSS
contract is read by Rivinia's component packages. Each package may additionally
expose component-specific tokens; those resolve through the shared semantic
names documented in [the token table](tokens.md).

## One token contract

The package root remains CSS-first. `theme.css` defines the V2 semantic names
for colors, shape, spacing, type, and elevation. Angular controller and UI APIs
are optional entry points; they change mode state, not the token contract.

```css
@import '@rivinia/theme';

:root {
  --rv-color-primary: #3157a4;
}

.account-card {
  --rv-color-surface: #f4f7fc;
}
```

Defaults are inside `@layer rivinia-theme`, so normal unlayered consumer CSS
wins regardless of import order. Import Theme globally, not from an Angular
component stylesheet where encapsulation rewrites global selectors.

## Modes and scopes

Theme defaults to light. Set `data-rv-theme="light"`, `"dark"`, or `"system"`
on the root or any nested element. `system` follows `prefers-color-scheme`;
explicit light and dark scopes take precedence for their descendants.

```html
<html data-rv-theme="system">
  <section data-rv-theme="dark">A nested dark region</section>
</html>
```

Native controls and scrollbars follow the nearest scope through `color-scheme`.
Consumers own `dir`; Theme never changes document direction. Portaled elements
follow their actual DOM ancestry.

## Optional Angular behavior

- `@rivinia/theme/headless` exports the signal-based controller, provider,
  theme-mode types, and native-button toggle directive.
- `@rivinia/theme/toggle` exports the ready-made single and segmented controls.
- `@rivinia/theme/motion` exports the View Transition coordinator;
  `@rivinia/theme/motion.css` provides its opt-in global snapshot animation.

CSS-only consumers have no Angular runtime requirement. Runtime entries require
Angular `^22.1.0`; persistence remains off unless configured.

## Adapters

Tailwind v4 maps semantic tokens to `rv-*` utility names using `@theme inline`,
so nested scopes resolve at the point of use. Bootstrap 5.3 maps its `--bs-*`
palette into the same Rivinia tokens. Import one base or adapter entry; each
adapter includes the base stylesheet.

See [styling stacks](styling-stacks.md), [component theming](component-theme.md),
and the [contrast notes](contrast.md).
