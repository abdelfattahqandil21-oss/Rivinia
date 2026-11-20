import { SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';
import type { Rule } from '@angular-devkit/schematics';
import ts from 'typescript';
import { applyReviewedPlan } from './reviewed-apply.js';
import { applyEnvironmentPlanToTree } from './analysis/environment-plan-apply.js';
import type { MutationEnvironmentPlan } from './analysis/environment-plan-model.js';
import type { ReviewedApplyOptions } from './reviewed-apply.js';
import { createMutationProposalPlan } from './mutation-proposal.js';
import { isSafeConsumerPath, isSafeConsumerReadPath } from './reviewed-apply.js';
import { inspectWorkspaceTree } from './inspect-workspace.js';

type NgAddOptions = Omit<Partial<ReviewedApplyOptions>, 'project'> & {
  readonly project?: string;
  readonly environments?: Array<'dev' | 'stage' | 'prod'> | string;
  readonly proposalFile?: string;
  readonly apply?: boolean;
};

export default function ngAdd(options: NgAddOptions): Rule {
  if (!hasReviewedWorkflowOptions(options)) return scaffoldEnvironments(options);

  return async (tree, context) => {
    if (options.proposalFile) {
      if (
        !options.apply ||
        options.planFile ||
        options.reviewedDigest ||
        options.acceptConfigurationMapping ||
        options.acceptEnvironmentSemantics ||
        options.force
      ) {
        throw new SchematicsException(
          'ENV_ADD_OPTIONS_CONFLICT: proposalFile requires explicit --apply consent and cannot be combined with reviewed-plan options.',
        );
      }
      const plan = await createMutationProposalPlan(tree, options.project, options.proposalFile);
      if (plan.status !== 'ready' || plan.conflicts.length > 0) {
        throw new SchematicsException(
          `ENV_ADD_SETUP_BLOCKED: no files were changed. ${plan.conflicts.map(({ code }) => code).join(', ') || 'Resolve the inspection diagnostics and revise proposalFile.'}`,
        );
      }
      const acceptedDecisionIds = plan.proposedDecisions
        .filter(({ authority }) => authority === 'explicit-proposal')
        .map(({ id }) => id)
        .sort();
      const result = await applyEnvironmentPlanToTree({
        tree,
        plan,
        approval: { reviewedDigest: plan.integrity.digest, acceptedDecisionIds },
        consumerRoot: '/',
        isPathSafe: (_root, relativePath) => isSafeConsumerPath(process.cwd(), relativePath),
        isReadPathSafe: (_root, relativePath) =>
          isSafeConsumerReadPath(process.cwd(), relativePath),
      });
      if (!result.ok) {
        throw new SchematicsException(
          `${result.code}: automatic setup was refused without consumer file changes.`,
        );
      }
      const created = plan.operations.filter(
        ({ kind }) => kind === 'create-environment-file',
      ).length;
      const replacements = plan.operations.filter(
        ({ kind }) => kind === 'add-file-replacement',
      ).length;
      context.logger.info(`ENV_FILE_CREATION_${created ? 'SUCCESS' : 'NOOP'}: ${created} file(s).`);
      context.logger.info(
        `ENV_CONFIGURATION_WIRING_${replacements ? 'SUCCESS' : 'NOOP'}: ${replacements} replacement(s).`,
      );
      context.logger.warn(
        'ENVIRONMENT_VALUES_CONSUMER_APPROVED_UNVERIFIED: proposalFile explicitly selected these source files; values were preserved verbatim, and runtime semantic correctness is not verified.',
      );
      return result.tree;
    }

    if (!options.planFile || !options.reviewedDigest) {
      if (options.apply) {
        throw new SchematicsException(
          'ENV_ADD_CHOICES_REQUIRED: --apply does not select environment sources or build configurations. Provide proposalFile with explicit choices, or a reviewed plan and digest.',
        );
      }
      const inspected = await inspectWorkspaceTree(tree, options.project);
      const unsupportedRenderDiagnostic = inspected.diagnostics.find((diagnostic) =>
        diagnostic.startsWith('ENV_RENDER_MODE_UNSUPPORTED:'),
      );
      if (unsupportedRenderDiagnostic) {
        throw new SchematicsException(
          `${unsupportedRenderDiagnostic} ng add did not mutate the workspace; use read-only Inspect for this rendering mode.`,
        );
      }
      const configuredEnvironments = inspected.plan?.operations.filter(
        ({ environment }) => environment !== 'base',
      );
      const baseEnvironmentPath = inspected.plan?.operations.find(
        ({ environment }) => environment === 'base',
      )?.sourcePath;
      if (
        inspected.plan &&
        !inspected.plan.inputHashes.every(({ path }) => isSafeConsumerReadPath(process.cwd(), path))
      ) {
        throw new SchematicsException(
          'ENV_PLAN_PATH_INVALID: fresh Inspect found an input path that crosses a symlink or leaves the consumer workspace; no files were changed.',
        );
      }
      if (
        inspected.plan?.status === 'reviewable' &&
        configuredEnvironments?.length &&
        baseEnvironmentPath &&
        configuredEnvironments.every(
          ({ environment, sourcePath }) =>
            isSafeConsumerPath(process.cwd(), sourcePath) &&
            inspected.plan!.project.build?.fileReplacements.some(
              ({ configuration, replace, with: replacement }) =>
                replace === baseEnvironmentPath &&
                isSafeConsumerPath(process.cwd(), replace) &&
                replacement.endsWith(`environment.${environment}.generated.ts`) &&
                inspected.plan!.project.build!.configurations.includes(configuration ?? '') &&
                isSafeConsumerPath(process.cwd(), replacement) &&
                tree.exists(`/${replace}`) &&
                tree.exists(`/${replacement}`) &&
                hasValidTypeScriptSyntax(tree.readText(`/${replacement}`), replacement),
            ),
        )
      ) {
        context.logger.info(
          'ENV_ADD_SETUP_CONFIGURED_VALUES_UNVERIFIED: fresh Inspect found matching build replacements and existing source/target files; no files changed. This no-op confirms setup structure only; it does not run a consumer build or verify environment semantics.',
        );
        return tree;
      }
      throw new SchematicsException(
        `ENV_ADD_CHOICES_REQUIRED: provide proposalFile with explicit source and configuration choices plus --apply consent, or provide planFile and reviewedDigest for reviewed Apply.${inspected.diagnostics.length ? ` ${inspected.diagnostics.join(' ')}` : ''}`,
      );
    }
    return applyReviewedPlan(tree, context, options as ReviewedApplyOptions);
  };
}

function hasReviewedWorkflowOptions(options: NgAddOptions): boolean {
  return Boolean(
    options.proposalFile ||
      options.planFile ||
      options.reviewedDigest ||
      options.apply ||
      options.acceptConfigurationMapping ||
      options.acceptEnvironmentSemantics ||
      options.force,
  );
}

function hasValidTypeScriptSyntax(sourceText: string, fileName: string): boolean {
  const result = ts.transpileModule(sourceText, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.Latest },
  });
  return !result.diagnostics?.some(({ category }) => category === ts.DiagnosticCategory.Error);
}

