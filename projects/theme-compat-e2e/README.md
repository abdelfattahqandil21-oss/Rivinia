# Theme compatibility consumer fixture

This Angular host consumes the current workspace builds of Select, Datepicker,
DateTimepicker and Theme. The seven production configurations use the same
Angular components and data, but each gets its own output and one CSS stack:

| Configuration | Stylesheet stack |
| --- | --- |
| `plain` | Rivinia Theme base CSS |
| `tailwind` | Tailwind v4, including Preflight, plus the Rivinia adapter |
| `tailwind-no-preflight` | Tailwind theme/utilities and the Rivinia adapter |
| `tailwind-prefix` | Prefixed Tailwind v4 utilities and the Rivinia adapter |
| `bootstrap` | Bootstrap 5.3 Reboot plus the Rivinia adapter |
| `scss` | Rivinia Theme loaded through its Sass entry |
| `less` | Rivinia Theme CSS compiled by Angular's Less processor |

The PostCSS configuration is local to this project. No Tailwind or Bootstrap
configuration is installed at the workspace root. `token-overrides.css` uses
only public `--rv-*` custom properties on component hosts and wrapper scopes.

Run `pnpm build:theme-compat` to rebuild the popup, select, datepicker and theme
packages, produce every production output, assert CSS-stack isolation, compare
the existing `menu-e2e` and `i18n-e2e` output fingerprints before and after,
and write the bundle report under ignored `dist/theme-compat-e2e/`.

Run `pnpm test:theme-compat` to run the same Chromium interaction and styling
suite against each production configuration. Splitting configurations creates
separate builds; it does not claim lazy loading or code splitting.
