import { createHash } from 'node:crypto';
import ts from 'typescript';
import { normalize } from '@angular-devkit/core';
import type { Tree } from '@angular-devkit/schematics';
import { discoverWorkspace } from './workspace-discovery.js';
import type { DiscoveredTarget } from './workspace-discovery.js';
import {
  findOtherProjectOutputPathCollision,
  findEffectiveOutputPathCollision,
} from './output-paths.js';
import { createAnalysisProgram } from './typescript-project-program.js';
import type { EnvironmentSourceInput } from './analysis-model.js';
import { createTreeWorkspaceHost } from '../tree-workspace-host.js';
import { deriveEnvironmentModel } from './environment-model.js';
import {
  validateEnvironmentModelPlanV4,
  verifyEnvironmentModelPlanV4,
} from './environment-model-plan-v4-validator.js';
import type {
  EnvironmentModelApprovalV4,
  EnvironmentModelPlanVerificationV4,
} from './environment-model-plan-v4-validator.js';
import type { EnvironmentModelPlanV4 } from './environment-model-plan-v4.js';
import type { EnvironmentPlanCurrentInput } from './environment-plan-model.js';
import { isPathSafeSafely } from './environment-plan-utils.js';

const MAX_MODEL_ANALYSIS_SOURCES = 128;
const MAX_MODEL_ANALYSIS_BYTES = 8_388_608;

export interface ApplyEnvironmentModelPlanV4ToTreeInput {
  readonly tree: Tree;
  readonly plan: unknown;
  readonly inspectionPlan: unknown;
  /** Captured by the review step, separately from the plan being applied. */
  readonly reviewedPlanDigest: string;
  readonly approval?: EnvironmentModelApprovalV4;
  readonly consumerRoot: string;
  readonly isPathSafe: (root: string, relativePath: string) => boolean;
}

export type ApplyEnvironmentModelPlanV4ToTreeResult =
  | {
      readonly ok: true;
      readonly tree: Tree;
      readonly path: string;
      readonly contentSha256: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | Extract<EnvironmentModelPlanVerificationV4, { readonly ok: false }>['code']
        | 'ENV_MODEL_APPLY_PROJECT_MISMATCH'
        | 'ENV_MODEL_APPLY_OUTPUT_COLLISION'
        | 'ENV_MODEL_APPLY_TYPESCRIPT_MISMATCH'
        | 'ENV_MODEL_APPLY_PROOF_UNAVAILABLE'
        | 'ENV_MODEL_APPLY_POSTCONDITION_FAILED'
        | 'ENV_MODEL_APPLY_OPERATION_FAILED';
    };

/**
 * Re-derives the model from the current virtual consumer snapshot, then creates it on a private
 * Tree branch. The caller receives that branch only after all byte and ownership postconditions pass.
 */
