"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVIRONMENT_MODEL_PLAN_SCHEMA_VERSION = void 0;
exports.createEnvironmentModelPlanV4 = createEnvironmentModelPlanV4;
const environment_plan_utils_js_1 = require("./environment-plan-utils.cjs");
const environment_model_emitter_js_1 = require("./environment-model-emitter.cjs");
exports.ENVIRONMENT_MODEL_PLAN_SCHEMA_VERSION = 4;
const MODEL_GENERATION_DECISION = {
    id: 'model-generation',
    choice: 'create-self-contained-environment-model',
    authority: 'explicit-proposal',
};
function createEnvironmentModelPlanV4(input) {
    const path = `${input.project.sourceRoot}/environment.model.ts`;
    const conflicts = [];
    const sourcePaths = input.sourcePaths.map((value) => (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, value) ?? '');
    const inputPaths = input.inputPaths
        .map((value) => (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, value) ?? '')
        .sort((left, right) => left.localeCompare(right));
    const tsconfigPath = (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, input.tsconfigPath) ?? '';
    const safeProject = typeof input.project.name === 'string' &&
        input.project.name.length > 0 &&
        [input.project.root, input.project.sourceRoot].every(environment_plan_utils_js_1.isCanonicalRelativePath) &&
        (input.project.sourceRoot === input.project.root ||
            input.project.sourceRoot.startsWith(`${input.project.root}/`));
    if (!safeProject ||
        !(0, environment_plan_utils_js_1.isCanonicalRelativePath)(path) ||
        !sourcePaths.length ||
        sourcePaths.some((p) => !(0, environment_plan_utils_js_1.isCanonicalRelativePath)(p)) ||
        new Set(sourcePaths).size !== sourcePaths.length)
        conflicts.push({
            code: 'ENV_MODEL_PATH_INVALID',
            message: 'A selected project or model plan path is unsafe or invalid.',
        });
    if (!(0, environment_plan_utils_js_1.isCanonicalRelativePath)(tsconfigPath) ||
        inputPaths.some((candidate) => !(0, environment_plan_utils_js_1.isCanonicalRelativePath)(candidate)) ||
        new Set(inputPaths).size !== inputPaths.length)
        conflicts.push({
            code: 'ENV_MODEL_INPUT_REQUIRED',
            message: 'A required project, TypeScript, or source input is missing or incomplete.',
        });
    if (!inputPaths.includes('angular.json') ||
        !inputPaths.includes(tsconfigPath) ||
        sourcePaths.some((source) => !inputPaths.includes(source)))
        conflicts.push({
            code: 'ENV_MODEL_INPUT_REQUIRED',
            message: 'A required project, TypeScript, or source input is missing or incomplete.',
        });
    const destinationAbsolute = `${input.consumerRoot.replace(/\/$/, '')}/${path}`;
    const destinationInput = input.currentInputs.find(({ path: file }) => (0, environment_plan_utils_js_1.toRootRelativePath)(input.consumerRoot, file) === path);
    const inputsWithDestination = destinationInput
        ? input.currentInputs
        : [...input.currentInputs, { path: destinationAbsolute, exists: false }];
    const inputHashes = (0, environment_plan_utils_js_1.canonicalInputHashes)(input.consumerRoot, inputsWithDestination);
    if (!inputHashes)
        conflicts.push({
            code: 'ENV_MODEL_INPUT_REQUIRED',
            message: 'A required project, TypeScript, or source input is missing or incomplete.',
        });
    else {
        const fingerprints = new Map(inputHashes.map((item) => [item.path, item]));
        const expectedFingerprintPaths = [...inputPaths, path].sort((left, right) => left.localeCompare(right));
        if ((0, environment_plan_utils_js_1.stableStringify)(inputHashes.map(({ path: itemPath }) => itemPath)) !==
            (0, environment_plan_utils_js_1.stableStringify)(expectedFingerprintPaths))
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
        if (!inputHashes.every(({ path: candidate }) => (0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, candidate)) ||
            !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, path))
            conflicts.push({
                code: 'ENV_MODEL_PATH_INVALID',
                message: 'A selected project or model plan path is unsafe or invalid.',
            });
    }
    let modelText;
    if (input.modelProof?.kind !== 'object') {
        conflicts.push({
            code: 'ENV_MODEL_TYPE_UNPROVEN',
            message: 'A complete bounded Type Proof is required to propose a model.',
        });
    }
    else {
        modelText = (0, environment_model_emitter_js_1.emitEnvironmentModel)(input.modelProof);
    }
    const inspectionBody = {
        schemaVersion: 4,
        planKind: 'inspection',
        applicability: 'model-inspection-only',
        status: conflicts.length ? 'blocked' : 'reviewable',
        toolVersion: input.toolVersion,
        typescriptVersion: input.typescriptVersion,
        project: input.project,
        sourcePaths,
        tsconfigPath,
        inputPaths,
        inputHashes: inputHashes ?? [],
        proofStatus: input.modelProof?.kind === 'object' ? 'proven' : 'blocked',
        conflicts: conflicts.map(({ code, message }) => ({ code, message })),
    };
    const inspectionPlan = {
        ...inspectionBody,
        integrity: { algorithm: 'sha256', digest: (0, environment_plan_utils_js_1.hashText)((0, environment_plan_utils_js_1.stableStringify)(inspectionBody)) },
    };
    const status = conflicts.length ? 'blocked' : 'ready';
    const contentSha256 = modelText ? (0, environment_plan_utils_js_1.hashText)(modelText) : undefined;
    const operationBody = status === 'ready'
        ? {
            order: 0,
            kind: 'create-environment-model-file',
            project: input.project,
            inspectionDigest: inspectionPlan.integrity.digest,
            path,
            sourcePaths,
            tsconfigPath,
            inputPaths,
            requiredInputPath: path,
            expectedContentSha256: contentSha256,
            changePreview: { mode: 'create-if-absent', path, contentSha256: contentSha256 },
        }
        : undefined;
    const operations = operationBody ? [{ ...operationBody, id: (0, environment_plan_utils_js_1.operationId)(operationBody) }] : [];
    const body = {
        schemaVersion: 4,
        planKind: 'mutation',
        applicability: 'model-file-proposal-only',
        status,
        toolVersion: input.toolVersion,
        typescriptVersion: input.typescriptVersion,
        project: input.project,
        inspectionDigest: inspectionPlan.integrity.digest,
        inputHashes: inputHashes ?? [],
        proposedDecisions: [MODEL_GENERATION_DECISION],
        decisionApproval: 'pending-consumer-approval',
        operations,
        conflicts,
    };
    const plan = {
        ...body,
        integrity: { algorithm: 'sha256', digest: (0, environment_plan_utils_js_1.hashText)((0, environment_plan_utils_js_1.stableStringify)(body)) },
    };
    return {
        inspectionPlan,
        plan,
        ...(status === 'ready' && modelText && contentSha256
            ? { preview: { planDigest: plan.integrity.digest, contentSha256, text: modelText } }
            : {}),
    };
}