interface FileDef {
  name: string;
  content: (version: string) => string;
}

const MODEL_FILE = `import type { BaseEnvironment } from '@rivinia/env';

/**
 * Application environment contract. Extend with your own fields
 * (apiUrl, keys, feature flags, …) — nothing else in the app should
 * import environment values except through this type.
 */
export interface AppEnvironment extends BaseEnvironment {
  /** Base URL for API calls (per-environment value below). */
  readonly apiUrl: string;
}
`;

const ALL_ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;
type EnvironmentName = (typeof ALL_ENVIRONMENTS)[number];

/** Short aliases users actually type (`prod`, `dev`, `stag`). */
const ENVIRONMENT_ALIASES: Record<string, EnvironmentName> = {
  dev: 'dev',
  prod: 'prod',
  stag: 'stage',
  stage: 'stage',
};

/** Output directory short names: builds/dev, builds/prod, builds/stag. */
const OUTPUT_DIR: Record<EnvironmentName, string> = {
  dev: 'builds/dev',
  stage: 'builds/stag',
  prod: 'builds/prod',
};

/** Public short configuration names used by `ng build --configuration`. */
const CONFIG_NAME: Record<EnvironmentName, string> = {
  dev: 'dev',
  stage: 'stag',
  prod: 'prod',
};

