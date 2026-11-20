import ts from 'typescript';
import type {
  AnalysisDiagnostic,
  AnalyzedProperty,
  EnvironmentAnalysisResult,
  InfluencingFileHash,
} from './analysis-model.js';
import type {
  DiscoveredProject,
  DiscoveredTarget,
  WorkspaceDiagnostic,
} from './workspace-discovery.js';
import {
  ENVIRONMENT_PLAN_SCHEMA_VERSION,
  type EnvironmentPlan,
  type EnvironmentPlanConflict,
  type EnvironmentPlanInputFile,
  type EnvironmentPlanInputFingerprint,
  type EnvironmentPlanOperation,
  type EnvironmentPlanProject,
  type EnvironmentPlanTarget,
  type FileReplacementEntry,
  type InspectionEnvironmentPlan,
  type MutationEnvironmentPlan,
  type PlanPropertyObservation,
} from './environment-plan-model.js';
import {
  conflict,
  ABSENT_INPUT_SENTINEL,
  hashText,
  inspectionDecisions,
  isPathSafeSafely,
  isCanonicalRelativePath,
  mutationDecisions,
  operationId,
  stableStringify,
  toRootRelativePath,
  withIntegrity,
} from './environment-plan-utils.js';
import { validatePlanStructure, verifyIntegrityForBuilder } from './environment-plan-validator.js';
import { findOtherProjectOutputPathCollision } from './output-paths.js';

export function createReadOnlyEnvironmentPlan(input: {
  readonly toolVersion: string;
  readonly consumerRoot: string;
  readonly workspaceFile: EnvironmentPlanInputFile;
  readonly project: DiscoveredProject;
  readonly workspaceDiagnostics?: readonly WorkspaceDiagnostic[];
  readonly analysis: EnvironmentAnalysisResult;
}): InspectionEnvironmentPlan {
  const conflicts = [
    ...(input.workspaceDiagnostics ?? []).filter((diagnostic) => diagnostic.blocking),
    ...input.analysis.diagnostics.filter((diagnostic) => diagnostic.blocking),
  ].map((diagnostic) => toPlanConflict(diagnostic, input.consumerRoot));
  if (input.project.build && !hasValidBuildMetadata(input.project.build)) {
    conflicts.push(
      conflict(
        'ENV_PLAN_BUILDER_CONFIG_INVALID',
        'The selected build target contains configuration entries that do not match the verified application schema.',
      ),
    );
  }
  const inputHashes = mergeInputHashes(
    input.analysis.influencingFileHashes.map((item) => ({
      path: toRootRelativePath(input.consumerRoot, item.path) ?? '',
      sha256: item.sha256,
    })),
    {
      path: toRootRelativePath(input.consumerRoot, input.workspaceFile.path) ?? '',
      sha256: hashText(input.workspaceFile.sourceText),
    },
  );
  const safeInputHashes: EnvironmentPlanInputFingerprint[] = inputHashes.filter(
    ({ path }) => !!path,
  );
  if (safeInputHashes.length !== inputHashes.length) {
    conflicts.push({
      code: 'ENV_PLAN_PATH_INVALID',
      message: 'An influential input path could not be proven relative to the consumer root.',
      safeAction: 'Inspect using a canonical consumer-root snapshot and retry.',
    });
  }
  if (input.analysis.environments.length === 0 && conflicts.length === 0) {
    conflicts.push({
      code: 'ENV_PLAN_NO_ENVIRONMENTS',
      message: 'No environment source was available to create a reviewable plan.',
      safeAction: 'Select at least one supported environment source and inspect again.',
    });
  }
  const environmentSources = input.analysis.environments.map((environment) => ({
    environment,
    sourcePath: toRootRelativePath(input.consumerRoot, environment.fileName),
  }));
  if (environmentSources.some(({ sourcePath }) => !sourcePath)) {
    conflicts.push({
      code: 'ENV_PLAN_PATH_INVALID',
      message: 'An environment source path is outside the consumer workspace root.',
      safeAction: 'Inspect using canonical paths from the consumer snapshot.',
    });
  }
  const sortedConflicts = conflicts.sort(compareConflicts);
  const blocked = sortedConflicts.length > 0;
  const operations = blocked
    ? []
    : environmentSources
        .sort(
          (left, right) =>
            left.environment.name.localeCompare(right.environment.name) ||
            left.sourcePath!.localeCompare(right.sourcePath!),
        )
        .map(({ environment, sourcePath }, order) => {
          const canonicalSourcePath = sourcePath!;
          const properties = environment.properties.map((property) =>
            toPlanProperty(property, input.consumerRoot),
          );
          const content = stableStringify({
            environment: environment.name,
            sourcePath: canonicalSourcePath,
            transferSafety: environment.transferSafety,
            properties,
          });
          return {
            id: hashText(content).slice(0, 20),
            order,
            kind: 'inspect-environment-source' as const,
            environment: environment.name,
            sourcePath: canonicalSourcePath,
            transferSafety: environment.transferSafety,
            properties,
          };
        });
  const body = {
    schemaVersion: ENVIRONMENT_PLAN_SCHEMA_VERSION,
    planKind: 'inspection' as const,
    applicability: 'inspection-only' as const,
    toolVersion: input.toolVersion,
    typescriptVersion: ts.version,
    status: blocked ? ('blocked' as const) : ('reviewable' as const),
    project: toPlanProject(input.project),
    decisions: inspectionDecisions(),
    inputHashes: safeInputHashes,
    operations,
    conflicts: sortedConflicts,
  };
  return withIntegrity(body) as InspectionEnvironmentPlan;
}

