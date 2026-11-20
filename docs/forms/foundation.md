# Forms foundation pilot

The pilot lives in the original Rivinia workspace as a private package. It exercises the public imports and Angular Package Format before any decision on release-group membership or a split into publishable packages.

## Boundaries

- The native directive preserves browser and Angular forms behavior. It adds a CSS class for consumer styling.
- The field wrapper only presents messages and labels. The application controls the layout, validation policy and accessible descriptions. Error replaces hint while the description remains.
- The decimal control uses Angular's FormValueControl with no custom value accessor. The value belongs to Angular or the consumer. The editor owns its draft, including intermediate values. Locale resolution is computed once per locale change.
- Angular core and forms are peers. Theme tokens inherit through CSS. No dependency on other Rivinia packages or on a dynamic registry.
- The decimal parser is an implementation detail. A shared headless entry point is justified only once multiple controls need the same contract.

## Follow-up verification

- The Desktop consumer installs the packed pilot and uses it for a case summary inside Modal and a recovery amount editor inside Table. Chrome passed desktop, 320px Modal field geometry, table editing, and an Arabic decimal commit under RTL.
- Compare native-only and decimal-enabled production routes, recording initial JS/CSS and network requests before setting budgets.
- Exercise keyboard and IME behavior, Arabic and English, 320px layouts, scoped light/dark themes, and SSR hydration in a real browser.
- Wire draft rejection into the consumer's submit policy. An invalid draft preserves the previous committed model.
- Establish a release-group admission decision before assigning a public release version.
