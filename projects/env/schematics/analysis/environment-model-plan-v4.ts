import {
  canonicalInputHashes,
  hashText,
  isCanonicalRelativePath,
  isPathSafeSafely,
  operationId,
  stableStringify,
  toRootRelativePath,
} from './environment-plan-utils.js';
import { emitEnvironmentModel } from './environment-model-emitter.js';
import type { ModelTypeProof } from './environment-model-proof.js';
import type {
  EnvironmentPlanCurrentInput,
  EnvironmentPlanInputFingerprint,
} from './environment-plan-model.js';

export const ENVIRONMENT_MODEL_PLAN_SCHEMA_VERSION = 4;

export interface EnvironmentModelProjectV4 {
  readonly name: string;
  readonly root: string;
  readonly sourceRoot: string;
}

export interface CreateEnvironmentModelFileOperationV4 {
  readonly id: string;
  readonly order: 0;
  readonly kind: 'create-environment-model-file';
  readonly project: EnvironmentModelProjectV4;
  readonly inspectionDigest: string;
  readonly path: string;
  readonly sourcePaths: readonly string[];
  readonly tsconfigPath: string;
  readonly inputPaths: readonly string[];
  readonly requiredInputPath: string;
  readonly expectedContentSha256: string;
  readonly changePreview: {
    readonly mode: 'create-if-absent';
    readonly path: string;
    readonly contentSha256: string;
  };
}

export interface EnvironmentModelPlanV4 {
  readonly schemaVersion: 4;
  readonly planKind: 'mutation';
  readonly applicability: 'model-file-proposal-only';
  readonly status: 'ready' | 'blocked';
  readonly toolVersion: string;
  readonly typescriptVersion: string;
  readonly project: EnvironmentModelProjectV4;
  readonly inspectionDigest: string;
  readonly inputHashes: readonly EnvironmentPlanInputFingerprint[];
  readonly proposedDecisions: readonly [
    {
      readonly id: 'model-generation';
      readonly choice: 'create-self-contained-environment-model';
      readonly authority: 'explicit-proposal';
    },
  ];
  readonly decisionApproval: 'pending-consumer-approval';
  readonly operations: readonly CreateEnvironmentModelFileOperationV4[];
  readonly conflicts: readonly { readonly code: string; readonly message: string }[];
  readonly integrity: { readonly algorithm: 'sha256'; readonly digest: string };
}

export interface EnvironmentModelInspectionPlanV4 {
  readonly schemaVersion: 4;
  readonly planKind: 'inspection';
  readonly applicability: 'model-inspection-only';
  readonly status: 'reviewable' | 'blocked';
  readonly toolVersion: string;
  readonly typescriptVersion: string;
  readonly project: EnvironmentModelProjectV4;
  readonly sourcePaths: readonly string[];
  readonly tsconfigPath: string;
  readonly inputPaths: readonly string[];
  readonly inputHashes: readonly EnvironmentPlanInputFingerprint[];
  readonly proofStatus: 'proven' | 'blocked';
  readonly conflicts: readonly { readonly code: string; readonly message: string }[];
  readonly integrity: { readonly algorithm: 'sha256'; readonly digest: string };
}

export interface EnvironmentModelPlanV4Input {
  readonly toolVersion: string;
  readonly typescriptVersion: string;
  readonly consumerRoot: string;
  readonly project: EnvironmentModelProjectV4;
  /** Preserve the user's selected environment order. */
  readonly sourcePaths: readonly string[];
  readonly tsconfigPath: string;
  /** All environment, import, Angular workspace, and effective tsconfig inputs. */
  readonly inputPaths: readonly string[];
  readonly modelProof?: ModelTypeProof;
  readonly currentInputs: readonly EnvironmentPlanCurrentInput[];
  readonly isPathSafe: (root: string, relativePath: string) => boolean;
}

export interface EnvironmentModelLocalPreviewV4 {
  readonly planDigest: string;
  readonly contentSha256: string;
  readonly text: string;
}

