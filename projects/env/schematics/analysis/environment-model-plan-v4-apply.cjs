"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyEnvironmentModelPlanV4ToTree = applyEnvironmentModelPlanV4ToTree;
const tslib_1 = require("tslib");
const node_crypto_1 = require("node:crypto");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const core_1 = require("@angular-devkit/core");
const workspace_discovery_js_1 = require("./workspace-discovery.cjs");
const output_paths_js_1 = require("./output-paths.cjs");
const typescript_project_program_js_1 = require("./typescript-project-program.cjs");
const tree_workspace_host_js_1 = require("../tree-workspace-host.cjs");
const environment_model_js_1 = require("./environment-model.cjs");
const environment_model_plan_v4_validator_js_1 = require("./environment-model-plan-v4-validator.cjs");
const environment_plan_utils_js_1 = require("./environment-plan-utils.cjs");
const MAX_MODEL_ANALYSIS_SOURCES = 128;
const MAX_MODEL_ANALYSIS_BYTES = 8_388_608;
/**
 * Re-derives the model from the current virtual consumer snapshot, then creates it on a private
 * Tree branch. The caller receives that branch only after all byte and ownership postconditions pass.
 */
async function applyEnvironmentModelPlanV4ToTree(input) {
    const structure = (0, environment_model_plan_v4_validator_js_1.validateEnvironmentModelPlanV4)(input.plan);
    if (!structure.ok)
        return structure;
    const plan = input.plan;
    if (input.reviewedPlanDigest !== plan.integrity.digest)
        return { ok: false, code: 'ENV_MODEL_REVIEW_MISMATCH' };
    if (plan.status !== 'ready')
        return { ok: false, code: 'ENV_MODEL_PLAN_BLOCKED' };
    const operation = plan.operations[0];
    const expectedPath = `${plan.project.sourceRoot}/environment.model.ts`;
    if (operation.path !== expectedPath ||
        operation.project.name !== plan.project.name ||
        operation.project.root !== plan.project.root ||
        operation.project.sourceRoot !== plan.project.sourceRoot ||
        operation.sourcePaths.some((path) => path !== plan.project.sourceRoot && !path.startsWith(`${plan.project.sourceRoot}/`)))
        return { ok: false, code: 'ENV_MODEL_APPLY_PROJECT_MISMATCH' };
    if (plan.typescriptVersion !== typescript_1.default.version)
        return { ok: false, code: 'ENV_MODEL_APPLY_TYPESCRIPT_MISMATCH' };
    if (!plan.inputHashes.every(({ path }) => (0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, path)) ||
        !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, operation.path))
        return { ok: false, code: 'ENV_MODEL_PATH_INVALID' };
    let currentInputs;
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
    }
    catch {
        return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
    }
    if (operation.requiredInputPath !== operation.path ||
        input.tree.exists(toTreePath(operation.path)))
        return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
    const workspace = await (0, workspace_discovery_js_1.discoverWorkspace)((0, tree_workspace_host_js_1.createTreeWorkspaceHost)(input.tree), {
        projectName: plan.project.name,
    });
    if (!workspace.ok ||
        workspace.project.root !== plan.project.root ||
        workspace.project.sourceRoot !== plan.project.sourceRoot)
        return { ok: false, code: 'ENV_MODEL_APPLY_PROJECT_MISMATCH' };
    const outputCollision = findOutputCollision(workspace.project.build, workspace.buildTargets, plan.project.name, operation.path);
    if (outputCollision !== 'none')
        return { ok: false, code: 'ENV_MODEL_APPLY_OUTPUT_COLLISION' };
    const rederivedModelText = deriveModelFromTree(input.tree, plan, input.consumerRoot);
    if (rederivedModelText === undefined)
        return { ok: false, code: 'ENV_MODEL_APPLY_PROOF_UNAVAILABLE' };
    const eligibility = (0, environment_model_plan_v4_validator_js_1.verifyEnvironmentModelPlanV4)(plan, input.inspectionPlan, input.approval, input.consumerRoot, currentInputs, input.isPathSafe, rederivedModelText);
    if (!eligibility.ok)
        return eligibility;
    if (input.reviewedPlanDigest !== plan.integrity.digest)
        return { ok: false, code: 'ENV_MODEL_REVIEW_MISMATCH' };
    const initialSnapshot = snapshotTree(input.tree);
    if (!initialSnapshot)
        return { ok: false, code: 'ENV_MODEL_APPLY_OPERATION_FAILED' };
    try {
        const staged = input.tree.branch();
        const destination = toTreePath(operation.path);
        if (staged.exists(destination))
            return { ok: false, code: 'ENV_MODEL_INPUTS_STALE' };
        staged.create(destination, rederivedModelText);
        if (!verifyStagedTree(input.tree, staged, initialSnapshot, destination, rederivedModelText, operation.expectedContentSha256) ||
            !(0, environment_plan_utils_js_1.isPathSafeSafely)(input.isPathSafe, input.consumerRoot, operation.path))
            return { ok: false, code: 'ENV_MODEL_APPLY_POSTCONDITION_FAILED' };
        return {
            ok: true,
            tree: staged,
            path: operation.path,
            contentSha256: operation.expectedContentSha256,
        };
    }
    catch {
        return { ok: false, code: 'ENV_MODEL_APPLY_OPERATION_FAILED' };
    }
}
function deriveModelFromTree(tree, plan, consumerRoot) {
    const operation = plan.operations[0];
    let inputs;
    try {
        inputs = operation.sourcePaths.map((path) => ({
            name: path,
            fileName: absoluteInputPath(consumerRoot, path),
            sourceText: tree.readText(toTreePath(path)),
            kind: 'environment',
        }));
    }
    catch {
        return undefined;
    }
    const project = {
        rootDirectory: consumerRoot,
        tsconfigFileName: absoluteInputPath(consumerRoot, operation.tsconfigPath),
        readFile: (absolutePath) => {
            const relativePath = toRootRelativePath(consumerRoot, absolutePath);
            if (!relativePath || !isCanonicalTreePath(relativePath))
                return undefined;
            const path = toTreePath(relativePath);
            return tree.exists(path) ? tree.readText(path) : undefined;
        },
    };
    const analysis = (0, typescript_project_program_js_1.createAnalysisProgram)(inputs, { project }, MAX_MODEL_ANALYSIS_SOURCES, MAX_MODEL_ANALYSIS_BYTES);
    if (!analysis.program || analysis.diagnostics.length > 0)
        return undefined;
    const model = (0, environment_model_js_1.deriveEnvironmentModel)(analysis.program, operation.sourcePaths.map((path) => absoluteInputPath(consumerRoot, path)));
    return model.modelText;
}
function findOutputCollision(selectedTarget, targets, selectedProject, destination) {
    if (!selectedTarget)
        return 'unknown';
    for (const stack of [[], ...selectedTarget.configurations.map((name) => [name])]) {
        const result = (0, output_paths_js_1.findEffectiveOutputPathCollision)(selectedTarget, stack, destination);
        if (result.kind !== 'none')
            return result.kind;
    }
    const others = (0, output_paths_js_1.findOtherProjectOutputPathCollision)(targets, selectedProject, destination);
    return others.kind;
}
function snapshotTree(tree) {
    const result = new Map();
    try {
        for (const path of treePaths(tree)) {
            const contents = tree.read(path);
            if (!contents)
                return undefined;
            result.set(path, Uint8Array.from(contents));
        }
        return result;
    }
    catch {
        return undefined;
    }
}
function verifyStagedTree(original, staged, before, destination, expectedText, expectedSha256) {
    const expectedFiles = new Set([...before.keys(), destination]);
    const stagedFiles = new Set(treePaths(staged));
    if (stagedFiles.size !== expectedFiles.size ||
        [...expectedFiles].some((path) => !stagedFiles.has(path)) ||
        original.exists(destination))
        return false;
    for (const [path, bytes] of before) {
        const current = staged.read(path);
        if (!current || !equalBytes(current, bytes))
            return false;
    }
    const created = staged.read(destination);
    const expectedBytes = new TextEncoder().encode(expectedText);
    return (!!created &&
        equalBytes(created, expectedBytes) &&
        (0, node_crypto_1.createHash)('sha256').update(created).digest('hex') === expectedSha256);
}
function treePaths(tree) {
    const paths = [];
    tree.visit((path) => paths.push(path));
    return paths;
}
function equalBytes(left, right) {
    return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
function isCanonicalTreePath(path) {
    return (!!path &&
        !path.startsWith('/') &&
        !path.split('/').some((segment) => !segment || segment === '.' || segment === '..'));
}
function toTreePath(relativePath) {
    return (0, core_1.normalize)(`/${relativePath}`);
}
function absoluteInputPath(root, relativePath) {
    return `${root.replace(/[\\/]+$/, '')}/${relativePath}`;
}
function toRootRelativePath(root, absolutePath) {
    const canonicalRoot = root.replace(/[\\/]+$/, '') || '/';
    const normalized = absolutePath.replaceAll('\\', '/');
    if (!normalized.startsWith(`${canonicalRoot.replace(/\/$/, '')}/`))
        return undefined;
    return normalized.slice(canonicalRoot.replace(/\/$/, '').length + 1);
}
