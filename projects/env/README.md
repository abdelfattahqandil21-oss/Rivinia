# @rivinia/env

[![npm version](https://img.shields.io/npm/v/@rivinia/env.svg)](https://www.npmjs.com/package/@rivinia/env)
[![license](https://img.shields.io/npm/l/@rivinia/env.svg)](https://opensource.org/licenses/MIT)

Typed application environment contracts and Angular CLI schematics for inspecting, planning, and applying build-time environment configuration.

Package version: **1.0.5**

```ts
import type { BaseEnvironment } from '@rivinia/env';

export interface AppEnvironment extends BaseEnvironment {
  readonly apiUrl: string;
}
```

## Install

```bash
npm install @rivinia/env
```

## Inspect and plan environment configuration

The `inspect` schematic is read-only. It records the selected application's environment sources, build configurations, and diagnostics in a plan file:

```bash
ng generate @rivinia/env:inspect --project=admin --plan-file=plans/environment-inspection.json
```

To propose changes, explicitly select source and destination paths in a proposal JSON file, then create a reviewable plan:

```bash
ng generate @rivinia/env:propose --project=admin \
  --proposal-file=plans/environment-proposals.json \
  --plan-file=plans/environment-plan.json
```

Review the plan and its selected source files before applying it. Supply the plan digest and any decision flags requested by the plan:

```bash
ng generate @rivinia/env:apply --project=admin \
  --plan-file=plans/environment-plan.json \
  --reviewed-digest=<plan-integrity-digest>
```

The `validate-plan` schematic checks a saved plan without mutating the workspace. The optional `environment-model` schematic can propose and apply a supported typed model after separate explicit review. Full proposal formats, supported builders, failure cases, and security limits are documented in [the environment workflow guide](../../docs/env/explicit-workflow.md).

## One `ng add` schematic

The existing scaffold behavior stays available when `ng add @rivinia/env` is run with only `--project` and/or `--environments`. It creates missing development/staging/production examples and wires build configurations without overwriting files. Review generated values and configuration changes before use.

The same `ng add` schematic also accepts an explicit proposal plus `--apply`, or a reviewed plan and digest. Those options select the review-first path; see [the environment workflow guide](../../docs/env/explicit-workflow.md). Separate `inspect`, `propose`, `apply`, `validate-plan`, and `environment-model` schematics are available for step-by-step workflows.

## Environment values are public

Angular environment files are compiled into the application bundle. Treat every value in them as public; never put secrets, credentials, or private keys there. The schematics do not execute consumer TypeScript or transform environment values. Unsupported builders and server rendering modes fail closed.

## Public API

| Export | Kind | Purpose |
| --- | --- | --- |
| `BaseEnvironment` | type | Requires readonly `production: boolean` and `version: string` fields. |

## Compatibility

| Angular CLI | Node | Package behavior |
| --- | --- | --- |
| `^22.0.0` | `^22.22.3 or ^24.15.0 or >=26.0.0` | Type contract and build-time schematics; no runtime environment service |

## Go further

| Topic | Read |
| --- | --- |
| Reviewed workflow | [Environment workflow](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/env/v1.0.5/docs/env/explicit-workflow.md) |
| Existing scaffold options | [Scaffold environments](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/env/v1.0.5/docs/env/scaffolding.md) |

## License

MIT.