/** Existing long configuration names remain wired for compatibility. */
const LEGACY_CONFIG_NAME: Record<EnvironmentName, string> = {
  dev: 'development',
  stage: 'staging',
  prod: 'production',
};

const fileDefs = (sourceRoot: string, selected: readonly EnvironmentName[]): FileDef[] => {
  const files: FileDef[] = [
    { name: `${sourceRoot}/environments/environment.model.ts`, content: () => MODEL_FILE },
    // The base file is always scaffolded: it is the `replace` source for
    // prod/stag swaps (and what dev uses directly).
    {
      name: `${sourceRoot}/environments/environment.ts`,
      content: (version: string) =>
        `import type { AppEnvironment } from './environment.model';\n\n` +
        `/** Development defaults. Used as-is by the \`dev\` configuration. */\n` +
        `export const environment: AppEnvironment = {\n` +
        `  production: false,\n` +
        `  version: '${version}',\n` +
        `  apiUrl: 'http://localhost:3000/api',\n` +
        `};\n`,
    },
  ];
  if (selected.includes('stage')) {
    files.push({
      name: `${sourceRoot}/environments/environment.staging.ts`,
      content: (version: string) =>
        `import type { AppEnvironment } from './environment.model';\n\n` +
        `/** Staging mirrors production. Wired via the \`stag\` configuration. */\n` +
        `export const environment: AppEnvironment = {\n` +
        `  production: true,\n` +
        `  version: '${version}',\n` +
        `  apiUrl: 'https://staging.example.com/api',\n` +
        `};\n`,
    });
  }
  if (selected.includes('prod')) {
    files.push({
      name: `${sourceRoot}/environments/environment.prod.ts`,
      content: (version: string) =>
        `import type { AppEnvironment } from './environment.model';\n\n` +
        `export const environment: AppEnvironment = {\n` +
        `  production: true,\n` +
        `  version: '${version}',\n` +
        `  apiUrl: 'https://api.example.com/api',\n` +
        `};\n`,
    });
  }
  return files;
};

/**
 * `ng add @rivinia/env` — scaffolds typed environment files and wires
 * dev/stag/prod configurations with file replacements.
 *
 * - Never overwrites existing files (each file skipped individually).
 * - Never removes user configuration: only ADDS missing fileReplacements
 *   (one per source file) and creates short configurations from their legacy
 *   equivalents when absent.
 * - `dev` intentionally gets no replacement (it uses `environment.ts`).
 *   Existing `development`, `staging`, and `production` configurations remain
 *   wired for compatibility.
 * - App version is snapshotted from the app's `package.json` (`0.0.0` fallback).
 */