export interface EnvironmentModelPlanV4Result {
  readonly inspectionPlan: EnvironmentModelInspectionPlanV4;
  readonly plan: EnvironmentModelPlanV4;
  /** Local-only review content. It is deliberately not embedded in the plan. */
  readonly preview?: EnvironmentModelLocalPreviewV4;
}

const MODEL_GENERATION_DECISION = {
  id: 'model-generation',
  choice: 'create-self-contained-environment-model',
  authority: 'explicit-proposal',
} as const;

export function createEnvironmentModelPlanV4(
  input: EnvironmentModelPlanV4Input,
): EnvironmentModelPlanV4Result {
  const path = `${input.project.sourceRoot}/environment.model.ts`;
  const conflicts: { code: string; message: string }[] = [];
  const sourcePaths = input.sourcePaths.map(
    (value) => toRootRelativePath(input.consumerRoot, value) ?? '',
  );
  const inputPaths = input.inputPaths
    .map((value) => toRootRelativePath(input.consumerRoot, value) ?? '')
    .sort((left, right) => left.localeCompare(right));
  const tsconfigPath = toRootRelativePath(input.consumerRoot, input.tsconfigPath) ?? '';
  const safeProject =
    typeof input.project.name === 'string' &&
    input.project.name.length > 0 &&
    [input.project.root, input.project.sourceRoot].every(isCanonicalRelativePath) &&
    (input.project.sourceRoot === input.project.root ||
      input.project.sourceRoot.startsWith(`${input.project.root}/`));
  if (
    !safeProject ||
    !isCanonicalRelativePath(path) ||
    !sourcePaths.length ||
    sourcePaths.some((p) => !isCanonicalRelativePath(p)) ||
    new Set(sourcePaths).size !== sourcePaths.length
  )
    conflicts.push({
      code: 'ENV_MODEL_PATH_INVALID',
      message: 'A selected project or model plan path is unsafe or invalid.',
    });
  if (
    !isCanonicalRelativePath(tsconfigPath) ||
    inputPaths.some((candidate) => !isCanonicalRelativePath(candidate)) ||
    new Set(inputPaths).size !== inputPaths.length
  )
    conflicts.push({
      code: 'ENV_MODEL_INPUT_REQUIRED',
      message: 'A required project, TypeScript, or source input is missing or incomplete.',
    });
  if (
    !inputPaths.includes('angular.json') ||
    !inputPaths.includes(tsconfigPath) ||
    sourcePaths.some((source) => !inputPaths.includes(source))
  )
    conflicts.push({
      code: 'ENV_MODEL_INPUT_REQUIRED',
      message: 'A required project, TypeScript, or source input is missing or incomplete.',
    });

  const destinationAbsolute = `${input.consumerRoot.replace(/\/$/, '')}/${path}`;
  const destinationInput = input.currentInputs.find(
    ({ path: file }) => toRootRelativePath(input.consumerRoot, file) === path,
  );
  const inputsWithDestination = destinationInput
    ? input.currentInputs
    : [...input.currentInputs, { path: destinationAbsolute, exists: false }];
  const inputHashes = canonicalInputHashes(input.consumerRoot, inputsWithDestination);
  if (!inputHashes)
    conflicts.push({
      code: 'ENV_MODEL_INPUT_REQUIRED',
      message: 'A required project, TypeScript, or source input is missing or incomplete.',
    });
  else {
    const fingerprints = new Map(inputHashes.map((item) => [item.path, item]));
    const expectedFingerprintPaths = [...inputPaths, path].sort((left, right) =>
      left.localeCompare(right),
    );
    if (
      stableStringify(inputHashes.map(({ path: itemPath }) => itemPath)) !==
      stableStringify(expectedFingerprintPaths)
    )
      conflicts.push({
        code: 'ENV_MODEL_INPUT_REQUIRED',
        message: 'A required project, TypeScript, or source input is missing or incomplete.',
      });
    for (const required of [...sourcePaths, tsconfigPath, 'angular.json']) {
      if (fingerprints.get(required)?.presence !== 'present')
        conflicts.push({
          code: 'ENV_MODEL_INPUT_REQUIRED',
          message: 'A required project, TypeScript, or source input is missing or incomplete.',
        });
    }
    if (fingerprints.get(path)?.presence === 'present')
      conflicts.push({
        code: 'ENV_MODEL_DESTINATION_EXISTS',
        message: 'The consumer-owned model destination already exists.',
      });
    if (
      !inputHashes.every(({ path: candidate }) =>
        isPathSafeSafely(input.isPathSafe, input.consumerRoot, candidate),
      ) ||
      !isPathSafeSafely(input.isPathSafe, input.consumerRoot, path)
    )
      conflicts.push({
        code: 'ENV_MODEL_PATH_INVALID',
        message: 'A selected project or model plan path is unsafe or invalid.',
      });
  }

  let modelText: string | undefined;
  if (input.modelProof?.kind !== 'object') {
    conflicts.push({
      code: 'ENV_MODEL_TYPE_UNPROVEN',
      message: 'A complete bounded Type Proof is required to propose a model.',
    });
  } else {
    modelText = emitEnvironmentModel(input.modelProof);
  }
  const inspectionBody = {
    schemaVersion: 4 as const,
    planKind: 'inspection' as const,
    applicability: 'model-inspection-only' as const,
    status: conflicts.length ? ('blocked' as const) : ('reviewable' as const),
    toolVersion: input.toolVersion,
    typescriptVersion: input.typescriptVersion,
    project: input.project,
    sourcePaths,
    tsconfigPath,
    inputPaths,
    inputHashes: inputHashes ?? [],
    proofStatus: input.modelProof?.kind === 'object' ? ('proven' as const) : ('blocked' as const),
    conflicts: conflicts.map(({ code, message }) => ({ code, message })),
  };
  const inspectionPlan: EnvironmentModelInspectionPlanV4 = {
    ...inspectionBody,
    integrity: { algorithm: 'sha256', digest: hashText(stableStringify(inspectionBody)) },
  };
  const status: 'blocked' | 'ready' = conflicts.length ? 'blocked' : 'ready';
  const contentSha256 = modelText ? hashText(modelText) : undefined;
  const operationBody =
    status === 'ready'
      ? {
          order: 0 as const,
          kind: 'create-environment-model-file' as const,
          project: input.project,
          inspectionDigest: inspectionPlan.integrity.digest,
          path,
          sourcePaths,
          tsconfigPath,
          inputPaths,
          requiredInputPath: path,
          expectedContentSha256: contentSha256!,
          changePreview: { mode: 'create-if-absent' as const, path, contentSha256: contentSha256! },
        }
      : undefined;
  const operations = operationBody ? [{ ...operationBody, id: operationId(operationBody) }] : [];
  const body: Omit<EnvironmentModelPlanV4, 'integrity'> = {
    schemaVersion: 4 as const,
    planKind: 'mutation' as const,
    applicability: 'model-file-proposal-only' as const,
    status,
    toolVersion: input.toolVersion,
    typescriptVersion: input.typescriptVersion,
    project: input.project,
    inspectionDigest: inspectionPlan.integrity.digest,
    inputHashes: inputHashes ?? [],
    proposedDecisions: [MODEL_GENERATION_DECISION],
    decisionApproval: 'pending-consumer-approval' as const,
    operations,
    conflicts,
  };
  const plan: EnvironmentModelPlanV4 = {
    ...body,
    integrity: { algorithm: 'sha256', digest: hashText(stableStringify(body)) },
  };
  return {
    inspectionPlan,
    plan,
    ...(status === 'ready' && modelText && contentSha256
      ? { preview: { planDigest: plan.integrity.digest, contentSha256, text: modelText } }
      : {}),
  };
}