export function createMutationEnvironmentPlan(input: {
  readonly inspectionPlan: InspectionEnvironmentPlan;
  readonly consumerRoot: string;
  /** Snapshot-backed proof that a mutation path and its parents are in-root and non-symlink. */
  readonly isPathSafe: (root: string, relativePath: string) => boolean;
  /** Read-only inputs may traverse internal workspace symlinks such as pnpm package links. */
  readonly isReadPathSafe?: (root: string, relativePath: string) => boolean;
  readonly existingFiles: readonly { readonly path: string }[];
  readonly otherBuildTargets?: readonly {
    readonly projectName: string;
    readonly target?: DiscoveredTarget;
  }[];
  readonly proposals: readonly {
    readonly environment: string;
    readonly sourcePath: string;
    readonly destinationPath: string;
    readonly configuration: string;
    readonly configurationStack: readonly string[];
    readonly replacePath: string;
  }[];
}): MutationEnvironmentPlan {
  const inspection = input.inspectionPlan;
  const inspectionStructure = validatePlanStructure(inspection);
  const inspectionIntegrity = verifyIntegrityForBuilder(inspection);
  if (inspectionStructure || !inspectionIntegrity.ok) {
    return withIntegrity({
      schemaVersion: ENVIRONMENT_PLAN_SCHEMA_VERSION,
      planKind: 'mutation',
      applicability: 'mutation-proposal-only',
      toolVersion: typeof inspection?.toolVersion === 'string' ? inspection.toolVersion : 'unknown',
      typescriptVersion: ts.version,
      status: 'blocked',
      project: { name: 'unknown', root: '' },
      proposedDecisions: mutationDecisions(),
      decisionApproval: 'pending-consumer-approval',
      inputHashes: [],
      operations: [],
      conflicts: [
        conflict(
          'ENV_PLAN_INSPECTION_INVALID',
          'The inspection plan is structurally invalid or has changed.',
        ),
      ],
    }) as MutationEnvironmentPlan;
  }

  const conflicts: EnvironmentPlanConflict[] = [];
  if (inspection.status !== 'reviewable') {
    conflicts.push(
      conflict(
        'ENV_PLAN_INSPECTION_REQUIRED',
        'A complete reviewable inspection plan is required.',
      ),
    );
  }
  const sourceHashes = new Map(
    inspection.inputHashes.map(({ path, sha256, presence }) => [path, { sha256, presence }]),
  );
  if (
    !inspection.inputHashes.every(({ path }) =>
      isPathSafeSafely(input.isReadPathSafe ?? input.isPathSafe, input.consumerRoot, path),
    )
  ) {
    conflicts.push(
      conflict(
        'ENV_PLAN_PATH_INVALID',
        'An influential input path is unsafe or crosses a symlink.',
      ),
    );
  }
  const build = inspection.project.build;
  if (!build || build.builder !== '@angular/build:application') {
    conflicts.push(
      conflict(
        'ENV_PLAN_BUILDER_SCHEMA_UNVERIFIED',
        'Mutation planning requires the locally verified @angular/build:application schema.',
      ),
    );
  }
  if (!inspection.inputHashes.some(({ path }) => /(^|\/)tsconfig[^/]*\.json$/i.test(path))) {
    conflicts.push({
      ...conflict(
        'ENV_PLAN_INPUT_REQUIRED',
        'A consumer TypeScript project configuration is not fingerprinted.',
      ),
      path: 'tsconfig',
    });
  }

  const existingPaths = new Set<string>();
  for (const file of input.existingFiles) {
    const path = toRootRelativePath(input.consumerRoot, file.path);
    if (!path || !isPathSafeSafely(input.isPathSafe, input.consumerRoot, path)) {
      conflicts.push(
        conflict('ENV_PLAN_PATH_INVALID', 'An existing file path is unsafe or crosses a symlink.'),
      );
    } else {
      existingPaths.add(path);
    }
  }
  if (input.proposals.length === 0) {
    conflicts.push(
      conflict('ENV_PLAN_NO_MUTATIONS', 'At least one explicit mutation proposal is required.'),
    );
  }

  const operations: EnvironmentPlanOperation[] = [];
  const proposals = [...input.proposals].sort(
    (left, right) =>
      left.configuration.localeCompare(right.configuration) ||
      left.destinationPath.localeCompare(right.destinationPath),
  );
  const seenPaths = new Set<string>();
  for (const proposal of proposals) {
    const sourcePath = toRootRelativePath(input.consumerRoot, proposal.sourcePath);
    const destinationPath = toRootRelativePath(input.consumerRoot, proposal.destinationPath);
    const replacePath = toRootRelativePath(input.consumerRoot, proposal.replacePath);
    if (
      !sourcePath ||
      !destinationPath ||
      !replacePath ||
      !isPathSafeSafely(input.isPathSafe, input.consumerRoot, sourcePath) ||
      !isPathSafeSafely(input.isPathSafe, input.consumerRoot, destinationPath) ||
      !isPathSafeSafely(input.isPathSafe, input.consumerRoot, replacePath)
    ) {
      conflicts.push(
        conflict(
          'ENV_PLAN_PATH_INVALID',
          'A proposed path is unsafe or outside the consumer root.',
        ),
      );
      continue;
    }
    const sourceFingerprint = sourceHashes.get(sourcePath);
    const sourceOperation = inspection.operations.find(
      ({ sourcePath: path }) => path === sourcePath,
    );
    if (!sourceFingerprint || sourceFingerprint.presence !== 'present' || !sourceOperation) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_INPUT_REQUIRED',
          'A mutation source is not present in the inspected environment input graph.',
        ),
        path: sourcePath,
      });
      continue;
    }
    if (sourceOperation.environment !== proposal.environment) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_ENVIRONMENT_SOURCE_MISMATCH',
          'The proposal environment must match the environment analyzed from this source.',
        ),
        path: sourcePath,
      });
      continue;
    }
    if (sourceOperation.transferSafety.status !== 'safe') {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_SOURCE_TRANSFER_UNSAFE',
          'The source contains values or module behavior that cannot be copied safely without transformation.',
        ),
        path: sourcePath,
      });
      continue;
    }
    if (parentPath(sourcePath) !== parentPath(destinationPath)) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_SOURCE_RELOCATION_UNSAFE',
          'Only verbatim copies beside their source are supported; moving a source may change relative imports.',
        ),
        path: destinationPath,
      });
      continue;
    }
    if (!sourceHashes.has('angular.json')) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_INPUT_REQUIRED',
          'The Angular workspace configuration is not fingerprinted.',
        ),
        path: 'angular.json',
      });
      continue;
    }
    if (!build || !build.configurations.includes(proposal.configuration)) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_CONFIGURATION_UNKNOWN',
          'The target build configuration does not exist.',
        ),
        path: proposal.configuration,
      });
      continue;
    }
    if (
      proposal.configurationStack.length === 0 ||
      new Set(proposal.configurationStack).size !== proposal.configurationStack.length ||
      !proposal.configurationStack.includes(proposal.configuration) ||
      proposal.configurationStack.some(
        (configuration) => !build.configurations.includes(configuration),
      )
    ) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_CONFIGURATION_STACK_INVALID',
          'The explicit ordered configuration stack is invalid for this build target.',
        ),
        path: proposal.configuration,
      });
      continue;
    }
    const outputCollision = findOutputCollision(build.outputPaths, proposal.configurationStack, [
      destinationPath,
    ]);
    if (outputCollision) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_OUTPUT_COLLISION',
          'A proposed environment path intersects an output root used by the selected build target.',
        ),
        path: outputCollision,
      });
      continue;
    }
    const otherOutputCollision = findOtherProjectOutputPathCollision(
      input.otherBuildTargets ?? [],
      inspection.project.name,
      destinationPath,
    );
    if (otherOutputCollision.kind === 'unknown') {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_OUTPUT_PATH_UNVERIFIED',
          'A configured outputPath in another project could not be safely classified.',
        ),
        path: destinationPath,
      });
      continue;
    }
    if (otherOutputCollision.kind === 'collision') {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_OUTPUT_COLLISION',
          'The proposed generated file is inside an output root configured by another project.',
        ),
        path: otherOutputCollision.path,
      });
      continue;
    }
    if (seenPaths.has(destinationPath)) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_DESTINATION_COLLISION',
          'Multiple proposals target the same destination path.',
        ),
        path: destinationPath,
      });
      continue;
    }
    seenPaths.add(destinationPath);

    const stackSets = proposal.configurationStack.map((configuration) =>
      build.fileReplacementSets.find((set) => set.configuration === configuration),
    );
    const targetSet = stackSets[proposal.configurationStack.indexOf(proposal.configuration)];
    const targetEntries = targetSet?.present ? [...targetSet.entries] : [];
    const earlierSets = [
      build.fileReplacementSets.find((set) => set.configuration === null),
      ...stackSets.slice(0, proposal.configurationStack.indexOf(proposal.configuration)),
    ];
    let effectiveBefore: FileReplacementEntry[] = [];
    for (const set of [
      build.fileReplacementSets.find((candidate) => candidate.configuration === null),
      ...stackSets,
    ]) {
      if (set?.present) effectiveBefore = [...set.entries];
    }
    const targetIndex = proposal.configurationStack.indexOf(proposal.configuration);
    const laterOverride = stackSets.slice(targetIndex + 1).some((set) => set?.present);
    const conflictingMapping = [
      ...earlierSets.flatMap((set) => (set?.present ? set.entries : [])),
      ...targetEntries,
      ...stackSets.slice(targetIndex + 1).flatMap((set) => (set?.present ? set.entries : [])),
      ...effectiveBefore,
    ].find(
      ({ replace, with: replacement }) =>
        replace === replacePath && replacement !== destinationPath,
    );
    if (conflictingMapping) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_REPLACEMENT_CONFLICT',
          'A different replacement already uses this source path.',
        ),
        path: proposal.configuration,
      });
      continue;
    }
    const exactEffectiveMapping = effectiveBefore.some(
      ({ replace, with: replacement }) =>
        replace === replacePath && replacement === destinationPath,
    );
    if (existingPaths.has(destinationPath)) {
      if (exactEffectiveMapping) {
        const confirmation = {
          order: operations.length,
          kind: 'confirm-file-replacement-present' as const,
          target: 'build' as const,
          targetName: build.name,
          configuration: proposal.configuration,
          configurationStack: [...proposal.configurationStack],
          replace: replacePath,
          with: destinationPath,
          requiredInputPath: 'angular.json',
          effectiveEntries: effectiveBefore,
        };
        operations.push({ ...confirmation, id: operationId(confirmation) });
        continue;
      }
      conflicts.push({
        ...conflict(
          'ENV_PLAN_FILE_OWNED',
          'The proposed destination already exists and remains consumer-owned.',
        ),
        path: destinationPath,
      });
      continue;
    }
    if (laterOverride && !exactEffectiveMapping) {
      conflicts.push({
        ...conflict(
          'ENV_PLAN_COMPOSITION_OVERRIDE',
          'A later configuration replaces the complete fileReplacements array, so this proposal would not affect the effective build.',
        ),
        path: proposal.configuration,
      });
      continue;
    }

    const createOperation = {
      order: operations.length,
      kind: 'create-environment-file' as const,
      path: destinationPath,
      environment: proposal.environment,
      replacement: { configuration: proposal.configuration, replace: replacePath },
      derivation: {
        kind: 'copy-verbatim-source-to-sibling' as const,
        sourcePath,
        sourceEnvironment: sourceOperation.environment,
        sourceTransferSafety: sourceOperation.transferSafety,
        requiredInputPath: sourcePath,
      },
    };
    operations.push({ ...createOperation, id: operationId(createOperation) });

    if (!exactEffectiveMapping) {
      const replacement = { replace: replacePath, with: destinationPath };
      const resultingEntries = [
        ...(targetSet?.present ? targetEntries : effectiveBefore),
        replacement,
      ];
      const effectiveAfter = [...resultingEntries];
      const replacementOperation = {
        order: operations.length,
        kind: 'add-file-replacement' as const,
        target: 'build' as const,
        targetName: build.name,
        configuration: proposal.configuration,
        configurationStack: [...proposal.configurationStack],
        replace: replacePath,
        with: destinationPath,
        requiredInputPath: 'angular.json',
        changePreview: {
          mode: 'append-if-absent' as const,
          scope: {
            workspaceFile: 'angular.json' as const,
            project: inspection.project.name,
            target: build.name,
            configuration: proposal.configuration,
            property: 'fileReplacements' as const,
          },
          existingEntries: targetEntries,
          resultingEntries,
          effectiveBefore,
          effectiveAfter,
        },
      };
      operations.push({ ...replacementOperation, id: operationId(replacementOperation) });
    }
  }

  const sortedConflicts = conflicts.sort(compareConflicts);
  const blocked = sortedConflicts.length > 0;
  const body = {
    schemaVersion: ENVIRONMENT_PLAN_SCHEMA_VERSION,
    planKind: 'mutation' as const,
    applicability: 'mutation-proposal-only' as const,
    toolVersion: inspection.toolVersion,
    typescriptVersion: inspection.typescriptVersion,
    status: blocked ? ('blocked' as const) : ('ready' as const),
    project: inspection.project,
    proposedDecisions: mutationDecisions(),
    decisionApproval: 'pending-consumer-approval' as const,
    inputHashes: blocked
      ? inspection.inputHashes
      : addAbsentDestinationFingerprints(inspection.inputHashes, operations),
    operations: blocked ? [] : operations,
    conflicts: sortedConflicts,
  };
  return withIntegrity(body) as MutationEnvironmentPlan;
}

