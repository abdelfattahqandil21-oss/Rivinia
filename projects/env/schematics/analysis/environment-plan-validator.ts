import ts from 'typescript';
import { ENVIRONMENT_PLAN_SCHEMA_VERSION } from './environment-plan-model.js';
import type {
  EnvironmentPlan,
  EnvironmentPlanCurrentInput,
  VerifyEnvironmentPlanResult,
  CreateEnvironmentFileOperation,
  EnvironmentPlanConsumerApproval,
  MutationEnvironmentPlan,
  VerifyEnvironmentPlanEligibilityResult,
} from './environment-plan-model.js';
import {
  canonicalInputHashes,
  hashText,
  inspectionDecisions,
  isCanonicalRelativePath,
  isPathSafeSafely,
  mutationDecisions,
  ABSENT_INPUT_SENTINEL,
  operationId,
  stableStringify,
} from './environment-plan-utils.js';

export function verifyIntegrityForBuilder(plan: EnvironmentPlan): VerifyEnvironmentPlanResult {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan))
    return { ok: false, code: 'ENV_PLAN_INTEGRITY_INVALID' };
  if (!plan.integrity || plan.integrity.algorithm !== 'sha256')
    return { ok: false, code: 'ENV_PLAN_INTEGRITY_INVALID' };
  const { integrity, ...body } = plan;
  return integrity.digest === hashText(stableStringify(body))
    ? { ok: true }
    : { ok: false, code: 'ENV_PLAN_INTEGRITY_INVALID' };
}

export function verifyEnvironmentPlanReview(
  plan: EnvironmentPlan,
  reviewedDigest: string,
): VerifyEnvironmentPlanResult {
  const structure = validatePlanStructure(plan);
  if (structure) return { ok: false, code: structure };
  const integrity = verifyIntegrityForBuilder(plan);
  if (!integrity.ok) return integrity;
  if (reviewedDigest !== plan.integrity.digest)
    return { ok: false, code: 'ENV_PLAN_REVIEW_MISMATCH' };
  if (plan.status === 'blocked') return { ok: false, code: 'ENV_PLAN_BLOCKED' };
  return { ok: true };
}

export function verifyEnvironmentPlan(
  plan: EnvironmentPlan,
  reviewedDigest: string,
  consumerRoot: string,
  currentInputs: readonly EnvironmentPlanCurrentInput[],
  isPathSafe: (root: string, relativePath: string) => boolean,
  isReadPathSafe: (root: string, relativePath: string) => boolean = isPathSafe,
): VerifyEnvironmentPlanResult {
  const structure = validatePlanStructure(plan);
  if (structure) return { ok: false, code: structure };
  if (plan.planKind !== 'mutation') return { ok: false, code: 'ENV_PLAN_NOT_MUTATION' };
  const integrity = verifyIntegrityForBuilder(plan);
  if (!integrity.ok) return integrity;
  if (plan.status === 'blocked') return { ok: false, code: 'ENV_PLAN_BLOCKED' };
  if (
    !plan.inputHashes.every(({ path }) => isPathSafeSafely(isReadPathSafe, consumerRoot, path)) ||
    !mutationPaths(plan).every((path) => isPathSafeSafely(isPathSafe, consumerRoot, path))
  )
    return { ok: false, code: 'ENV_PLAN_PATH_INVALID' };
  const currentHashes = canonicalInputHashes(consumerRoot, currentInputs);
  if (!currentHashes || stableStringify(currentHashes) !== stableStringify(plan.inputHashes)) {
    return { ok: false, code: 'ENV_PLAN_INPUTS_STALE' };
  }
  if (reviewedDigest !== plan.integrity.digest)
    return { ok: false, code: 'ENV_PLAN_REVIEW_MISMATCH' };
  return { ok: true };
}

