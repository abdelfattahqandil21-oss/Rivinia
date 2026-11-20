import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { SchematicsException } from '@angular-devkit/schematics';
import type { SchematicContext, Tree } from '@angular-devkit/schematics';
import { applyEnvironmentPlanToTree } from './analysis/environment-plan-apply.js';
import type {
  EnvironmentPlan,
  MutationEnvironmentPlan,
} from './analysis/environment-plan-model.js';
import { isCanonicalRelativePath } from './analysis/environment-plan-utils.js';
import { getUnsupportedRenderModes } from './analysis/render-mode.js';
import {
  findEffectiveOutputPathCollision,
  findOtherProjectOutputPathCollision,
} from './analysis/output-paths.js';
import { discoverWorkspace } from './analysis/workspace-discovery.js';
import { createTreeWorkspaceHost } from './tree-workspace-host.js';

export interface ReviewedApplyOptions {
  readonly planFile: string;
  readonly reviewedDigest: string;
  readonly acceptConfigurationMapping?: boolean;
  readonly acceptEnvironmentSemantics?: boolean;
  readonly force?: boolean;
  readonly project?: string;
}

export async function applyReviewedPlan(
  tree: Tree,
  context: SchematicContext,
  options: ReviewedApplyOptions,
): Promise<Tree> {
  if (options.force) {
    throw new SchematicsException(
      'ENV_FORCE_UNSUPPORTED: --force never bypasses reviewed-plan, ownership, or path-safety checks.',
    );
  }
  if (!isSafePlanFile(tree, options.planFile)) {
    throw new SchematicsException(
      'ENV_PLAN_FILE_INVALID: use an existing canonical workspace-relative plan path.',
    );
  }

  let plan: EnvironmentPlan;
  try {
    const parsed: unknown = JSON.parse(tree.readText(treePath(options.planFile)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Invalid plan object.');
    plan = parsed as EnvironmentPlan;
  } catch {
    throw new SchematicsException('ENV_PLAN_FILE_INVALID: the plan is not valid JSON.');
  }
  if (plan.planKind !== 'mutation') {
    throw new SchematicsException('ENV_PLAN_NOT_MUTATION: inspect-only plans cannot be applied.');
  }
  if (options.project && options.project !== plan.project.name) {
    throw new SchematicsException(
      'ENV_APPLY_PROJECT_MISMATCH: the reviewed plan selects another project.',
    );
  }

  const discovered = await discoverWorkspace(createTreeWorkspaceHost(tree), {
    projectName: plan.project.name,
  });
  if (!discovered.ok) {
    throw new SchematicsException(
      `${discovered.diagnostics.map(({ code }) => code).join(', ')}: current workspace cannot be safely verified for Apply.`,
    );
  }
  const effectiveStacks = plan.operations
    .filter(
      (operation) =>
        operation.kind === 'add-file-replacement' ||
        operation.kind === 'confirm-file-replacement-present',
    )
    .map(({ configurationStack }) => configurationStack);
  const unsupportedModes = new Set(
    effectiveStacks.flatMap((stack) =>
      getUnsupportedRenderModes(discovered.project.build, [stack]),
    ),
  );
  if (unsupportedModes.size > 0) {
    throw new SchematicsException(
      `ENV_RENDER_MODE_UNSUPPORTED: reviewed mutation was refused without consumer file changes because the current effective build configuration enables ${[...unsupportedModes].sort().join(', ')}. Read-only Inspect remains available; SSR/SSG behavior is not verified.`,
    );
  }
  for (const operation of plan.operations) {
    if (
      operation.kind !== 'add-file-replacement' &&
      operation.kind !== 'confirm-file-replacement-present'
    )
      continue;
    const selectedOutput = findEffectiveOutputPathCollision(
      discovered.project.build,
      operation.configurationStack,
      operation.with,
    );
    const otherOutput = findOtherProjectOutputPathCollision(
      discovered.buildTargets,
      plan.project.name,
      operation.with,
    );
    if (selectedOutput.kind !== 'none' || otherOutput.kind !== 'none') {
      const outputPath =
        selectedOutput.kind === 'collision' || otherOutput.kind === 'collision'
          ? selectedOutput.kind === 'collision'
            ? selectedOutput.path
            : otherOutput.kind === 'collision'
              ? otherOutput.path
              : operation.with
          : operation.with;
      throw new SchematicsException(
        `${selectedOutput.kind === 'collision' || otherOutput.kind === 'collision' ? 'ENV_PLAN_OUTPUT_COLLISION' : 'ENV_PLAN_OUTPUT_PATH_UNVERIFIED'}: current build output paths conflict with or cannot be classified against the reviewed generated destination ${outputPath}; no consumer files were changed.`,
      );
    }
  }

  const acceptedDecisionIds = [
    ...(options.acceptConfigurationMapping ? ['configuration-mapping'] : []),
    ...(options.acceptEnvironmentSemantics ? ['environment-semantics'] : []),
  ];
  const result = await applyEnvironmentPlanToTree({
    tree,
    plan: plan as MutationEnvironmentPlan,
    approval: { reviewedDigest: options.reviewedDigest, acceptedDecisionIds },
    consumerRoot: '/',
    isPathSafe: (_root, relativePath) => isSafeConsumerPath(process.cwd(), relativePath),
    isReadPathSafe: (_root, relativePath) =>
      isSafeConsumerReadPath(process.cwd(), relativePath),
  });
  if (!result.ok) {
    throw new SchematicsException(`${result.code}: reviewed environment changes were not applied.`);
  }

  const created = plan.operations.filter(({ kind }) => kind === 'create-environment-file').length;
  const replacements = plan.operations.filter(({ kind }) => kind === 'add-file-replacement').length;
  context.logger.info(`ENV_FILE_CREATION_${created ? 'SUCCESS' : 'NOOP'}: ${created} file(s).`);
  context.logger.info(
    `ENV_CONFIGURATION_WIRING_${replacements ? 'SUCCESS' : 'NOOP'}: ${replacements} replacement(s).`,
  );
  context.logger.warn(
    created || replacements
      ? 'ENVIRONMENT_VALUES_CONSUMER_APPROVED_UNVERIFIED: the consumer selected and approved these source files; values were preserved verbatim, and the schematic does not claim runtime semantic correctness.'
      : 'ENVIRONMENT_VALUES_UNVERIFIED_NOOP: existing environment selections were preserved; runtime semantic correctness is not verified.',
  );
  return result.tree;
}

function isSafePlanFile(tree: Tree, path: string): boolean {
  return (
    isCanonicalRelativePath(path) &&
    tree.exists(treePath(path)) &&
    isSafeConsumerPath(process.cwd(), path)
  );
}

export function isSafeConsumerPath(root: string, path: string): boolean {
  if (!isCanonicalRelativePath(path)) return false;
  const consumerRoot = resolve(root);
  let realRoot: string;
  try {
    realRoot = realpathSync(consumerRoot);
  } catch {
    return false;
  }
  if (realRoot !== consumerRoot || !existsSync(join(consumerRoot, 'angular.json'))) return false;
  const target = resolve(consumerRoot, ...path.split('/'));
  const relativeTarget = relative(consumerRoot, target);
  if (
    !relativeTarget ||
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relativeTarget)
  ) {
    return false;
  }

  let current = consumerRoot;
  for (const segment of relativeTarget.split(/[\\/]/)) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      return false;
    }
  }
  return true;
}

/** Allows read-only inputs reached through symlinks that resolve inside the workspace. */
export function isSafeConsumerReadPath(root: string, path: string): boolean {
  if (!isCanonicalRelativePath(path)) return false;
  const consumerRoot = resolve(root);
  let realRoot: string;
  try {
    realRoot = realpathSync(consumerRoot);
  } catch {
    return false;
  }
  if (realRoot !== consumerRoot || !existsSync(join(consumerRoot, 'angular.json'))) return false;

  const relativeTarget = relative(consumerRoot, resolve(consumerRoot, ...path.split('/')));
  if (
    !relativeTarget ||
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relativeTarget)
  ) {
    return false;
  }

  let current = consumerRoot;
  for (const segment of relativeTarget.split(/[\\/]/)) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        const realTarget = realpathSync(current);
        const relativeRealTarget = relative(realRoot, realTarget);
        if (
          !relativeRealTarget ||
          relativeRealTarget === '..' ||
          relativeRealTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
          isAbsolute(relativeRealTarget)
        ) {
          return false;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      return false;
    }
  }
  return true;
}

export function treePath(path: string): string {
  return `/${path}`;
}
