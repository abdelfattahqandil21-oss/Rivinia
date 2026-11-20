import {
  canonicalInputHashes,
  hashText,
  isCanonicalRelativePath,
  isPathSafeSafely,
  operationId,
  stableStringify,
} from './environment-plan-utils.js';
import type { EnvironmentPlanCurrentInput } from './environment-plan-model.js';
import type {
  EnvironmentModelPlanV4,
  CreateEnvironmentModelFileOperationV4,
  EnvironmentModelInspectionPlanV4,
} from './environment-model-plan-v4.js';

export interface EnvironmentModelApprovalV4 {
  readonly reviewedPlanDigest: string;
  readonly reviewedPreviewSha256: string;
  readonly acceptedDecisionIds: readonly string[];
}

export type EnvironmentModelPlanVerificationV4 =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        | 'ENV_MODEL_SCHEMA_INVALID'
        | 'ENV_MODEL_INTEGRITY_INVALID'
        | 'ENV_MODEL_OPERATION_INVALID'
        | 'ENV_MODEL_PLAN_BLOCKED'
        | 'ENV_MODEL_INPUTS_STALE'
        | 'ENV_MODEL_PATH_INVALID'
        | 'ENV_MODEL_APPROVAL_REQUIRED'
        | 'ENV_MODEL_REVIEW_MISMATCH'
        | 'ENV_MODEL_PREVIEW_REVIEW_MISMATCH'
        | 'ENV_MODEL_DECISION_APPROVAL_INVALID'
        | 'ENV_MODEL_OUTPUT_MISMATCH';
    };

export function verifyEnvironmentModelPlanV4(
  plan: unknown,
  inspectionPlan: unknown,
  approval: EnvironmentModelApprovalV4 | undefined,
  consumerRoot: string,
  currentInputs: readonly EnvironmentPlanCurrentInput[],
  isPathSafe: (root: string, relativePath: string) => boolean,
  rederivedModelText: string,
): EnvironmentModelPlanVerificationV4 {
  const structure = validateEnvironmentModelPlanV4(plan);
  if (!structure.ok) return structure;
  const candidate = plan as EnvironmentModelPlanV4;
  const inspection = validateEnvironmentModelInspectionPlanV4(inspectionPlan);
  if (!inspection.ok) return inspection;
  const inspected = inspectionPlan as EnvironmentModelInspectionPlanV4;
  if (
    inspected.integrity.digest !== candidate.inspectionDigest ||
    stableStringify(inspected.inputHashes) !== stableStringify(candidate.inputHashes)
  )
    return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  const { integrity } = candidate;
  if (candidate.status === 'blocked') return { ok: false, code: 'ENV_MODEL_PLAN_BLOCKED' };
  const operation = candidate.operations[0]!;
  if (
    inspected.status !== 'reviewable' ||
    stableStringify(inspected.project) !== stableStringify(candidate.project) ||
    inspected.typescriptVersion !== candidate.typescriptVersion ||
    stableStringify(inspected.sourcePaths) !== stableStringify(operation.sourcePaths) ||
    inspected.tsconfigPath !== operation.tsconfigPath ||
    stableStringify(inspected.inputPaths) !== stableStringify(operation.inputPaths)
  )
    return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  if (
    !candidate.inputHashes.every(({ path }) => isPathSafeSafely(isPathSafe, consumerRoot, path)) ||
    !isPathSafeSafely(isPathSafe, consumerRoot, operation.path)
  )
    return { ok: false, code: 'ENV_MODEL_PATH_INVALID' };
  let currentHashes;
  try {
    currentHashes = canonicalInputHashes(consumerRoot, currentInputs);
  } catch {
    return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
  }
  if (!currentHashes || stableStringify(currentHashes) !== stableStringify(candidate.inputHashes))
    return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
  if (hashText(rederivedModelText) !== operation.expectedContentSha256)
    return { ok: false, code: 'ENV_MODEL_OUTPUT_MISMATCH' };
  if (!approval) return { ok: false, code: 'ENV_MODEL_APPROVAL_REQUIRED' };
  if (
    !isRecord(approval) ||
    !hasExactKeys(approval, [
      'reviewedPlanDigest',
      'reviewedPreviewSha256',
      'acceptedDecisionIds',
    ]) ||
    typeof approval['reviewedPlanDigest'] !== 'string' ||
    typeof approval['reviewedPreviewSha256'] !== 'string' ||
    !Array.isArray(approval['acceptedDecisionIds']) ||
    !approval['acceptedDecisionIds'].every((id) => typeof id === 'string')
  )
    return { ok: false, code: 'ENV_MODEL_DECISION_APPROVAL_INVALID' };
  if (approval.reviewedPlanDigest !== integrity.digest)
    return { ok: false, code: 'ENV_MODEL_REVIEW_MISMATCH' };
  if (approval.reviewedPreviewSha256 !== operation.expectedContentSha256)
    return { ok: false, code: 'ENV_MODEL_PREVIEW_REVIEW_MISMATCH' };
  if (
    stableStringify([...approval.acceptedDecisionIds].sort()) !==
    stableStringify(['model-generation'])
  )
    return { ok: false, code: 'ENV_MODEL_DECISION_APPROVAL_INVALID' };
  return { ok: true };
}