export function verifyEnvironmentPlanEligibility(
  plan: EnvironmentPlan,
  approval: EnvironmentPlanConsumerApproval | undefined,
  consumerRoot: string,
  currentInputs: readonly EnvironmentPlanCurrentInput[],
  isPathSafe: (root: string, relativePath: string) => boolean,
  isReadPathSafe: (root: string, relativePath: string) => boolean = isPathSafe,
): VerifyEnvironmentPlanEligibilityResult {
  if (!plan || plan.planKind !== 'mutation') return { ok: false, code: 'ENV_PLAN_NOT_MUTATION' };
  if (!approval) return { ok: false, code: 'ENV_PLAN_APPROVAL_REQUIRED' };
  const checked = verifyEnvironmentPlan(
    plan,
    approval.reviewedDigest,
    consumerRoot,
    currentInputs,
    isPathSafe,
    isReadPathSafe,
  );
  if (!checked.ok) return checked;
  const required = requiredExplicitDecisionIds(plan);
  if (stableStringify(required) !== stableStringify([...approval.acceptedDecisionIds].sort()))
    return { ok: false, code: 'ENV_PLAN_DECISION_APPROVAL_INVALID' };
  return { ok: true, eligibleForApply: true };
}

function requiredExplicitDecisionIds(plan: MutationEnvironmentPlan): string[] {
  const hasFileCreation = plan.operations.some(({ kind }) => kind === 'create-environment-file');
  const hasConfigurationChange = plan.operations.some(
    ({ kind }) => kind === 'add-file-replacement',
  );
  return plan.proposedDecisions
    .filter(({ authority, id }) => {
      if (authority !== 'explicit-proposal') return false;
      if (id === 'environment-semantics') return hasFileCreation;
      if (id === 'configuration-mapping') return hasConfigurationChange;
      return true;
    })
    .map(({ id }) => id)
    .sort();
}

export function verifyReadOnlyEnvironmentPlan(
  plan: EnvironmentPlan,
  currentInputs: readonly EnvironmentPlanCurrentInput[],
  consumerRoot: string,
): VerifyEnvironmentPlanResult {
  const structure = validatePlanStructure(plan);
  if (structure) return { ok: false, code: structure };
  if (plan.planKind !== 'inspection') return { ok: false, code: 'ENV_PLAN_NOT_MUTATION' };
  const integrity = verifyIntegrityForBuilder(plan);
  if (!integrity.ok) return integrity;
  const currentHashes = canonicalInputHashes(consumerRoot, currentInputs);
  if (!currentHashes || stableStringify(currentHashes) !== stableStringify(plan.inputHashes)) {
    return { ok: false, code: 'ENV_PLAN_INPUTS_STALE' };
  }
  if (plan.status === 'blocked') return { ok: false, code: 'ENV_PLAN_BLOCKED' };
  return { ok: true };
}

function mutationPaths(plan: EnvironmentPlan): readonly string[] {
  return plan.operations.flatMap((operation) => {
    if (operation.kind === 'create-environment-file')
      return [operation.path, operation.derivation.sourcePath];
    if (
      operation.kind === 'add-file-replacement' ||
      operation.kind === 'confirm-file-replacement-present'
    )
      return [operation.replace, operation.with];
    return [];
  });
}