function scaffoldEnvironments(options: NgAddOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const workspace = readWorkspace(tree, context, options.project);
    if (!workspace) return tree;
    const { name, project, angular } = workspace;

    const sourceRoot = project.sourceRoot ?? (project.root ? `${project.root}/src` : 'src');
    const version = readAppVersion(tree);
    // Empty selection (or engine default) means everything — same as --defaults.
    // Accepts arrays (prompt/programmatic) and comma strings (CLI flags), with
    // short aliases (dev/prod/stag/stage) normalized before validation.
    const rawSelected = options.environments;
    const asArray: string[] = Array.isArray(rawSelected)
      ? [...rawSelected]
      : typeof rawSelected === 'string'
        ? rawSelected.split(',')
        : [];
    const cleaned = asArray
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
      .map((e) => ENVIRONMENT_ALIASES[e] ?? e);
    const unknown = [...new Set(cleaned)].filter(
      (e) => !(ALL_ENVIRONMENTS as readonly string[]).includes(e),
    );
    if (unknown.length > 0) {
      throw new SchematicsException(
        `[rivinia/env] unknown environment(s): ${unknown.join(', ')}. ` +
          `Choose from dev, stage (stag), prod.`,
      );
    }
    const selected: EnvironmentName[] =
      cleaned.length > 0 ? ([...new Set(cleaned)] as EnvironmentName[]) : [...ALL_ENVIRONMENTS];
    const configsSnapshot = (): string =>
      JSON.stringify(project.architect?.build?.configurations ?? null);
    const configsBefore = configsSnapshot();

    let created = 0;
    for (const file of fileDefs(sourceRoot, selected)) {
      const path = `/${file.name}`;
      if (tree.exists(path)) {
        context.logger.info(`[rivinia/env] exists, skipped: ${path}`);
        continue;
      }
      tree.create(path, file.content(version));
      created++;
    }

    if (selected.includes('prod')) {
      ensureNamedConfig(tree, angular, name, 'prod', ['production'], context);
      const replacement = {
        replace: `${sourceRoot}/environments/environment.ts`,
        with: `${sourceRoot}/environments/environment.prod.ts`,
      };
      ensureReplacement(tree, angular, name, 'prod', replacement);
      ensureReplacement(tree, angular, name, 'production', replacement);
    }
    if (selected.includes('stage')) {
      ensureStaging(tree, angular, name, sourceRoot, context);
    }
    if (selected.includes('dev')) {
      ensureNamedConfig(tree, angular, name, 'dev', ['development'], context);
    }
    ensureOutputPaths(tree, angular, name, selected, context);

    if (created > 0 || configsSnapshot() !== configsBefore) {
      tree.overwrite('/angular.json', JSON.stringify(angular, null, 2) + '\n');
    }
    context.logger.info(
      `[rivinia/env] ${created} file(s) created, configurations wired for '${name}'.`,
    );
    return tree;
  };
}

interface ProjectDef {
  root?: string;
  sourceRoot?: string;
  architect?: {
    build?: {
      configurations?: Record<string, Record<string, unknown>>;
    };
  };
}

function readWorkspace(
  tree: Tree,
  context: SchematicContext,
  requested?: string,
): {
  name: string;
  project: ProjectDef;
  angular: {
    projects?: Record<string, ProjectDef>;
    defaultProject?: string;
  };
} | null {
  let angular: {
    projects?: Record<string, ProjectDef>;
    defaultProject?: string;
  };
  try {
    const raw = tree.read('/angular.json')?.toString('utf-8');
    if (!raw) throw new SchematicsException('angular.json not found.');
    angular = JSON.parse(raw) as {
      projects?: Record<string, ProjectDef>;
      defaultProject?: string;
    };
  } catch (error) {
    context.logger.warn(
      `[rivinia/env] cannot read angular.json (${error instanceof Error ? error.message : error}) — skipping.`,
    );
    return null;
  }
  const names = Object.keys(angular.projects ?? {});
  if (names.length === 0) {
    context.logger.warn('[rivinia/env] no projects in angular.json — skipping.');
    return null;
  }
  // NOTE: the schema default for `project` is "" (engine-filled), so only a
  // non-empty value counts as an explicit request. (`??` alone would honor "".)
  const name =
    requested && requested.length > 0
      ? requested
      : angular.defaultProject && typeof angular.defaultProject === 'string'
        ? angular.defaultProject
        : names[0];
  const project = angular.projects?.[name];
  if (!project) {
    context.logger.warn(`[rivinia/env] project '${name}' not found — skipping.`);
    return null;
  }
  return { name, project, angular };
}

