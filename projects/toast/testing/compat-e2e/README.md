# Toast compatibility consumer fixture

This app imports the built `@rivinia/toast/ui` entry point. Its `standalone`
configuration has no Theme stylesheet; its `theme` configuration consumes the
built `@rivinia/theme` CSS export. The Chromium contract suite checks status
fallbacks, global and scoped semantic values, instance-token precedence, rich
colors, accessible status text, and light/dark Theme values.

Playwright uses its bundled Chromium by default. Set
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use a system Chromium build.

From the repository root, build the exact package artifacts and app before each
browser run:

```sh
pnpm exec ng build toast
pnpm exec ng build theme
pnpm exec ng build toast-compat-e2e --configuration=standalone
TOAST_E2E_BUILD=standalone pnpm exec playwright test --config=projects/toast/testing/e2e/playwright.config.ts
pnpm exec ng build toast-compat-e2e --configuration=theme
TOAST_E2E_BUILD=theme pnpm exec playwright test --config=projects/toast/testing/e2e/playwright.config.ts
```