function findOutputCollision(
  outputPaths: EnvironmentPlanTarget['outputPaths'],
  stack: readonly string[],
  proposedPaths: readonly string[],
): string | undefined {
  let effective: string | Readonly<Record<string, string>> | undefined;
  for (const layer of [null, ...stack]) {
    const configured = outputPaths.find((entry) => entry.configuration === layer);
    if (configured) effective = configured.outputPath;
  }
  if (effective === undefined) return undefined;
  const roots =
    typeof effective === 'string'
      ? [effective]
      : [
          effective['base'],
          ...['browser', 'server', 'media'].map((key) =>
            effective[key] === undefined
              ? undefined
              : `${effective['base'] ?? ''}/${effective[key]}`,
          ),
        ].filter((root): root is string => typeof root === 'string' && root.length > 0);
  for (const configuredRoot of roots) {
    const root = configuredRoot.replace(/\\/g, '/').replace(/\/$/, '');
    if (!root || root.split('/').includes('..')) return '.';
    for (const proposed of proposedPaths) {
      if (proposed === root || proposed.startsWith(`${root}/`)) return proposed;
    }
  }
  return undefined;
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}

function hasValidBuildMetadata(target: DiscoveredTarget): boolean {
  const configurations = [
    target.options,
    ...target.configurations.map((name) => target.configurationsByName[name]),
  ];
  for (const options of configurations) {
    if (!options) continue;
    if (options['outputPath'] !== undefined && !isValidOutputPath(options['outputPath']))
      return false;
    const replacements = options['fileReplacements'];
    if (replacements === undefined) continue;
    if (!Array.isArray(replacements)) return false;
    const replaced = new Set<string>();
    for (const replacement of replacements) {
      if (!replacement || typeof replacement !== 'object') return false;
      const record = replacement as Record<string, unknown>;
      if (Object.keys(record).some((key) => !['replace', 'with'].includes(key))) return false;
      if (typeof record['replace'] !== 'string' || typeof record['with'] !== 'string') return false;
      if (
        !/\.(([cm]?[jt])sx?|json)$/.test(record['replace']) ||
        !/\.(([cm]?[jt])sx?|json)$/.test(record['with'])
      )
        return false;
      if (!isSafeWorkspaceFilePath(record['replace']) || !isSafeWorkspaceFilePath(record['with']))
        return false;
      if (replaced.has(record['replace'])) return false;
      replaced.add(record['replace']);
    }
  }
  return (
    !target.defaultConfiguration || target.configurations.includes(target.defaultConfiguration)
  );
}

