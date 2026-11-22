# i18n V2 — D06 SSR / Browser Storage contract

**Status:** KNOWN LIMITATION / VALIDATION DEFERRED (2026-11-22).

## Boundary

- SSR cannot read the browser's `localStorage` or `sessionStorage`. A server-rendered initial language is therefore based on server-visible configuration and, where supported, a request cookie, **not** client-only preferences.
- A browser preference may differ from the locale used to render the initial HTML. An exact no-flicker/no-hydration-mismatch guarantee for that combination has **not** been demonstrated on the new V2 artifact.
- The existing request-cookie and TransferState consumer paths passed the checked SSR suite. These successes must not be generalized into a guarantee for local/session storage preferences.
- No server-side cookie write is performed by the library. If the application needs server-visible persistence, it owns setting a suitable cookie and its security/privacy policy.

## Application guidance

For SSR apps that require a consistent initial HTML language and browser preference, prefer a request-visible cookie language strategy. Treat browser-only local/session preferences as client-side state until an explicit hydration policy has been designed and tested.

## Deferred acceptance criteria

1. Deliberately mismatch server-rendered locale and local/session storage locale.
2. Verify actual rendered text, `html[lang]`, `html[dir]`, hydration warnings, timing and dictionary refetch behavior.
3. Record and approve a deterministic policy; only then claim a hydration guarantee for these strategies.

**No behavior change in this Phase-1 closeout.**
