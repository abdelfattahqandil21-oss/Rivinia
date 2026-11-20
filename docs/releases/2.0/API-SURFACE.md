# 2.0.0-alpha.1 API surface candidate

This is the owner-approved candidate baseline for the eight TypeScript entry
points tracked by [`scripts/api-surface.mjs`](../../scripts/api-surface.mjs):
the initial four synchronized packages, Menu, Select, Theme and i18n. The
exact, sorted names are in
[`scripts/api-surface.snapshot.json`](../../scripts/api-surface.snapshot.json);
[`scripts/tests/api-surface.spec.ts`](../../scripts/tests/api-surface.spec.ts)
checks that list against the current entry-point sources.

| Entry point | Published names |
| --- | ---: |
| `@rivinia/theme` | 0 |
| `@rivinia/select` | 15 |
| `@rivinia/select/ui` | 12 |
| `@rivinia/menu` | 16 |
| `@rivinia/menu/ui` | 25 |
| `@rivinia/i18n` | 35 |
| `@rivinia/i18n/ui` | 5 |
| `@rivinia/i18n/select` | 5 |
| **Total** | **113** |

Relative to the 1.0 freeze, the candidate adds 34 names in the Menu and Select
entries; the other 79 names are unchanged. The additions implement the shared
Menu/Select controller and composed UI described in
[D102](../../decisions/D102-popup-connected-panels-and-staged-v2-integration.md)
and the package [Menu API](../../menu/api.md) and
[Select API](../../select/api.md) references. The 1.0 list remains preserved in
[`scripts/api-surface-1.0.snapshot.json`](../../scripts/api-surface-1.0.snapshot.json)
and [its release record](../1.0/API-SURFACE.md).

This document records an API baseline for the current candidate only. It is not
an authorization to merge, tag, or publish. It covers only the eight listed
entry points; `@rivinia/menu/router`, `@rivinia/select/headless`, and the other
packages in the synchronized release group are not included in this snapshot.
