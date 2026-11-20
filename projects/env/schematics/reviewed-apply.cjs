"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyReviewedPlan = applyReviewedPlan;
exports.isSafeConsumerPath = isSafeConsumerPath;
exports.isSafeConsumerReadPath = isSafeConsumerReadPath;
exports.treePath = treePath;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const schematics_1 = require("@angular-devkit/schematics");
const environment_plan_apply_js_1 = require("./analysis/environment-plan-apply.cjs");
const environment_plan_utils_js_1 = require("./analysis/environment-plan-utils.cjs");
const render_mode_js_1 = require("./analysis/render-mode.cjs");
const output_paths_js_1 = require("./analysis/output-paths.cjs");
const workspace_discovery_js_1 = require("./analysis/workspace-discovery.cjs");
const tree_workspace_host_js_1 = require("./tree-workspace-host.cjs");
async function applyReviewedPlan(tree, context, options) {
    if (options.force) {
        throw new schematics_1.SchematicsException('ENV_FORCE_UNSUPPORTED: --force never bypasses reviewed-plan, ownership, or path-safety checks.');
    }
    if (!isSafePlanFile(tree, options.planFile)) {
        throw new schematics_1.SchematicsException('ENV_PLAN_FILE_INVALID: use an existing canonical workspace-relative plan path.');
    }
    let plan;
    try {
        const parsed = JSON.parse(tree.readText(treePath(options.planFile)));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('Invalid plan object.');
        plan = parsed;
    }
    catch {
        throw new schematics_1.SchematicsException('ENV_PLAN_FILE_INVALID: the plan is not valid JSON.');
    }
    if (plan.planKind !== 'mutation') {
        throw new schematics_1.SchematicsException('ENV_PLAN_NOT_MUTATION: inspect-only plans cannot be applied.');
    }
    if (options.project && options.project !== plan.project.name) {
        throw new schematics_1.SchematicsException('ENV_APPLY_PROJECT_MISMATCH: the reviewed plan selects another project.');
    }
    const discovered = await (0, workspace_discovery_js_1.discoverWorkspace)((0, tree_workspace_host_js_1.createTreeWorkspaceHost)(tree), {
        projectName: plan.project.name,
    });
    if (!discovered.ok) {
        throw new schematics_1.SchematicsException(`${discovered.diagnostics.map(({ code }) => code).join(', ')}: current workspace cannot be safely verified for Apply.`);
    }
    const effectiveStacks = plan.operations
        .filter((operation) => operation.kind === 'add-file-replacement' ||
        operation.kind === 'confirm-file-replacement-present')
        .map(({ configurationStack }) => configurationStack);
    const unsupportedModes = new Set(effectiveStacks.flatMap((stack) => (0, render_mode_js_1.getUnsupportedRenderModes)(discovered.project.build, [stack])));
    if (unsupportedModes.size > 0) {
        throw new schematics_1.SchematicsException(`ENV_RENDER_MODE_UNSUPPORTED: reviewed mutation was refused without consumer file changes because the current effective build configuration enables ${[...unsupportedModes].sort().join(', ')}. Read-only Inspect remains available; SSR/SSG behavior is not verified.`);
    }
    for (const operation of plan.operations) {
        if (operation.kind !== 'add-file-replacement' &&
            operation.kind !== 'confirm-file-replacement-present')
            continue;
        const selectedOutput = (0, output_paths_js_1.findEffectiveOutputPathCollision)(discovered.project.build, operation.configurationStack, operation.with);
        const otherOutput = (0, output_paths_js_1.findOtherProjectOutputPathCollision)(discovered.buildTargets, plan.project.name, operation.with);
        if (selectedOutput.kind !== 'none' || otherOutput.kind !== 'none') {
            const outputPath = selectedOutput.kind === 'collision' || otherOutput.kind === 'collision'
                ? selectedOutput.kind === 'collision'
                    ? selectedOutput.path
                    : otherOutput.kind === 'collision'
                        ? otherOutput.path
                        : operation.with
                : operation.with;
            throw new schematics_1.SchematicsException(`${selectedOutput.kind === 'collision' || otherOutput.kind === 'collision' ? 'ENV_PLAN_OUTPUT_COLLISION' : 'ENV_PLAN_OUTPUT_PATH_UNVERIFIED'}: current build output paths conflict with or cannot be classified against the reviewed generated destination ${outputPath}; no consumer files were changed.`);
        }
    }
    const acceptedDecisionIds = [
        ...(options.acceptConfigurationMapping ? ['configuration-mapping'] : []),
        ...(options.acceptEnvironmentSemantics ? ['environment-semantics'] : []),
    ];
    const result = await (0, environment_plan_apply_js_1.applyEnvironmentPlanToTree)({
        tree,
        plan: plan,
        approval: { reviewedDigest: options.reviewedDigest, acceptedDecisionIds },
        consumerRoot: '/',
        isPathSafe: (_root, relativePath) => isSafeConsumerPath(process.cwd(), relativePath),
        isReadPathSafe: (_root, relativePath) => isSafeConsumerReadPath(process.cwd(), relativePath),
    });
    if (!result.ok) {
        throw new schematics_1.SchematicsException(`${result.code}: reviewed environment changes were not applied.`);
    }
    const created = plan.operations.filter(({ kind }) => kind === 'create-environment-file').length;
    const replacements = plan.operations.filter(({ kind }) => kind === 'add-file-replacement').length;
    context.logger.info(`ENV_FILE_CREATION_${created ? 'SUCCESS' : 'NOOP'}: ${created} file(s).`);
    context.logger.info(`ENV_CONFIGURATION_WIRING_${replacements ? 'SUCCESS' : 'NOOP'}: ${replacements} replacement(s).`);
    context.logger.warn(created || replacements
        ? 'ENVIRONMENT_VALUES_CONSUMER_APPROVED_UNVERIFIED: the consumer selected and approved these source files; values were preserved verbatim, and the schematic does not claim runtime semantic correctness.'
        : 'ENVIRONMENT_VALUES_UNVERIFIED_NOOP: existing environment selections were preserved; runtime semantic correctness is not verified.');
    return result.tree;
}
function isSafePlanFile(tree, path) {
    return ((0, environment_plan_utils_js_1.isCanonicalRelativePath)(path) &&
        tree.exists(treePath(path)) &&
        isSafeConsumerPath(process.cwd(), path));
}
function isSafeConsumerPath(root, path) {
    if (!(0, environment_plan_utils_js_1.isCanonicalRelativePath)(path))
        return false;
    const consumerRoot = (0, node_path_1.resolve)(root);
    let realRoot;
    try {
        realRoot = (0, node_fs_1.realpathSync)(consumerRoot);
    }
    catch {
        return false;
    }
    if (realRoot !== consumerRoot || !(0, node_fs_1.existsSync)((0, node_path_1.join)(consumerRoot, 'angular.json')))
        return false;
    const target = (0, node_path_1.resolve)(consumerRoot, ...path.split('/'));
    const relativeTarget = (0, node_path_1.relative)(consumerRoot, target);
    if (!relativeTarget ||
        relativeTarget === '..' ||
        relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
        (0, node_path_1.isAbsolute)(relativeTarget)) {
        return false;
    }
    let current = consumerRoot;
    for (const segment of relativeTarget.split(/[\\/]/)) {
        current = (0, node_path_1.join)(current, segment);
        try {
            if ((0, node_fs_1.lstatSync)(current).isSymbolicLink())
                return false;
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return true;
            return false;
        }
    }
    return true;
}
/** Allows read-only inputs reached through symlinks that resolve inside the workspace. */
function isSafeConsumerReadPath(root, path) {
    if (!(0, environment_plan_utils_js_1.isCanonicalRelativePath)(path))
        return false;
    const consumerRoot = (0, node_path_1.resolve)(root);
    let realRoot;
    try {
        realRoot = (0, node_fs_1.realpathSync)(consumerRoot);
    }
    catch {
        return false;
    }
    if (realRoot !== consumerRoot || !(0, node_fs_1.existsSync)((0, node_path_1.join)(consumerRoot, 'angular.json')))
        return false;
    const relativeTarget = (0, node_path_1.relative)(consumerRoot, (0, node_path_1.resolve)(consumerRoot, ...path.split('/')));
    if (!relativeTarget ||
        relativeTarget === '..' ||
        relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
        (0, node_path_1.isAbsolute)(relativeTarget)) {
        return false;
    }
    let current = consumerRoot;
    for (const segment of relativeTarget.split(/[\\/]/)) {
        current = (0, node_path_1.join)(current, segment);
        try {
            if ((0, node_fs_1.lstatSync)(current).isSymbolicLink()) {
                const realTarget = (0, node_fs_1.realpathSync)(current);
                const relativeRealTarget = (0, node_path_1.relative)(realRoot, realTarget);
                if (!relativeRealTarget ||
                    relativeRealTarget === '..' ||
                    relativeRealTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
                    (0, node_path_1.isAbsolute)(relativeRealTarget)) {
                    return false;
                }
            }
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return true;
            return false;
        }
    }
    return true;
}
function treePath(path) {
    return `/${path}`;
}