function isValidOutputPath(value: unknown): boolean {
  if (typeof value === 'string') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ['base', 'browser', 'server', 'media'];
  return (
    Object.keys(record).every((key) => keys.includes(key)) &&
    typeof record['base'] === 'string' &&
    Object.values(record).every((entry) => typeof entry === 'string')
  );
}

function isSafeWorkspaceFilePath(value: string): boolean {
  return (
    !value.startsWith('/') &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).some((part) => part === '..' || part === '.')
  );
}

function toPlanProject(project: DiscoveredProject): EnvironmentPlanProject {
  return {
    name: project.name,
    root: project.root,
    sourceRoot: project.sourceRoot,
    build: project.build ? toPlanTarget(project.build) : undefined,
    serve: project.serve ? toPlanTarget(project.serve) : undefined,
  };
}

function toPlanTarget(target: DiscoveredTarget): EnvironmentPlanTarget {
  const configurations = target.configurations.map((configuration) => ({
    name: configuration,
    options: target.configurationsByName[configuration],
  }));
  const outputPaths = [
    toOutputPath(null, target.options['outputPath']),
    ...configurations.map(({ name, options }) => toOutputPath(name, options?.['outputPath'])),
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  const buildTargetMappings = [
    readBuildTarget(null, target.options),
    ...configurations.map(({ name, options }) => readBuildTarget(name, options)),
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  const fileReplacementSets = [
    { configuration: null, options: target.options },
    ...configurations.map(({ name, options }) => ({ configuration: name, options })),
  ].map(({ configuration, options }) => ({
    configuration,
    present: !!options && Object.prototype.hasOwnProperty.call(options, 'fileReplacements'),
    entries: readReplacementEntries(options?.['fileReplacements']),
  }));
  const fileReplacements = fileReplacementSets.flatMap(({ configuration, entries }) =>
    entries.map((entry) => ({ configuration, ...entry })),
  );
  return {
    name: target.name,
    builder: target.builder,
    defaultConfiguration: target.defaultConfiguration,
    buildTargetMappings,
    configurations: target.configurations,
    outputPaths,
    fileReplacementSets,
    fileReplacements,
  };
}

function readBuildTarget(
  configuration: string | null,
  options: Readonly<Record<string, unknown>> | undefined,
): EnvironmentPlanTarget['buildTargetMappings'][number] | undefined {
  if (!options) return undefined;
  const target = options['buildTarget'] ?? options['browserTarget'];
  return typeof target === 'string' ? { configuration, target } : undefined;
}

function toOutputPath(
  configuration: string | null,
  value: unknown,
): EnvironmentPlanTarget['outputPaths'][number] | undefined {
  if (typeof value === 'string') return { configuration, outputPath: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const outputPath = Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return Object.keys(outputPath).length ? { configuration, outputPath } : undefined;
}

function readReplacements(
  configuration: string | null,
  value: unknown,
): EnvironmentPlanTarget['fileReplacements'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry['replace'] !== 'string' ||
      typeof entry['with'] !== 'string'
    ) {
      return [];
    }
    return [{ configuration, replace: entry['replace'], with: entry['with'] }];
  });
}