function readAppVersion(tree: Tree): string {
  try {
    const raw = tree.read('/package.json')?.toString('utf-8');
    if (!raw) return '0.0.0';
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.length > 0
      ? parsed.version
      : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getConfigurations(
  angular: { projects?: Record<string, ProjectDef> },
  name: string,
): Record<string, Record<string, unknown>> {
  const project = angular.projects?.[name];
  if (!project) throw new SchematicsException(`[rivinia/env] project '${name}' not found.`);
  project.architect ??= {};
  project.architect.build ??= {};
  const build = project.architect.build as {
    configurations?: Record<string, Record<string, unknown>>;
  };
  build.configurations ??= {};
  return build.configurations;
}

function ensureReplacement(
  tree: Tree,
  angular: { projects?: Record<string, ProjectDef> },
  name: string,
  configuration: string,
  entry: { replace: string; with: string },
): void {
  if (!tree.exists('/angular.json')) return;
  const configurations = getConfigurations(angular, name);
  const target = configurations[configuration];
  if (!target) return;
  const list = target['fileReplacements'];
  if (!Array.isArray(list)) {
    target['fileReplacements'] = [{ ...entry }];
    return;
  }
  const matches = list
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        typeof item === 'object' &&
        item !== null &&
        (item as Record<string, unknown>)['replace'] === entry.replace,
    );
  if (matches.length === 0) {
    list.push({ ...entry });
    return;
  }
  const firstIndex = matches[0].index;
  list[firstIndex] = { ...entry };
  for (const { index } of matches.slice(1).reverse()) list.splice(index, 1);
}

/**
 * Points each selected configuration at its build directory
 * (builds/dev, builds/stag, builds/prod) — but only when the app has not
 * customized `outputPath` already. Never overwrites user output locations.
 */
function ensureOutputPaths(
  tree: Tree,
  angular: { projects?: Record<string, ProjectDef> },
  name: string,
  selected: readonly EnvironmentName[],
  context: SchematicContext,
): void {
  if (!tree.exists('/angular.json')) return;
  const configurations = getConfigurations(angular, name);
  let touched = false;
  for (const env of selected) {
    for (const configName of [CONFIG_NAME[env], LEGACY_CONFIG_NAME[env]]) {
      const target = configurations[configName];
      if (!target || 'outputPath' in target) continue;
      target['outputPath'] = OUTPUT_DIR[env];
      touched = true;
    }
  }
  if (touched) ensureGitignore(tree, context);
}

/** Appends `/builds` to the app .gitignore once (build outputs don't commit). */
function ensureGitignore(tree: Tree, context: SchematicContext): void {
  if (!tree.exists('/.gitignore')) return;
  const content = tree.read('/.gitignore')?.toString('utf-8') ?? '';
  if (/(^|\n)\/*builds\/?(\n|$)/.test(content)) return;
  tree.overwrite('/.gitignore', content.replace(/\s*$/, '\n') + '/builds\n');
  context.logger.info('[rivinia/env] added /builds to .gitignore.');
}

function ensureStaging(
  tree: Tree,
  angular: { projects?: Record<string, ProjectDef> },
  name: string,
  sourceRoot: string,
  context: SchematicContext,
): void {
  if (!tree.exists('/angular.json')) return;
  ensureNamedConfig(tree, angular, name, 'stag', ['staging', 'production'], context);
  ensureNamedConfig(tree, angular, name, 'staging', ['stag', 'production'], context);
  const replacement = {
    replace: `${sourceRoot}/environments/environment.ts`,
    with: `${sourceRoot}/environments/environment.staging.ts`,
  };
  ensureReplacement(tree, angular, name, 'stag', replacement);
  ensureReplacement(tree, angular, name, 'staging', replacement);
}

function ensureNamedConfig(
  tree: Tree,
  angular: { projects?: Record<string, ProjectDef> },
  name: string,
  configuration: string,
  fallbacks: readonly string[],
  context: SchematicContext,
): void {
  if (!tree.exists('/angular.json')) return;
  const configurations = getConfigurations(angular, name);
  if (configurations[configuration]) return;

  const source = fallbacks
    .map((fallback) => configurations[fallback])
    .find((candidate) => candidate && typeof candidate === 'object');
  const copy = source
    ? (JSON.parse(JSON.stringify(source)) as Record<string, unknown>)
    : {};
  delete copy['outputPath'];
  configurations[configuration] = copy;
  context.logger.info(`[rivinia/env] created \`${configuration}\` configuration.`);
}