export async function applyEnvironmentModelPlanV4ToTree(
  input: ApplyEnvironmentModelPlanV4ToTreeInput,
): Promise<ApplyEnvironmentModelPlanV4ToTreeResult> {
  const structure = validateEnvironmentModelPlanV4(input.plan);
  if (!structure.ok) return structure;
  const plan = input.plan as EnvironmentModelPlanV4;
  if (input.reviewedPlanDigest !== plan.integrity.digest)
    return { ok: false, code: 'ENV_MODEL_REVIEW_MISMATCH' };
  if (plan.status !== 'ready') return { ok: false, code: 'ENV_MODEL_PLAN_BLOCKED' };

  const operation = plan.operations[0]!;
  const expectedPath = `${plan.project.sourceRoot}/environment.model.ts`;
  if (
    operation.path !== expectedPath ||
    operation.project.name !== plan.project.name ||
    operation.project.root !== plan.project.root ||
    operation.project.sourceRoot !== plan.project.sourceRoot ||
    operation.sourcePaths.some(
      (path) => path !== plan.project.sourceRoot && !path.startsWith(`${plan.project.sourceRoot}/`),
    )
  )
    return { ok: false, code: 'ENV_MODEL_APPLY_PROJECT_MISMATCH' };

  if (plan.typescriptVersion !== ts.version)
    return { ok: false, code: 'ENV_MODEL_APPLY_TYPESCRIPT_MISMATCH' };
  if (
    !plan.inputHashes.every(({ path }) =>
      isPathSafeSafely(input.isPathSafe, input.consumerRoot, path),
    ) ||
    !isPathSafeSafely(input.isPathSafe, input.consumerRoot, operation.path)
  )
    return { ok: false, code: 'ENV_MODEL_PATH_INVALID' };

  let currentInputs: EnvironmentPlanCurrentInput[];
  try {
    currentInputs = plan.inputHashes.map(({ path }) => {
      const treePath = toTreePath(path);
      return input.tree.exists(treePath)
        ? {
            path: absoluteInputPath(input.consumerRoot, path),
            exists: true,
            sourceText: input.tree.readText(treePath),
          }
        : { path: absoluteInputPath(input.consumerRoot, path), exists: false };
    });
  } catch {
    return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
  }

  if (
    operation.requiredInputPath !== operation.path ||
    input.tree.exists(toTreePath(operation.path))
  )
    return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };

  const workspace = await discoverWorkspace(createTreeWorkspaceHost(input.tree), {
    projectName: plan.project.name,
  });
  if (
    !workspace.ok ||
    workspace.project.root !== plan.project.root ||
    workspace.project.sourceRoot !== plan.project.sourceRoot
  )
    return { ok: false, code: 'ENV_MODEL_APPLY_PROJECT_MISMATCH' };
  const outputCollision = findOutputCollision(
    workspace.project.build,
    workspace.buildTargets,
    plan.project.name,
    operation.path,
  );
  if (outputCollision !== 'none') return { ok: false, code: 'ENV_MODEL_APPLY_OUTPUT_COLLISION' };

  const rederivedModelText = deriveModelFromTree(input.tree, plan, input.consumerRoot);
  if (rederivedModelText === undefined)
    return { ok: false, code: 'ENV_MODEL_APPLY_PROOF_UNAVAILABLE' };

  const eligibility = verifyEnvironmentModelPlanV4(
    plan,
    input.inspectionPlan,
    input.approval,
    input.consumerRoot,
    currentInputs,
    input.isPathSafe,
    rederivedModelText,
  );
  if (!eligibility.ok) return eligibility;
  if (input.reviewedPlanDigest !== plan.integrity.digest)
    return { ok: false, code: 'ENV_MODEL_REVIEW_MISMATCH' };

  const initialSnapshot = snapshotTree(input.tree);
  if (!initialSnapshot) return { ok: false, code: 'ENV_MODEL_APPLY_OPERATION_FAILED' };
  try {
    const staged = input.tree.branch();
    const destination = toTreePath(operation.path);
    if (staged.exists(destination)) return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
    staged.create(destination, rederivedModelText);
    if (
      !verifyStagedTree(
        input.tree,
        staged,
        initialSnapshot,
        destination,
        rederivedModelText,
        operation.expectedContentSha256,
      ) ||
      !isPathSafeSafely(input.isPathSafe, input.consumerRoot, operation.path)
    )
      return { ok: false, code: 'ENV_MODEL_APPLY_POSTCONDITION_FAILED' };
    return {
      ok: true,
      tree: staged,
      path: operation.path,
      contentSha256: operation.expectedContentSha256,
    };
  } catch {
    return { ok: false, code: 'ENV_MODEL_APPLY_OPERATION_FAILED' };
  }
}

