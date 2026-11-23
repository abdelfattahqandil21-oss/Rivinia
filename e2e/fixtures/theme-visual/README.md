# Theme Visual Lab — real Angular consumer

This isolated workspace fixture uses the actual built `@rivinia/theme/toggle`, `@rivinia/theme/headless` and `@rivinia/theme/motion` entry points. Styling comes from `dist/theme/styles/theme.css`, `dist/theme/motion.css`, and fixture-owned CSS. It does **not** mimic the Toggle in static HTML.

From repository root (branch `theme/v.2`):

```bash
pnpm exec ng build theme
pnpm exec ng serve theme-visual-e2e --host 127.0.0.1 --port 4308 --open
```

Visit http://127.0.0.1:4308/ while the `ng serve` command stays running. Changes to **library source** require `pnpm exec ng build theme` again because the fixture consumes `dist/theme`. Changes to fixture files reload through the dev server.

Playwright browser checks, in a separate terminal:

```bash
pnpm exec playwright test -c playwright.theme-visual.config.ts --project=chromium
pnpm exec playwright test -c playwright.theme-visual.config.ts --project=chromium --headed
pnpm exec playwright test -c playwright.theme-visual.config.ts
```

The test runner can start its own dev server; if one is already running at port 4308, it reuses it. For manual visual review, keep `ng serve` running and use the browser directly. `--headed` runs automated tests and closes the browser afterward.

Changes are limited to the new fixture, its Playwright tests/config, and one `angular.json` project entry. No library production file is changed. Never publish or bump versions as part of visual review.