function readReplacementEntries(value: unknown): FileReplacementEntry[] {
  return readReplacements(null, value).map(({ replace, with: replacement }) => ({
    replace,
    with: replacement,
  }));
}

function toPlanProperty(property: AnalyzedProperty, consumerRoot: string): PlanPropertyObservation {
  return {
    path: property.path,
    type: property.type,
    typeStatus: property.typeStatus,
    valueStatus: property.valueStatus,
    presenceStatus: property.presenceStatus,
    sourceProvenance: {
      ...property.sourceProvenance,
      file:
        toRootRelativePath(consumerRoot, property.sourceProvenance.file) ??
        property.sourceProvenance.file,
    },
    shadowedProvenance: property.shadowedProvenance?.map((location) => ({
      ...location,
      file: toRootRelativePath(consumerRoot, location.file) ?? location.file,
    })),
  };
}

function toPlanConflict(
  diagnostic: AnalysisDiagnostic | WorkspaceDiagnostic,
  consumerRoot: string,
): EnvironmentPlanConflict {
  const sourceLocation = diagnostic.sourceLocation as
    { readonly file: string; readonly line?: number; readonly column?: number } | undefined;
  const path = diagnostic.path
    ? (toRootRelativePath(consumerRoot, diagnostic.path) ??
      (isCanonicalRelativePath(diagnostic.path) ? diagnostic.path : undefined))
    : undefined;
  const file = sourceLocation
    ? (toRootRelativePath(consumerRoot, sourceLocation.file) ??
      (isCanonicalRelativePath(sourceLocation.file) ? sourceLocation.file : undefined))
    : undefined;
  return {
    code: diagnostic.code,
    resourceBudget: 'resourceBudget' in diagnostic ? diagnostic.resourceBudget : undefined,
    path,
    sourceLocation: file ? { ...sourceLocation, file } : undefined,
    message: diagnostic.message,
    safeAction: diagnostic.safeAction,
  };
}