export function validateEnvironmentModelPlanV4(plan: unknown): EnvironmentModelPlanVerificationV4 {
  if (
    !isRecord(plan) ||
    !hasExactKeys(plan, [
      'schemaVersion',
      'planKind',
      'applicability',
      'status',
      'toolVersion',
      'typescriptVersion',
      'project',
      'inspectionDigest',
      'inputHashes',
      'proposedDecisions',
      'decisionApproval',
      'operations',
      'conflicts',
      'integrity',
    ])
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  if (
    plan['schemaVersion'] !== 4 ||
    plan['planKind'] !== 'mutation' ||
    plan['applicability'] !== 'model-file-proposal-only' ||
    (plan['status'] !== 'ready' && plan['status'] !== 'blocked') ||
    typeof plan['toolVersion'] !== 'string' ||
    typeof plan['typescriptVersion'] !== 'string' ||
    !isSha256(plan['inspectionDigest']) ||
    plan['decisionApproval'] !== 'pending-consumer-approval' ||
    !isValidProject(plan['project']) ||
    !Array.isArray(plan['inputHashes']) ||
    !Array.isArray(plan['proposedDecisions']) ||
    !Array.isArray(plan['operations']) ||
    !Array.isArray(plan['conflicts']) ||
    !isRecord(plan['integrity']) ||
    !hasExactKeys(plan['integrity'], ['algorithm', 'digest']) ||
    plan['integrity']['algorithm'] !== 'sha256' ||
    !isSha256(plan['integrity']['digest'])
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  const { integrity, ...planBody } = plan;
  if ((integrity as Record<string, unknown>)['digest'] !== hashText(stableStringify(planBody)))
    return { ok: false, code: 'ENV_MODEL_INTEGRITY_INVALID' };
  if (
    plan['proposedDecisions'].length !== 1 ||
    !isRecord(plan['proposedDecisions'][0]) ||
    !hasExactKeys(plan['proposedDecisions'][0], ['id', 'choice', 'authority']) ||
    plan['proposedDecisions'][0]['id'] !== 'model-generation' ||
    plan['proposedDecisions'][0]['choice'] !== 'create-self-contained-environment-model' ||
    plan['proposedDecisions'][0]['authority'] !== 'explicit-proposal'
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  if (
    !plan['inputHashes'].every(isFingerprint) ||
    !isSortedUnique(
      plan['inputHashes'].map((v) => (v as Record<string, unknown>)['path'] as string),
    )
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  if (plan['status'] === 'blocked') {
    const conflictsValid = plan['conflicts'].every(isSafeConflict);
    return plan['operations'].length === 0 && plan['conflicts'].length > 0 && conflictsValid
      ? { ok: true }
      : { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  }
  if (plan['conflicts'].length !== 0 || plan['operations'].length !== 1)
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  const operation = plan['operations'][0];
  if (!isValidOperation(operation, plan['project'] as Record<string, unknown>))
    return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  const fingerprints = new Map(
    (plan['inputHashes'] as Record<string, unknown>[]).map((entry) => [entry['path'], entry]),
  );
  const inputHashPaths = (plan['inputHashes'] as EnvironmentModelPlanV4['inputHashes']).map(
    ({ path }) => path,
  );
  if (
    operation['inspectionDigest'] !== plan['inspectionDigest'] ||
    operation['path'] !==
      `${(plan['project'] as Record<string, unknown>)['sourceRoot']}/environment.model.ts` ||
    operation['requiredInputPath'] !== operation['path'] ||
    operation['changePreview']['path'] !== operation['path'] ||
    operation['changePreview']['contentSha256'] !== operation['expectedContentSha256'] ||
    fingerprints.get(operation['path'])?.['presence'] !== 'absent' ||
    operation['sourcePaths'].some(
      (source) => fingerprints.get(source)?.['presence'] !== 'present',
    ) ||
    fingerprints.get(operation['tsconfigPath'])?.['presence'] !== 'present' ||
    fingerprints.get('angular.json')?.['presence'] !== 'present' ||
    !operation['inputPaths'].every((path) => fingerprints.get(path)?.['presence'] === 'present') ||
    !operation['inputPaths'].includes('angular.json') ||
    !operation['inputPaths'].includes(operation['tsconfigPath']) ||
    operation['sourcePaths'].some((source) => !operation['inputPaths'].includes(source)) ||
    stableStringify(inputHashPaths) !==
      stableStringify(
        [...operation['inputPaths'], operation['path']].sort((a, b) => a.localeCompare(b)),
      )
  )
    return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  const { id, ...operationBody } = operation;
  if (id !== operationId(operationBody)) return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  return { ok: true };
}

export function validateEnvironmentModelInspectionPlanV4(
  plan: unknown,
): EnvironmentModelPlanVerificationV4 {
  if (
    !isRecord(plan) ||
    !hasExactKeys(plan, [
      'schemaVersion',
      'planKind',
      'applicability',
      'status',
      'toolVersion',
      'typescriptVersion',
      'project',
      'sourcePaths',
      'tsconfigPath',
      'inputPaths',
      'inputHashes',
      'proofStatus',
      'conflicts',
      'integrity',
    ])
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  if (
    plan['schemaVersion'] !== 4 ||
    plan['planKind'] !== 'inspection' ||
    plan['applicability'] !== 'model-inspection-only' ||
    (plan['status'] !== 'reviewable' && plan['status'] !== 'blocked') ||
    typeof plan['toolVersion'] !== 'string' ||
    typeof plan['typescriptVersion'] !== 'string' ||
    !isValidProject(plan['project']) ||
    !Array.isArray(plan['sourcePaths']) ||
    plan['sourcePaths'].length === 0 ||
    !plan['sourcePaths'].every(
      (path) => typeof path === 'string' && isCanonicalRelativePath(path),
    ) ||
    new Set(plan['sourcePaths']).size !== plan['sourcePaths'].length ||
    !isCanonicalRelativePath(plan['tsconfigPath'] as string) ||
    !Array.isArray(plan['inputPaths']) ||
    !plan['inputPaths'].every(
      (path) => typeof path === 'string' && isCanonicalRelativePath(path),
    ) ||
    !isSortedUnique(plan['inputPaths'] as string[]) ||
    !Array.isArray(plan['inputHashes']) ||
    !plan['inputHashes'].every(isFingerprint) ||
    !isSortedUnique(
      plan['inputHashes'].map((entry) => (entry as Record<string, unknown>)['path'] as string),
    ) ||
    (plan['proofStatus'] !== 'proven' && plan['proofStatus'] !== 'blocked') ||
    !Array.isArray(plan['conflicts']) ||
    !isRecord(plan['integrity']) ||
    !hasExactKeys(plan['integrity'], ['algorithm', 'digest']) ||
    plan['integrity']['algorithm'] !== 'sha256' ||
    !isSha256(plan['integrity']['digest'])
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  const fingerprints = new Map(
    (plan['inputHashes'] as Record<string, unknown>[]).map((entry) => [entry['path'], entry]),
  );
  const destination = `${(plan['project'] as Record<string, unknown>)['sourceRoot']}/environment.model.ts`;
  const hashPaths = (plan['inputHashes'] as EnvironmentModelPlanV4['inputHashes']).map(
    ({ path }) => path,
  );
  if (
    !plan['inputPaths'].includes('angular.json') ||
    !plan['inputPaths'].includes(plan['tsconfigPath'] as string) ||
    (plan['sourcePaths'] as string[]).some(
      (source) => !(plan['inputPaths'] as string[]).includes(source),
    ) ||
    stableStringify(hashPaths) !==
      stableStringify([...plan['inputPaths'], destination].sort((a, b) => a.localeCompare(b))) ||
    plan['sourcePaths'].some((source) => fingerprints.get(source)?.['presence'] !== 'present') ||
    fingerprints.get(plan['tsconfigPath'] as string)?.['presence'] !== 'present' ||
    fingerprints.get('angular.json')?.['presence'] !== 'present'
  )
    return { ok: false, code: 'ENV_MODEL_OPERATION_INVALID' };
  const { integrity, ...body } = plan;
  if (integrity['digest'] !== hashText(stableStringify(body)))
    return { ok: false, code: 'ENV_MODEL_INTEGRITY_INVALID' };
  const validConflicts = plan['conflicts'].every(isSafeConflict);
  if (
    !validConflicts ||
    (plan['status'] === 'reviewable' &&
      (plan['proofStatus'] !== 'proven' ||
        plan['conflicts'].length !== 0 ||
        fingerprints.get(destination)?.['presence'] !== 'absent')) ||
    (plan['status'] === 'blocked' && plan['conflicts'].length === 0)
  )
    return { ok: false, code: 'ENV_MODEL_SCHEMA_INVALID' };
  return { ok: true };
}

function isValidOperation(
  value: unknown,
  project: Record<string, unknown>,
): value is CreateEnvironmentModelFileOperationV4 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'id',
      'order',
      'kind',
      'project',
      'inspectionDigest',
      'path',
      'sourcePaths',
      'tsconfigPath',
      'inputPaths',
      'requiredInputPath',
      'expectedContentSha256',
      'changePreview',
    ])
  )
    return false;
  return (
    isOperationId(value['id']) &&
    value['order'] === 0 &&
    value['kind'] === 'create-environment-model-file' &&
    stableStringify(value['project']) === stableStringify(project) &&
    isSha256(value['inspectionDigest']) &&
    isCanonicalRelativePath(value['path'] as string) &&
    Array.isArray(value['sourcePaths']) &&
    value['sourcePaths'].length > 0 &&
    value['sourcePaths'].every(
      (path) => typeof path === 'string' && isCanonicalRelativePath(path),
    ) &&
    new Set(value['sourcePaths']).size === value['sourcePaths'].length &&
    isCanonicalRelativePath(value['tsconfigPath'] as string) &&
    Array.isArray(value['inputPaths']) &&
    value['inputPaths'].every(
      (path) => typeof path === 'string' && isCanonicalRelativePath(path),
    ) &&
    new Set(value['inputPaths']).size === value['inputPaths'].length &&
    isCanonicalRelativePath(value['requiredInputPath'] as string) &&
    isSha256(value['expectedContentSha256']) &&
    isRecord(value['changePreview']) &&
    hasExactKeys(value['changePreview'], ['mode', 'path', 'contentSha256']) &&
    value['changePreview']['mode'] === 'create-if-absent' &&
    isCanonicalRelativePath(value['changePreview']['path'] as string) &&
    isSha256(value['changePreview']['contentSha256'])
  );
}

function isValidProject(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['name', 'root', 'sourceRoot']) &&
    typeof value['name'] === 'string' &&
    value['name'].length > 0 &&
    isCanonicalRelativePath(value['root'] as string) &&
    isCanonicalRelativePath(value['sourceRoot'] as string) &&
    ((value['sourceRoot'] as string) === value['root'] ||
      (value['sourceRoot'] as string).startsWith(`${value['root']}/`))
  );
}

function isFingerprint(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['path', 'sha256', 'presence']) &&
    isCanonicalRelativePath(value['path'] as string) &&
    isSha256(value['sha256']) &&
    (value['presence'] === 'present' || value['presence'] === 'absent')
  );
}

function isSafeConflict(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['code', 'message']) ||
    typeof value['code'] !== 'string' ||
    typeof value['message'] !== 'string'
  )
    return false;
  const messages: Readonly<Record<string, string>> = {
    ENV_MODEL_PATH_INVALID: 'A selected project or model plan path is unsafe or invalid.',
    ENV_MODEL_INPUT_REQUIRED:
      'A required project, TypeScript, or source input is missing or incomplete.',
    ENV_MODEL_DESTINATION_EXISTS: 'The consumer-owned model destination already exists.',
    ENV_MODEL_TYPE_UNPROVEN: 'A complete bounded Type Proof is required to propose a model.',
    ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE:
      'Selected environments do not satisfy one provable shared model.',
  };
  return messages[value['code']] === value['message'];
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return stableStringify(keys) === stableStringify([...expected].sort());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{20}$/.test(value);
}

function isSortedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]!.localeCompare(value) < 0);
}
