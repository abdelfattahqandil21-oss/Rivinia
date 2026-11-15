# Inspect and review environment changes

[Back to the `@rivinia/env` README](../../projects/env/README.md)

The environment workflow is available as named Angular CLI schematics. `inspect` is read-only; `propose` records explicit source and target choices; `validate-plan` checks a saved plan; `apply` mutates only after the plan and its inputs have been reviewed. The existing `ng add @rivinia/env` scaffold options remain available and are documented separately in [Scaffold environments](scaffolding.md).

## Inspect a project

```sh
ng generate @rivinia/env:inspect \
  --project=admin \
  --plan-file=plans/environment-inspection.json
```

The plan captures workspace and source fingerprints, discovered build and serve configurations, proposed operations, diagnostics, and an integrity digest. It does not include environment values. Inspect the plan and the referenced source files locally before continuing.

## Propose environment file wiring

Create a workspace-relative proposal file with the exact files and configuration mapping you intend to use:

```json
{
  "proposals": [
    {
      "environment": "development",
      "sourcePath": "apps/admin/src/environment.development.ts",
      "destinationPath": "apps/admin/src/environment.development.generated.ts",
      "configuration": "development",
      "configurationStack": ["development"],
      "replacePath": "apps/admin/src/environment.ts"
    }
  ]
}
```

Create a plan without changing the consumer source files:

```sh
ng generate @rivinia/env:propose \
  --project=admin \
  --proposal-file=plans/environment-proposals.json \
  --plan-file=plans/environment-plan.json
```

Review the proposal, plan, source files, destination paths, and configuration changes. The digest detects changes to the plan; it is not a substitute for reviewing its contents.

## Validate and apply

Validate a reviewed plan without applying it:

```sh
ng generate @rivinia/env:validate-plan \
  --plan-file=plans/environment-plan.json \
  --reviewed-digest=<plan-integrity-digest>
```

Apply only after review. Pass additional decision flags only when the plan reports that they are required:

```sh
ng generate @rivinia/env:apply \
  --project=admin \
  --plan-file=plans/environment-plan.json \
  --reviewed-digest=<plan-integrity-digest> \
  --accept-configuration-mapping \
  --accept-environment-semantics
```

For the explicit-first install flow, use `ng add` with a proposal file and `--apply`, or with a reviewed plan and digest:

```sh
ng add @rivinia/env --project=admin \
  --proposal-file=plans/environment-proposals.json --apply
```

```sh
ng add @rivinia/env --project=admin \
  --plan-file=plans/environment-plan.json \
  --reviewed-digest=<plan-integrity-digest>
```

When only `--project` and/or `--environments` are supplied, the same schematic runs the existing file scaffold. Adding proposal or reviewed-plan options selects the review-first path.

## Optional typed model generation

`environment-model` can propose and apply a bounded TypeScript model derived from environment sources. Proposal mode writes only the requested plan, inspection, and preview artifacts; all paths must be distinct, workspace-relative, safe, and new:

```sh
ng generate @rivinia/env:environment-model \
  --project=admin --mode=proposal \
  --plan-file=plans/environment-model.json \
  --inspection-plan-file=plans/environment-inspection.json \
  --preview-file=plans/environment.model.preview.ts
```

Review the full local preview and plan. Apply only with both reviewed SHA-256 values and explicit approval:

```sh
ng generate @rivinia/env:environment-model \
  --project=admin --mode=apply \
  --plan-file=plans/environment-model.json \
  --inspection-plan-file=plans/environment-inspection.json \
  --preview-file=plans/environment.model.preview.ts \
  --reviewed-digest=<reviewed-plan-sha256> \
  --reviewed-preview-sha256=<reviewed-preview-sha256> \
  --approve-model-generation
```

The current supported model subset is primitive properties, nested plain objects, fixed tuples, and homogeneous arrays of plain objects. Literal unions, mixed object-array shapes, methods, index signatures, and unresolved types are rejected. An existing model is treated as a conflict; the schematic does not merge or overwrite it.

## Safety and support limits

- Consumer TypeScript is parsed with the TypeScript compiler API and is never executed.
- Workspace JSON is parsed as JSONC; targeted edits preserve surrounding comments and formatting.
- Environment values are copied verbatim. Their deployment meaning is not verified.
- Browser bundles expose environment values. Never store secrets in them.
- Unsupported builders and SSR/SSG mutation are refused; the verified target is `@angular/build:application`.
- The checks assume a trusted local workspace and do not eliminate races with another process changing files during an operation.

Run `ng generate @rivinia/env:<name> --help` for the options supported by the installed package.
