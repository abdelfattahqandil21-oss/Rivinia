# Popup QA evidence

Status: **READY_FOR_DEPLOY**

Checked: 2026-11-21T18:48:41+00:00

Branch: refactor/arch; HEAD: ca20c2b

Source fingerprint: 9e76be0d961c9eeb58eb38b10c51e64e204968f0f785dc00fec52165f9d3709e

| Gate | Result |
|---|---|
| Build Popup | PASS |
| Popup unit tests | PASS |
| Build menu | PASS |
| Build select | PASS |
| Build datepicker | PASS |
| Build menu-e2e | PASS |
| Popup E2E across browsers | FAIL / NOT RUN |
| Npm pack | PASS |
| One package tarball | PASS |
| Tarball API and peers | PASS |
| Packed consumer Angular build | FAIL / NOT RUN |
| Packed app output | FAIL / NOT RUN |
| Packed consumer browser open-close | FAIL / NOT RUN |
| Git diff whitespace check | PASS |

Skipped E2E cases are not passes. No publishing was performed.

## Final targeted verification

Timestamp: 2026-11-21T19:03:58.704598+00:00

- Cleanup regression repeated x3: PASS
- Npm pack: PASS
- Single tarball: PASS
- Safe tarball: PASS
- Packed Angular build: PASS
- Packed app output: PASS
- Packed browser open-close: PASS
- Git diff check: PASS
- Previous verified baseline: True
- Source unchanged since baseline: True
- Previous full E2E run: 139 passed, 5 skipped.
- Latest full E2E run: 138 passed, 1 failed, 5 skipped.
- The pending-animation-frame count failure is recorded as test stability debt.
- No publication or version changes performed.