function deriveModelFromTree(
  tree: Tree,
  plan: EnvironmentModelPlanV4,
  consumerRoot: string,
): string | undefined {
  const operation = plan.operations[0]!;
  let inputs: EnvironmentSourceInput[];
  try {
    inputs = operation.sourcePaths.map((path) => ({
      name: path,
      fileName: absoluteInputPath(consumerRoot, path),
      sourceText: tree.readText(toTreePath(path)),
      kind: 'environment',
    }));
  } catch {
    return undefined;
  }
  const project = {
    rootDirectory: consumerRoot,
    tsconfigFileName: absoluteInputPath(consumerRoot, operation.tsconfigPath),
    readFile: (absolutePath: string) => {
      const relativePath = toRootRelativePath(consumerRoot, absolutePath);
      if (!relativePath || !isCanonicalTreePath(relativePath)) return undefined;
      const path = toTreePath(relativePath);
      return tree.exists(path) ? tree.readText(path) : undefined;
    },
  };
  const analysis = createAnalysisProgram(
    inputs,
    { project },
    MAX_MODEL_ANALYSIS_SOURCES,
    MAX_MODEL_ANALYSIS_BYTES,
  );
  if (!analysis.program || analysis.diagnostics.length > 0) return undefined;
  const model = deriveEnvironmentModel(
    analysis.program,
    operation.sourcePaths.map((path) => absoluteInputPath(consumerRoot, path)),
  );
  return model.modelText;
}

function findOutputCollision(
  selectedTarget: DiscoveredTarget | undefined,
  targets: readonly { readonly projectName: string; readonly target?: DiscoveredTarget }[],
  selectedProject: string,
  destination: string,
): 'none' | 'collision' | 'unknown' {
  if (!selectedTarget) return 'unknown';
  for (const stack of [[], ...selectedTarget.configurations.map((name) => [name])]) {
    const result = findEffectiveOutputPathCollision(selectedTarget, stack, destination);
    if (result.kind !== 'none') return result.kind;
  }
  const others = findOtherProjectOutputPathCollision(targets, selectedProject, destination);
  return others.kind;
}

function snapshotTree(tree: Tree): Map<string, Uint8Array> | undefined {
  const result = new Map<string, Uint8Array>();
  try {
    for (const path of treePaths(tree)) {
      const contents = tree.read(path);
      if (!contents) return undefined;
      result.set(path, Uint8Array.from(contents));
    }
    return result;
  } catch {
    return undefined;
  }
}

function verifyStagedTree(
  original: Tree,
  staged: Tree,
  before: ReadonlyMap<string, Uint8Array>,
  destination: string,
  expectedText: string,
  expectedSha256: string,
): boolean {
  const expectedFiles = new Set([...before.keys(), destination]);
  const stagedFiles = new Set(treePaths(staged));
  if (
    stagedFiles.size !== expectedFiles.size ||
    [...expectedFiles].some((path) => !stagedFiles.has(path)) ||
    original.exists(destination)
  )
    return false;
  for (const [path, bytes] of before) {
    const current = staged.read(path);
    if (!current || !equalBytes(current, bytes)) return false;
  }
  const created = staged.read(destination);
  const expectedBytes = new TextEncoder().encode(expectedText);
  return (
    !!created &&
    equalBytes(created, expectedBytes) &&
    createHash('sha256').update(created).digest('hex') === expectedSha256
  );
}

function treePaths(tree: Tree): string[] {
  const paths: string[] = [];
  tree.visit((path) => paths.push(path));
  return paths;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function isCanonicalTreePath(path: string): boolean {
  return (
    !!path &&
    !path.startsWith('/') &&
    !path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  );
}

function toTreePath(relativePath: string): string {
  return normalize(`/${relativePath}`);
}

function absoluteInputPath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${relativePath}`;
}

function toRootRelativePath(root: string, absolutePath: string): string | undefined {
  const canonicalRoot = root.replace(/[\\/]+$/, '') || '/';
  const normalized = absolutePath.replaceAll('\\', '/');
  if (!normalized.startsWith(`${canonicalRoot.replace(/\/$/, '')}/`)) return undefined;
  return normalized.slice(canonicalRoot.replace(/\/$/, '').length + 1);
}