export function validatePlanStructure(
  plan: EnvironmentPlan,
): VerifyEnvironmentPlanResult['code'] | undefined {
  if (!isObject(plan)) return 'ENV_PLAN_OPERATION_INVALID';
  if (plan.schemaVersion !== ENVIRONMENT_PLAN_SCHEMA_VERSION) return 'ENV_PLAN_SCHEMA_UNSUPPORTED';
  if (
    !hasOnlyKeys(plan, [
      'schemaVersion',
      'planKind',
      'applicability',
      'toolVersion',
      'typescriptVersion',
      'status',
      'project',
      ...(plan.planKind === 'inspection'
        ? ['decisions']
        : ['proposedDecisions', 'decisionApproval']),
      'inputHashes',
      'operations',
      'conflicts',
      'integrity',
    ])
  )
    return 'ENV_PLAN_OPERATION_INVALID';
  if (!plan.toolVersion || plan.typescriptVersion !== ts.version)
    return 'ENV_PLAN_TOOL_INCOMPATIBLE';
  if (
    (plan.planKind === 'inspection'
      ? !Array.isArray(plan.decisions)
      : !Array.isArray(plan.proposedDecisions)) ||
    !Array.isArray(plan.operations) ||
    !Array.isArray(plan.inputHashes) ||
    !Array.isArray(plan.conflicts)
  ) {
    return 'ENV_PLAN_OPERATION_INVALID';
  }
  if (!isSafePlanProject(plan.project)) return 'ENV_PLAN_OPERATION_INVALID';
  const inputPaths = new Set<string>();
  for (const input of plan.inputHashes) {
    if (
      !isObject(input) ||
      !hasOnlyKeys(input, ['path', 'sha256', 'presence']) ||
      !isCanonicalRelativePath(input.path) ||
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !['present', 'absent'].includes(input.presence) ||
      (input.presence === 'absent' && input.sha256 !== hashText(ABSENT_INPUT_SENTINEL)) ||
      inputPaths.has(input.path)
    )
      return 'ENV_PLAN_OPERATION_INVALID';
    inputPaths.add(input.path);
  }
  if (plan.planKind === 'inspection') {
    if (
      plan.applicability !== 'inspection-only' ||
      stableStringify(plan.decisions) !== stableStringify(inspectionDecisions())
    ) {
      return 'ENV_PLAN_OPERATION_INVALID';
    }
    if (plan.status === 'blocked')
      return plan.operations.length === 0 && plan.conflicts.length > 0
        ? undefined
        : 'ENV_PLAN_OPERATION_INVALID';
    if (plan.status !== 'reviewable' || plan.conflicts.length > 0 || plan.operations.length === 0)
      return 'ENV_PLAN_OPERATION_INVALID';
    const ids = new Set<string>();
    for (const [index, operation] of plan.operations.entries()) {
      if (
        !isObject(operation) ||
        !hasOnlyKeys(operation, [
          'id',
          'order',
          'kind',
          'environment',
          'sourcePath',
          'transferSafety',
          'properties',
        ]) ||
        operation.kind !== 'inspect-environment-source' ||
        operation.order !== index ||
        ids.has(operation.id) ||
        !isCanonicalRelativePath(operation.sourcePath) ||
        !plan.inputHashes.some(({ path }) => path === operation.sourcePath) ||
        !Array.isArray(operation.properties) ||
        !isSafeTransferSafety(operation.transferSafety) ||
        !operation.properties.every(isSafePropertyObservation)
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      ids.add(operation.id);
      if (
        operation.id !==
        operationId({
          environment: operation.environment,
          sourcePath: operation.sourcePath,
          properties: operation.properties,
          transferSafety: operation.transferSafety,
        })
      )
        return 'ENV_PLAN_OPERATION_INVALID';
    }
    return undefined;
  }
  if (
    plan.planKind !== 'mutation' ||
    plan.applicability !== 'mutation-proposal-only' ||
    plan.decisionApproval !== 'pending-consumer-approval' ||
    stableStringify(plan.proposedDecisions) !== stableStringify(mutationDecisions())
  )
    return 'ENV_PLAN_OPERATION_INVALID';
  if (plan.status === 'blocked')
    return plan.conflicts.length > 0 && plan.operations.length === 0
      ? undefined
      : 'ENV_PLAN_OPERATION_INVALID';
  if (plan.status !== 'ready' || plan.conflicts.length > 0 || plan.operations.length === 0)
    return 'ENV_PLAN_OPERATION_INVALID';
  const ids = new Set<string>();
  for (const [index, operation] of plan.operations.entries()) {
    if (!isObject(operation)) return 'ENV_PLAN_OPERATION_INVALID';
    if (operation.order !== index || ids.has(operation.id)) return 'ENV_PLAN_OPERATION_INVALID';
    ids.add(operation.id);
    if (operation.kind === 'create-environment-file') {
      if (
        !hasOnlyKeys(operation, [
          'id',
          'order',
          'kind',
          'path',
          'environment',
          'replacement',
          'derivation',
        ]) ||
        !hasOnlyKeys(operation.replacement, ['configuration', 'replace']) ||
        !hasOnlyKeys(operation.derivation, [
          'kind',
          'sourcePath',
          'sourceEnvironment',
          'sourceTransferSafety',
          'requiredInputPath',
        ])
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      if (
        !isCanonicalRelativePath(operation.path) ||
        !isCanonicalRelativePath(operation.derivation.sourcePath) ||
        operation.derivation.requiredInputPath !== operation.derivation.sourcePath ||
        operation.derivation.kind !== 'copy-verbatim-source-to-sibling' ||
        operation.derivation.sourceEnvironment !== operation.environment ||
        parentPath(operation.path) !== parentPath(operation.derivation.sourcePath) ||
        !isSafeTransferSafety(operation.derivation.sourceTransferSafety) ||
        operation.derivation.sourceTransferSafety.status !== 'safe'
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      if (
        !plan.inputHashes.some(
          ({ path, presence }) =>
            path === operation.derivation.requiredInputPath && presence === 'present',
        )
      )
        return 'ENV_PLAN_INPUT_REQUIRED';
      if (
        !plan.inputHashes.some(
          ({ path, presence }) => path === operation.path && presence === 'absent',
        )
      )
        return 'ENV_PLAN_INPUT_REQUIRED';
      const { id, ...operationBody } = operation;
      if (id !== operationId(operationBody)) return 'ENV_PLAN_OPERATION_INVALID';
      continue;
    }
    if (operation.kind === 'add-file-replacement') {
      if (
        !hasOnlyKeys(operation, [
          'id',
          'order',
          'kind',
          'target',
          'targetName',
          'configuration',
          'replace',
          'with',
          'requiredInputPath',
          'configurationStack',
          'changePreview',
        ])
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      if (
        !isCanonicalRelativePath(operation.replace) ||
        !isCanonicalRelativePath(operation.with) ||
        operation.target !== 'build' ||
        operation.targetName !== plan.project.build?.name ||
        operation.requiredInputPath !== 'angular.json'
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      if (
        !plan.inputHashes.some(
          ({ path, presence }) => path === operation.requiredInputPath && presence === 'present',
        )
      )
        return 'ENV_PLAN_INPUT_REQUIRED';
      if (!plan.project.build?.configurations.includes(operation.configuration))
        return 'ENV_PLAN_OPERATION_INVALID';
      if (!isSafeChangePreview(operation, plan.project.name, plan.project.build))
        return 'ENV_PLAN_OPERATION_INVALID';
      const { id, ...operationBody } = operation;
      if (id !== operationId(operationBody)) return 'ENV_PLAN_OPERATION_INVALID';
      continue;
    }
    if (operation.kind === 'confirm-file-replacement-present') {
      if (
        !hasOnlyKeys(operation, [
          'id',
          'order',
          'kind',
          'target',
          'targetName',
          'configuration',
          'configurationStack',
          'replace',
          'with',
          'requiredInputPath',
          'effectiveEntries',
        ]) ||
        operation.target !== 'build' ||
        operation.targetName !== plan.project.build?.name ||
        operation.requiredInputPath !== 'angular.json' ||
        !isCanonicalRelativePath(operation.replace) ||
        !isCanonicalRelativePath(operation.with) ||
        !plan.project.build?.configurations.includes(operation.configuration) ||
        !plan.inputHashes.some(
          ({ path, presence }) => path === 'angular.json' && presence === 'present',
        ) ||
        !isExistingReplacementConfirmation(operation, plan.project.build)
      )
        return 'ENV_PLAN_OPERATION_INVALID';
      const { id, ...operationBody } = operation;
      if (id !== operationId(operationBody)) return 'ENV_PLAN_OPERATION_INVALID';
      continue;
    }
    return 'ENV_PLAN_OPERATION_INVALID';
  }
  const createOperations = plan.operations.filter(
    (operation): operation is CreateEnvironmentFileOperation =>
      operation.kind === 'create-environment-file',
  );
  for (const operation of plan.operations) {
    if (operation.kind === 'add-file-replacement') {
      if (!createOperations.some(({ path }) => path === operation.with))
        return 'ENV_PLAN_OPERATION_INVALID';
    }
  }
  for (const operation of createOperations) {
    const mappingAlreadyPresent = plan.project.build?.fileReplacements.some(
      (replacement) =>
        replacement.configuration === operation.replacement.configuration &&
        replacement.replace === operation.replacement.replace &&
        replacement.with === operation.path,
    );
    const mappingProposed = plan.operations.some(
      (candidate) =>
        candidate.kind === 'add-file-replacement' &&
        candidate.configuration === operation.replacement.configuration &&
        candidate.replace === operation.replacement.replace &&
        candidate.with === operation.path,
    );
    if (!mappingAlreadyPresent && !mappingProposed) return 'ENV_PLAN_OPERATION_INVALID';
  }
  return undefined;
}

function isObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function isSafeTransferSafety(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['strategy', 'status', 'reason'])) return false;
  if (value['strategy'] !== 'verbatim-sibling-copy') return false;
  if (value['status'] === 'safe') return value['reason'] === undefined;
  return (
    value['status'] === 'blocked' &&
    [
      'dynamic-environment-value',
      'module-location-reference',
      'unsupported-top-level-effect',
    ].includes(String(value['reason']))
  );
}

function isSafeChangePreview(
  operation: Record<string, unknown>,
  projectName: string,
  build: EnvironmentPlan['project']['build'],
): boolean {
  const preview = operation['changePreview'];
  const stack = operation['configurationStack'];
  if (
    !Array.isArray(stack) ||
    stack.length === 0 ||
    new Set(stack).size !== stack.length ||
    !stack.every((item) => typeof item === 'string') ||
    !stack.includes(String(operation['configuration'])) ||
    !build ||
    !stack.every((item) => build.configurations.includes(String(item))) ||
    !isRecord(preview) ||
    !hasOnlyKeys(preview, [
      'mode',
      'scope',
      'existingEntries',
      'resultingEntries',
      'effectiveBefore',
      'effectiveAfter',
    ]) ||
    preview['mode'] !== 'append-if-absent'
  )
    return false;
  const scope = preview['scope'];
  const validEntries = (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        hasOnlyKeys(entry, ['replace', 'with']) &&
        typeof entry['replace'] === 'string' &&
        typeof entry['with'] === 'string',
    );
  if (!(
    isRecord(scope) &&
    hasOnlyKeys(scope, ['workspaceFile', 'project', 'target', 'configuration', 'property']) &&
    scope['workspaceFile'] === 'angular.json' &&
    scope['project'] === projectName &&
    scope['target'] === operation['targetName'] &&
    scope['configuration'] === operation['configuration'] &&
    scope['property'] === 'fileReplacements' &&
    validEntries(preview['existingEntries']) &&
    validEntries(preview['resultingEntries']) &&
    validEntries(preview['effectiveBefore']) &&
    validEntries(preview['effectiveAfter']) &&
    (preview['resultingEntries'] as unknown[]).some(
      (entry) =>
        stableStringify(entry) ===
        stableStringify({ replace: operation['replace'], with: operation['with'] }),
    )
  ))
    return false;

  const stackSets = stack.map((configuration) =>
    build.fileReplacementSets.find((set) => set.configuration === configuration),
  );
  let effectiveBefore: readonly { replace: string; with: string }[] = [];
  for (const set of [
    build.fileReplacementSets.find((set) => set.configuration === null),
    ...stackSets,
  ]) {
    if (set?.present) effectiveBefore = set.entries;
  }
  const selectedConfiguration = String(operation['configuration']);
  const selectedIndex = stack.indexOf(selectedConfiguration);
  const selectedSet = stackSets[selectedIndex];
  if (stackSets.slice(selectedIndex + 1).some((set) => set?.present)) return false;
  const selectedEntries = selectedSet?.present ? selectedSet.entries : effectiveBefore;
  const resultingEntries = [
    ...selectedEntries,
    { replace: operation['replace'] as string, with: operation['with'] as string },
  ];
  return (
    stableStringify(preview['effectiveBefore']) === stableStringify(effectiveBefore) &&
    stableStringify(preview['resultingEntries']) === stableStringify(resultingEntries) &&
    stableStringify(preview['effectiveAfter']) === stableStringify(resultingEntries) &&
    stableStringify(preview['existingEntries']) ===
      stableStringify(selectedSet?.present ? selectedSet.entries : [])
  );
}

function isExistingReplacementConfirmation(
  operation: Record<string, unknown>,
  build: NonNullable<EnvironmentPlan['project']['build']>,
): boolean {
  const stack = operation['configurationStack'];
  const entries = operation['effectiveEntries'];
  if (
    !Array.isArray(stack) ||
    stack.length === 0 ||
    new Set(stack).size !== stack.length ||
    !stack.every((configuration) => build.configurations.includes(String(configuration))) ||
    !stack.includes(String(operation['configuration'])) ||
    !Array.isArray(entries)
  )
    return false;
  let effective: readonly { replace: string; with: string }[] = [];
  for (const set of [
    build.fileReplacementSets.find((candidate) => candidate.configuration === null),
    ...stack.map((configuration) =>
      build.fileReplacementSets.find((candidate) => candidate.configuration === configuration),
    ),
  ]) {
    if (set?.present) effective = set.entries;
  }
  return (
    stableStringify(effective) === stableStringify(entries) &&
    effective.some(
      ({ replace, with: replacement }) =>
        replace === operation['replace'] && replacement === operation['with'],
    )
  );
}

function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  return isObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function isSafePlanProject(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['name', 'root', 'sourceRoot', 'build', 'serve']) ||
    typeof value['name'] !== 'string' ||
    typeof value['root'] !== 'string' ||
    (value['sourceRoot'] !== undefined && typeof value['sourceRoot'] !== 'string')
  )
    return false;
  return (
    (value['build'] === undefined || isSafePlanTarget(value['build'])) &&
    (value['serve'] === undefined || isSafePlanTarget(value['serve']))
  );
}

function isSafePlanTarget(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'name',
      'builder',
      'defaultConfiguration',
      'buildTargetMappings',
      'configurations',
      'outputPaths',
      'fileReplacementSets',
      'fileReplacements',
    ]) ||
    typeof value['name'] !== 'string' ||
    typeof value['builder'] !== 'string' ||
    !Array.isArray(value['configurations']) ||
    !value['configurations'].every((item) => typeof item === 'string') ||
    !Array.isArray(value['buildTargetMappings']) ||
    !Array.isArray(value['outputPaths']) ||
    !Array.isArray(value['fileReplacementSets']) ||
    !Array.isArray(value['fileReplacements'])
  )
    return false;
  if (
    value['defaultConfiguration'] !== undefined &&
    (typeof value['defaultConfiguration'] !== 'string' ||
      !value['configurations'].includes(value['defaultConfiguration']))
  )
    return false;
  const configurations = value['configurations'] as string[];
  const buildTargetMappings = value['buildTargetMappings'] as unknown[];
  const outputPaths = value['outputPaths'] as unknown[];
  const fileReplacements = value['fileReplacements'] as unknown[];
  const fileReplacementSets = value['fileReplacementSets'] as unknown[];
  const validConfiguration = (configuration: unknown) =>
    configuration === null ||
    (typeof configuration === 'string' && configurations.includes(configuration));
  const validMappings =
    buildTargetMappings.every(
      (mapping) =>
        isRecord(mapping) &&
        hasOnlyKeys(mapping, ['configuration', 'target']) &&
        validConfiguration(mapping['configuration']) &&
        typeof mapping['target'] === 'string',
    ) &&
    outputPaths.every(
      (output) =>
        isRecord(output) &&
        hasOnlyKeys(output, ['configuration', 'outputPath']) &&
        validConfiguration(output['configuration']) &&
        (typeof output['outputPath'] === 'string' ||
          (isRecord(output['outputPath']) &&
            Object.entries(output['outputPath']).every(
              ([key, item]) =>
                ['base', 'browser', 'server', 'media'].includes(key) && typeof item === 'string',
            ))),
    ) &&
    fileReplacementSets.every(
      (set) =>
        isRecord(set) &&
        hasOnlyKeys(set, ['configuration', 'present', 'entries']) &&
        validConfiguration(set['configuration']) &&
        typeof set['present'] === 'boolean' &&
        Array.isArray(set['entries']) &&
        set['entries'].every(
          (entry) =>
            isRecord(entry) &&
            hasOnlyKeys(entry, ['replace', 'with']) &&
            typeof entry['replace'] === 'string' &&
            typeof entry['with'] === 'string',
        ) &&
        (set['present'] || (set['entries'] as unknown[]).length === 0),
    ) &&
    fileReplacements.every(
      (replacement) =>
        isRecord(replacement) &&
        hasOnlyKeys(replacement, ['configuration', 'replace', 'with']) &&
        validConfiguration(replacement['configuration']) &&
        typeof replacement['replace'] === 'string' &&
        typeof replacement['with'] === 'string',
    );
  if (!validMappings) return false;
  const expectedConfigurations: (string | null)[] = [null, ...configurations];
  if (
    fileReplacementSets.length !== expectedConfigurations.length ||
    !fileReplacementSets.every(
      (set, index) => isRecord(set) && set['configuration'] === expectedConfigurations[index],
    )
  )
    return false;
  const flattenedReplacements = fileReplacementSets.flatMap((set) => {
    const record = set as Record<string, unknown>;
    return (record['entries'] as Record<string, unknown>[]).map((entry) => ({
      configuration: record['configuration'],
      replace: entry['replace'],
      with: entry['with'],
    }));
  });
  return stableStringify(flattenedReplacements) === stableStringify(fileReplacements);
}

