"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReadOnlyEnvironmentPlan = exports.verifyEnvironmentPlanEligibility = exports.verifyEnvironmentPlanReview = exports.verifyEnvironmentPlan = void 0;
exports.createReadOnlyEnvironmentPlan = createReadOnlyEnvironmentPlan;
exports.createMutationEnvironmentPlan = createMutationEnvironmentPlan;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const environment_plan_model_js_1 = require("./environment-plan-model.cjs");
const environment_plan_utils_js_1 = require("./environment-plan-utils.cjs");
const environment_plan_validator_js_1 = require("./environment-plan-validator.cjs");
const output_paths_js_1 = require("./output-paths.cjs");
function createReadOnlyEnvironmentPlan(input) {
    const conflicts = [
        ...(input.workspaceDiagnostics ?? []).filter((diagnostic) => diagnostic.blocking),
        ...input.analysis.diagnostics.filter((diagnostic) => diagnostic.blocking),
    ].map((diagnostic) => toPlanConflict(diagnostic, input.consumerRoot));
    if (input.project.build && !hasValidBuildMetadata(input.project.build)) {
        conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_BUILDER_CONFIG_INVALID', 'The selected build target contains configuration entries that do not match the verified application schema.'));
    }
    const inputHashes = mergeInputHashes(input.analysis.influencingFileHashes.map((item) => ({
        path: (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, item.path) ?? '',
        sha256: item.sha256,
    })), {
        path: (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, input.workspaceFile.path) ?? '',
        sha256: (0, environment_plan_utils_js_1.hashText)(input.workspaceFile.sourceText),
    });
    const safeInputHashes = inputHashes.filter(({ path }) => !!path);
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
        sourcePath: (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, environment.fileName),
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
            .sort((left, right) => left.environment.name.localeCompare(right.environment.name) ||
            left.sourcePath.localeCompare(right.sourcePath))
            .map(({ environment, sourcePath }, order) => {
            const canonicalSourcePath = sourcePath;
            const properties = environment.properties.map((property) => toPlanProperty(property, input.consumerRoot));
            const content = (0, environment_plan_utils_js_1.stableStringify)({
                environment: environment.name,
                sourcePath: canonicalSourcePath,
                transferSafety: environment.transferSafety,
                properties,
            });
            return {
                id: (0, environment_plan_utils_js_1.hashText)(content).slice(0, 20),
                order,
                kind: 'inspect-environment-source',
                environment: environment.name,
                sourcePath: canonicalSourcePath,
                transferSafety: environment.transferSafety,
                properties,
            };
        });
    const body = {
        schemaVersion: environment_plan_model_js_1.ENVIRONMENT_PLAN_SCHEMA_VERSION,
        planKind: 'inspection',
        applicability: 'inspection-only',
        toolVersion: input.toolVersion,
        typescriptVersion: typescript_1.default.version,
        status: blocked ? 'blocked' : 'reviewable',
        project: toPlanProject(input.project),
        decisions: (0, environment_plan_utils_js_1.inspectionDecisions)(),
        inputHashes: safeInputHashes,
        operations,
        conflicts: sortedConflicts,
    };
    return (0, environment_plan_utils_js_1.withIntegrity)(body);
}
function createMutationEnvironmentPlan(input) {
    const inspection = input.inspectionPlan;
    const inspectionStructure = (0, environment_plan_validator_js_1.validatePlanStructure)(inspection);
    const inspectionIntegrity = (0, environment_plan_validator_js_1.verifyIntegrityForBuilder)(inspection);
    if (inspectionStructure || !inspectionIntegrity.ok) {
        return (0, environment_plan_utils_js_1.withIntegrity)({
            schemaVersion: environment_plan_model_js_1.ENVIRONMENT_PLAN_SCHEMA_VERSION,
            planKind: 'mutation',
            applicability: 'mutation-proposal-only',
            toolVersion: typeof inspection?.toolVersion === 'string' ? inspection.toolVersion : 'unknown',
            typescriptVersion: typescript_1.default.version,
            status: 'blocked',
            project: { name: 'unknown', root: '' },
            proposedDecisions: (0, environment_plan_utils_js_1.mutationDecisions)(),
            decisionApproval: 'pending-consumer-approval',
            inputHashes: [],
            operations: [],
            conflicts: [
                (0, environment_plan_utils_js_1.conflict)('ENV_PLAN_INSPECTION_INVALID', 'The inspection plan is structurally invalid or has changed.'),
            ],
        });
    }
    const conflicts = [];
    if (inspection.status !== 'reviewable') {
        conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_INSPECTION_REQUIRED', 'A complete reviewable inspection plan is required.'));
    }
    const sourceHashes = new Map(inspection.inputHashes.map(({ path, sha256, presence }) => [path, { sha256, presence }]));
    if (!inspection.inputHashes.every(({ path }) => (0, environment_plan_utils_js_1.isPathSafeSafely)(input.isReadPathSafe ?? input.isPathSafe, input.consumerRoot, path))) {
        conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_PATH_INVALID', 'An influential input path is unsafe or crosses a symlink.'));
    }
    const build = inspection.project.build;
    if (!build || build.builder !== '@angular/build:application') {
        conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_BUILDER_SCHEMA_UNVERIFIED', 'Mutation planning requires the locally verified @angular/build:application schema.'));
    }
    if (!inspection.inputHashes.some(({ path }) => /(^|\/)tsconfig[^/]*\.json$/i.test(path))) {
        conflicts.push({
            ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_INPUT_REQUIRED', 'A consumer TypeScript project configuration is not fingerprinted.'),
            path: 'tsconfig',
        });
    }
    const existingPaths = new Set();
    for (const file of input.existingFiles) {
        const path = (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, file.path);
        if (!path || !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, path)) {
            conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_PATH_INVALID', 'An existing file path is unsafe or crosses a symlink.'));
        }
        else {
            existingPaths.add(path);
        }
    }
    if (input.proposals.length === 0) {
        conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_NO_MUTATIONS', 'At least one explicit mutation proposal is required.'));
    }
    const operations = [];
    const proposals = [...input.proposals].sort((left, right) => left.configuration.localeCompare(right.configuration) ||
        left.destinationPath.localeCompare(right.destinationPath));
    const seenPaths = new Set();
    for (const proposal of proposals) {
        const sourcePath = (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, proposal.sourcePath);
        const destinationPath = (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, proposal.destinationPath);
        const replacePath = (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, proposal.replacePath);
        if (!sourcePath ||
            !destinationPath ||
            !replacePath ||
            !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, sourcePath) ||
            !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, destinationPath) ||
            !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, replacePath)) {
            conflicts.push((0, environment_plan_utils_js_1.conflict)('ENV_PLAN_PATH_INVALID', 'A proposed path is unsafe or outside the consumer root.'));
            continue;
        }
        const sourceFingerprint = sourceHashes.get(sourcePath);
        const sourceOperation = inspection.operations.find(({ sourcePath: path }) => path === sourcePath);
        if (!sourceFingerprint || sourceFingerprint.presence !== 'present' || !sourceOperation) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_INPUT_REQUIRED', 'A mutation source is not present in the inspected environment input graph.'),
                path: sourcePath,
            });
            continue;
        }
        if (sourceOperation.environment !== proposal.environment) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_ENVIRONMENT_SOURCE_MISMATCH', 'The proposal environment must match the environment analyzed from this source.'),
                path: sourcePath,
            });
            continue;
        }
        if (sourceOperation.transferSafety.status !== 'safe') {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_SOURCE_TRANSFER_UNSAFE', 'The source contains values or module behavior that cannot be copied safely without transformation.'),
                path: sourcePath,
            });
            continue;
        }
        if (parentPath(sourcePath) !== parentPath(destinationPath)) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_SOURCE_RELOCATION_UNSAFE', 'Only verbatim copies beside their source are supported; moving a source may change relative imports.'),
                path: destinationPath,
            });
            continue;
        }
        if (!sourceHashes.has('angular.json')) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_INPUT_REQUIRED', 'The Angular workspace configuration is not fingerprinted.'),
                path: 'angular.json',
            });
            continue;
        }
        if (!build || !build.configurations.includes(proposal.configuration)) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_CONFIGURATION_UNKNOWN', 'The target build configuration does not exist.'),
                path: proposal.configuration,
            });
            continue;
        }
        if (proposal.configurationStack.length === 0 ||
            new Set(proposal.configurationStack).size !== proposal.configurationStack.length ||
            !proposal.configurationStack.includes(proposal.configuration) ||
            proposal.configurationStack.some((configuration) => !build.configurations.includes(configuration))) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_CONFIGURATION_STACK_INVALID', 'The explicit ordered configuration stack is invalid for this build target.'),
                path: proposal.configuration,
            });
            continue;
        }
        const outputCollision = findOutputCollision(build.outputPaths, proposal.configurationStack, [
            destinationPath,
        ]);
        if (outputCollision) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_OUTPUT_COLLISION', 'A proposed environment path intersects an output root used by the selected build target.'),
                path: outputCollision,
            });
            continue;
        }
        const otherOutputCollision = (0, output_paths_js_1.findOtherProjectOutputPathCollision)(input.otherBuildTargets ?? [], inspection.project.name, destinationPath);
        if (otherOutputCollision.kind === 'unknown') {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_OUTPUT_PATH_UNVERIFIED', 'A configured outputPath in another project could not be safely classified.'),
                path: destinationPath,
            });
            continue;
        }
        if (otherOutputCollision.kind === 'collision') {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_OUTPUT_COLLISION', 'The proposed generated file is inside an output root configured by another project.'),
                path: otherOutputCollision.path,
            });
            continue;
        }
        if (seenPaths.has(destinationPath)) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_DESTINATION_COLLISION', 'Multiple proposals target the same destination path.'),
                path: destinationPath,
            });
            continue;
        }
        seenPaths.add(destinationPath);
        const stackSets = proposal.configurationStack.map((configuration) => build.fileReplacementSets.find((set) => set.configuration === configuration));
        const targetSet = stackSets[proposal.configurationStack.indexOf(proposal.configuration)];
        const targetEntries = targetSet?.present ? [...targetSet.entries] : [];
        const earlierSets = [
            build.fileReplacementSets.find((set) => set.configuration === null),
            ...stackSets.slice(0, proposal.configurationStack.indexOf(proposal.configuration)),
        ];
        let effectiveBefore = [];
        for (const set of [
            build.fileReplacementSets.find((candidate) => candidate.configuration === null),
            ...stackSets,
        ]) {
            if (set?.present)
                effectiveBefore = [...set.entries];
        }
        const targetIndex = proposal.configurationStack.indexOf(proposal.configuration);
        const laterOverride = stackSets.slice(targetIndex + 1).some((set) => set?.present);
        const conflictingMapping = [
            ...earlierSets.flatMap((set) => (set?.present ? set.entries : [])),
            ...targetEntries,
            ...stackSets.slice(targetIndex + 1).flatMap((set) => (set?.present ? set.entries : [])),
            ...effectiveBefore,
        ].find(({ replace, with: replacement }) => replace === replacePath && replacement !== destinationPath);
        if (conflictingMapping) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_REPLACEMENT_CONFLICT', 'A different replacement already uses this source path.'),
                path: proposal.configuration,
            });
            continue;
        }
        const exactEffectiveMapping = effectiveBefore.some(({ replace, with: replacement }) => replace === replacePath && replacement === destinationPath);
        if (existingPaths.has(destinationPath)) {
            if (exactEffectiveMapping) {
                const confirmation = {
                    order: operations.length,
                    kind: 'confirm-file-replacement-present',
                    target: 'build',
                    targetName: build.name,
                    configuration: proposal.configuration,
                    configurationStack: [...proposal.configurationStack],
                    replace: replacePath,
                    with: destinationPath,
                    requiredInputPath: 'angular.json',
                    effectiveEntries: effectiveBefore,
                };
                operations.push({ ...confirmation, id: (0, environment_plan_utils_js_1.operationId)(confirmation) });
                continue;
            }
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_FILE_OWNED', 'The proposed destination already exists and remains consumer-owned.'),
                path: destinationPath,
            });
            continue;
        }
        if (laterOverride && !exactEffectiveMapping) {
            conflicts.push({
                ...(0, environment_plan_utils_js_1.conflict)('ENV_PLAN_COMPOSITION_OVERRIDE', 'A later configuration replaces the complete fileReplacements array, so this proposal would not affect the effective build.'),
                path: proposal.configuration,
            });
            continue;
        }
        const createOperation = {
            order: operations.length,
            kind: 'create-environment-file',
            path: destinationPath,
            environment: proposal.environment,
            replacement: { configuration: proposal.configuration, replace: replacePath },
            derivation: {
                kind: 'copy-verbatim-source-to-sibling',
                sourcePath,
                sourceEnvironment: sourceOperation.environment,
                sourceTransferSafety: sourceOperation.transferSafety,
                requiredInputPath: sourcePath,
            },
        };
        operations.push({ ...createOperation, id: (0, environment_plan_utils_js_1.operationId)(createOperation) });
        if (!exactEffectiveMapping) {
            const replacement = { replace: replacePath, with: destinationPath };
            const resultingEntries = [
                ...(targetSet?.present ? targetEntries : effectiveBefore),
                replacement,
            ];
            const effectiveAfter = [...resultingEntries];
            const replacementOperation = {
                order: operations.length,
                kind: 'add-file-replacement',
                target: 'build',
                targetName: build.name,
                configuration: proposal.configuration,
                configurationStack: [...proposal.configurationStack],
                replace: replacePath,
                with: destinationPath,
                requiredInputPath: 'angular.json',
                changePreview: {
                    mode: 'append-if-absent',
                    scope: {
                        workspaceFile: 'angular.json',
                        project: inspection.project.name,
                        target: build.name,
                        configuration: proposal.configuration,
                        property: 'fileReplacements',
                    },
                    existingEntries: targetEntries,
                    resultingEntries,
                    effectiveBefore,
                    effectiveAfter,
                },
            };
            operations.push({ ...replacementOperation, id: (0, environment_plan_utils_js_1.operationId)(replacementOperation) });
        }
    }
    const sortedConflicts = conflicts.sort(compareConflicts);
    const blocked = sortedConflicts.length > 0;
    const body = {
        schemaVersion: environment_plan_model_js_1.ENVIRONMENT_PLAN_SCHEMA_VERSION,
        planKind: 'mutation',
        applicability: 'mutation-proposal-only',
        toolVersion: inspection.toolVersion,
        typescriptVersion: inspection.typescriptVersion,
        status: blocked ? 'blocked' : 'ready',
        project: inspection.project,
        proposedDecisions: (0, environment_plan_utils_js_1.mutationDecisions)(),
        decisionApproval: 'pending-consumer-approval',
        inputHashes: blocked
            ? inspection.inputHashes
            : addAbsentDestinationFingerprints(inspection.inputHashes, operations),
        operations: blocked ? [] : operations,
        conflicts: sortedConflicts,
    };
    return (0, environment_plan_utils_js_1.withIntegrity)(body);
}
function findOutputCollision(outputPaths, stack, proposedPaths) {
    let effective;
    for (const layer of [null, ...stack]) {
        const configured = outputPaths.find((entry) => entry.configuration === layer);
        if (configured)
            effective = configured.outputPath;
    }
    if (effective === undefined)
        return undefined;
    const roots = typeof effective === 'string'
        ? [effective]
        : [
            effective['base'],
            ...['browser', 'server', 'media'].map((key) => effective[key] === undefined
                ? undefined
                : `${effective['base'] ?? ''}/${effective[key]}`),
        ].filter((root) => typeof root === 'string' && root.length > 0);
    for (const configuredRoot of roots) {
        const root = configuredRoot.replace(/\\/g, '/').replace(/\/$/, '');
        if (!root || root.split('/').includes('..'))
            return '.';
        for (const proposed of proposedPaths) {
            if (proposed === root || proposed.startsWith(`${root}/`))
                return proposed;
        }
    }
    return undefined;
}
function parentPath(path) {
    const separator = path.lastIndexOf('/');
    return separator < 0 ? '' : path.slice(0, separator);
}
function hasValidBuildMetadata(target) {
    const configurations = [
        target.options,
        ...target.configurations.map((name) => target.configurationsByName[name]),
    ];
    for (const options of configurations) {
        if (!options)
            continue;
        if (options['outputPath'] !== undefined && !isValidOutputPath(options['outputPath']))
            return false;
        const replacements = options['fileReplacements'];
        if (replacements === undefined)
            continue;
        if (!Array.isArray(replacements))
            return false;
        const replaced = new Set();
        for (const replacement of replacements) {
            if (!replacement || typeof replacement !== 'object')
                return false;
            const record = replacement;
            if (Object.keys(record).some((key) => !['replace', 'with'].includes(key)))
                return false;
            if (typeof record['replace'] !== 'string' || typeof record['with'] !== 'string')
                return false;
            if (!/\.(([cm]?[jt])sx?|json)$/.test(record['replace']) ||
                !/\.(([cm]?[jt])sx?|json)$/.test(record['with']))
                return false;
            if (!isSafeWorkspaceFilePath(record['replace']) || !isSafeWorkspaceFilePath(record['with']))
                return false;
            if (replaced.has(record['replace']))
                return false;
            replaced.add(record['replace']);
        }
    }
    return (!target.defaultConfiguration || target.configurations.includes(target.defaultConfiguration));
}
function isValidOutputPath(value) {
    if (typeof value === 'string')
        return true;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const record = value;
    const keys = ['base', 'browser', 'server', 'media'];
    return (Object.keys(record).every((key) => keys.includes(key)) &&
        typeof record['base'] === 'string' &&
        Object.values(record).every((entry) => typeof entry === 'string'));
}
function isSafeWorkspaceFilePath(value) {
    return (!value.startsWith('/') &&
        !/^[a-zA-Z]:/.test(value) &&
        !value.split(/[\\/]/).some((part) => part === '..' || part === '.'));
}
function toPlanProject(project) {
    return {
        name: project.name,
        root: project.root,
        sourceRoot: project.sourceRoot,
        build: project.build ? toPlanTarget(project.build) : undefined,
        serve: project.serve ? toPlanTarget(project.serve) : undefined,
    };
}
function toPlanTarget(target) {
    const configurations = target.configurations.map((configuration) => ({
        name: configuration,
        options: target.configurationsByName[configuration],
    }));
    const outputPaths = [
        toOutputPath(null, target.options['outputPath']),
        ...configurations.map(({ name, options }) => toOutputPath(name, options?.['outputPath'])),
    ].filter((value) => value !== undefined);
    const buildTargetMappings = [
        readBuildTarget(null, target.options),
        ...configurations.map(({ name, options }) => readBuildTarget(name, options)),
    ].filter((value) => value !== undefined);
    const fileReplacementSets = [
        { configuration: null, options: target.options },
        ...configurations.map(({ name, options }) => ({ configuration: name, options })),
    ].map(({ configuration, options }) => ({
        configuration,
        present: !!options && Object.prototype.hasOwnProperty.call(options, 'fileReplacements'),
        entries: readReplacementEntries(options?.['fileReplacements']),
    }));
    const fileReplacements = fileReplacementSets.flatMap(({ configuration, entries }) => entries.map((entry) => ({ configuration, ...entry })));
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
function readBuildTarget(configuration, options) {
    if (!options)
        return undefined;
    const target = options['buildTarget'] ?? options['browserTarget'];
    return typeof target === 'string' ? { configuration, target } : undefined;
}
function toOutputPath(configuration, value) {
    if (typeof value === 'string')
        return { configuration, outputPath: value };
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const outputPath = Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === 'string'));
    return Object.keys(outputPath).length ? { configuration, outputPath } : undefined;
}
function readReplacements(configuration, value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap((entry) => {
        if (!entry ||
            typeof entry !== 'object' ||
            typeof entry['replace'] !== 'string' ||
            typeof entry['with'] !== 'string') {
            return [];
        }
        return [{ configuration, replace: entry['replace'], with: entry['with'] }];
    });
}
function readReplacementEntries(value) {
    return readReplacements(null, value).map(({ replace, with: replacement }) => ({
        replace,
        with: replacement,
    }));
}
function toPlanProperty(property, consumerRoot) {
    return {
        path: property.path,
        type: property.type,
        typeStatus: property.typeStatus,
        valueStatus: property.valueStatus,
        presenceStatus: property.presenceStatus,
        sourceProvenance: {
            ...property.sourceProvenance,
            file: (0, environment_plan_utils_js_1.toRootRelativePath)(consumerRoot, property.sourceProvenance.file) ??
                property.sourceProvenance.file,
        },
        shadowedProvenance: property.shadowedProvenance?.map((location) => ({
            ...location,
            file: (0, environment_plan_utils_js_1.toRootRelativePath)(consumerRoot, location.file) ?? location.file,
        })),
    };
}
function toPlanConflict(diagnostic, consumerRoot) {
    const sourceLocation = diagnostic.sourceLocation;
    const path = diagnostic.path
        ? ((0, environment_plan_utils_js_1.toRootRelativePath)(consumerRoot, diagnostic.path) ??
            ((0, environment_plan_utils_js_1.isCanonicalRelativePath)(diagnostic.path) ? diagnostic.path : undefined))
        : undefined;
    const file = sourceLocation
        ? ((0, environment_plan_utils_js_1.toRootRelativePath)(consumerRoot, sourceLocation.file) ??
            ((0, environment_plan_utils_js_1.isCanonicalRelativePath)(sourceLocation.file) ? sourceLocation.file : undefined))
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
function mergeInputHashes(sourceHashes, workspaceHash) {
    const hashes = new Map();
    for (const item of [...sourceHashes, workspaceHash]) {
        const previous = hashes.get(item.path);
        if (previous !== undefined && previous !== item.sha256) {
            throw new Error('The plan inputs contain inconsistent snapshots for one path.');
        }
        hashes.set(item.path, item.sha256);
    }
    return [...hashes.entries()]
        .map(([path, sha256]) => ({ path, sha256, presence: 'present' }))
        .sort((left, right) => left.path.localeCompare(right.path));
}
function addAbsentDestinationFingerprints(inputHashes, operations) {
    const byPath = new Map(inputHashes.map((fingerprint) => [fingerprint.path, fingerprint]));
    for (const operation of operations) {
        if (operation.kind === 'create-environment-file') {
            byPath.set(operation.path, {
                path: operation.path,
                sha256: (0, environment_plan_utils_js_1.hashText)(environment_plan_utils_js_1.ABSENT_INPUT_SENTINEL),
                presence: 'absent',
            });
        }
    }
    return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}
function compareConflicts(left, right) {
    return (left.code.localeCompare(right.code) ||
        (left.path ?? '').localeCompare(right.path ?? '') ||
        (left.sourceLocation?.file ?? '').localeCompare(right.sourceLocation?.file ?? '') ||
        (left.sourceLocation?.line ?? 0) - (right.sourceLocation?.line ?? 0) ||
        (left.sourceLocation?.column ?? 0) - (right.sourceLocation?.column ?? 0));
}
var environment_plan_validator_js_2 = require("./environment-plan-validator.cjs");
Object.defineProperty(exports, "verifyEnvironmentPlan", { enumerable: true, get: function () { return environment_plan_validator_js_2.verifyEnvironmentPlan; } });
Object.defineProperty(exports, "verifyEnvironmentPlanReview", { enumerable: true, get: function () { return environment_plan_validator_js_2.verifyEnvironmentPlanReview; } });
Object.defineProperty(exports, "verifyEnvironmentPlanEligibility", { enumerable: true, get: function () { return environment_plan_validator_js_2.verifyEnvironmentPlanEligibility; } });
Object.defineProperty(exports, "verifyReadOnlyEnvironmentPlan", { enumerable: true, get: function () { return environment_plan_validator_js_2.verifyReadOnlyEnvironmentPlan; } });