function mergeInputHashes(
  sourceHashes: readonly InfluencingFileHash[],
  workspaceHash: InfluencingFileHash,
): readonly EnvironmentPlanInputFingerprint[] {
  const hashes = new Map<string, string>();
  for (const item of [...sourceHashes, workspaceHash]) {
    const previous = hashes.get(item.path);
    if (previous !== undefined && previous !== item.sha256) {
      throw new Error('The plan inputs contain inconsistent snapshots for one path.');
    }
    hashes.set(item.path, item.sha256);
  }
  return [...hashes.entries()]
    .map(([path, sha256]) => ({ path, sha256, presence: 'present' as const }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function addAbsentDestinationFingerprints(
  inputHashes: readonly EnvironmentPlanInputFingerprint[],
  operations: readonly EnvironmentPlanOperation[],
): readonly EnvironmentPlanInputFingerprint[] {
  const byPath = new Map(inputHashes.map((fingerprint) => [fingerprint.path, fingerprint]));
  for (const operation of operations) {
    if (operation.kind === 'create-environment-file') {
      byPath.set(operation.path, {
        path: operation.path,
        sha256: hashText(ABSENT_INPUT_SENTINEL),
        presence: 'absent',
      });
    }
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function compareConflicts(left: EnvironmentPlanConflict, right: EnvironmentPlanConflict): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.path ?? '').localeCompare(right.path ?? '') ||
    (left.sourceLocation?.file ?? '').localeCompare(right.sourceLocation?.file ?? '') ||
    (left.sourceLocation?.line ?? 0) - (right.sourceLocation?.line ?? 0) ||
    (left.sourceLocation?.column ?? 0) - (right.sourceLocation?.column ?? 0)
  );
}

export type * from './environment-plan-model.js';
export {
  verifyEnvironmentPlan,
  verifyEnvironmentPlanReview,
  verifyEnvironmentPlanEligibility,
  verifyReadOnlyEnvironmentPlan,
} from './environment-plan-validator.js';