function isSafePropertyObservation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const property = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(property, [
      'path',
      'type',
      'typeStatus',
      'valueStatus',
      'presenceStatus',
      'sourceProvenance',
      'shadowedProvenance',
    ])
  )
    return false;
  if (
    typeof property['path'] !== 'string' ||
    !property['path'] ||
    typeof property['typeStatus'] !== 'string' ||
    typeof property['valueStatus'] !== 'string' ||
    typeof property['presenceStatus'] !== 'string'
  )
    return false;
  const source = property['sourceProvenance'];
  if (!isSafeSourceLocation(source)) return false;
  if (
    property['shadowedProvenance'] !== undefined &&
    (!Array.isArray(property['shadowedProvenance']) ||
      !property['shadowedProvenance'].every(isSafeSourceLocation))
  )
    return false;
  return isSafeType(property['type']);
}

function isSafeSourceLocation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const location = value as Record<string, unknown>;
  return (
    hasOnlyKeys(location, ['file', 'line', 'column']) &&
    typeof location['file'] === 'string' &&
    isCanonicalRelativePath(location['file']) &&
    Number.isInteger(location['line']) &&
    Number.isInteger(location['column'])
  );
}

function isSafeType(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const type = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(type, ['kind', 'unknownReason', 'readonly', 'members']) ||
    typeof type['kind'] !== 'string'
  )
    return false;
  if (
    ![
      'string',
      'number',
      'boolean',
      'bigint',
      'symbol',
      'null',
      'undefined',
      'object',
      'array',
      'tuple',
      'union',
      'unknown',
    ].includes(String(type['kind']))
  )
    return false;
  if (type['readonly'] !== undefined && typeof type['readonly'] !== 'boolean') return false;
  if (
    type['unknownReason'] !== undefined &&
    !['type-depth', 'circular-type'].includes(String(type['unknownReason']))
  )
    return false;
  if (
    type['members'] !== undefined &&
    (!Array.isArray(type['members']) || !type['members'].every(isSafeType))
  )
    return false;
  return true;
}
