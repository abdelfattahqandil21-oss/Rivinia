"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMutationProposalPlan = createMutationProposalPlan;
const schematics_1 = require("@angular-devkit/schematics");
const environment_plan_js_1 = require("./analysis/environment-plan.cjs");
const render_mode_js_1 = require("./analysis/render-mode.cjs");
const inspect_workspace_js_1 = require("./inspect-workspace.cjs");
const reviewed_apply_js_1 = require("./reviewed-apply.cjs");
async function createMutationProposalPlan(tree, project, proposalFile) {
    if (!(0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), proposalFile)) {
        throw new schematics_1.SchematicsException('ENV_PLAN_PATH_INVALID: proposalFile must be inside the non-symlink consumer workspace.');
    }
    let proposalInput;
    try {
        proposalInput = JSON.parse(tree.readText((0, reviewed_apply_js_1.treePath)(proposalFile)));
    }
    catch {
        throw new schematics_1.SchematicsException('ENV_PROPOSAL_FILE_INVALID: proposalFile must be existing JSON with a proposals array.');
    }
    if (!isProposalDocument(proposalInput)) {
        throw new schematics_1.SchematicsException('ENV_PROPOSAL_FILE_INVALID: proposal fields are invalid or unknown.');
    }
    for (const proposal of proposalInput.proposals) {
        for (const path of [proposal.sourcePath, proposal.destinationPath, proposal.replacePath]) {
            if (!(0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), path)) {
                throw new schematics_1.SchematicsException('ENV_PLAN_PATH_INVALID: proposal paths must remain inside the non-symlink consumer workspace.');
            }
        }
    }
    const inspected = await (0, inspect_workspace_js_1.inspectWorkspaceTree)(tree, project);
    if (!inspected.plan || inspected.plan.status !== 'reviewable') {
        throw new schematics_1.SchematicsException(inspected.diagnostics.join('\n') ||
            'ENV_INSPECT_BLOCKED: resolve diagnostics before proposing changes.');
    }
    const unsupportedModes = new Set(proposalInput.proposals.flatMap(({ configurationStack }) => (0, render_mode_js_1.getUnsupportedRenderModes)(inspected.project.build, [configurationStack])));
    if (unsupportedModes.size > 0) {
        throw new schematics_1.SchematicsException(`ENV_RENDER_MODE_UNSUPPORTED: mutation was refused without consumer file changes because the selected effective build configuration enables ${[...unsupportedModes].sort().join(', ')}. Read-only Inspect remains available; SSR/SSG behavior is not verified.`);
    }
    const existingFiles = proposalInput.proposals
        .filter(({ destinationPath }) => tree.exists((0, reviewed_apply_js_1.treePath)(destinationPath)))
        .map(({ destinationPath }) => ({ path: (0, reviewed_apply_js_1.treePath)(destinationPath) }));
    return (0, environment_plan_js_1.createMutationEnvironmentPlan)({
        inspectionPlan: inspected.plan,
        consumerRoot: '/',
        isPathSafe: (_root, relativePath) => (0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), relativePath),
        isReadPathSafe: (_root, relativePath) => (0, reviewed_apply_js_1.isSafeConsumerReadPath)(process.cwd(), relativePath),
        existingFiles,
        otherBuildTargets: inspected.buildTargets,
        proposals: proposalInput.proposals,
    });
}
function isProposalDocument(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const document = value;
    if (Object.keys(document).some((key) => key !== 'proposals') ||
        !Array.isArray(document['proposals'])) {
        return false;
    }
    return document['proposals'].every((candidate) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
            return false;
        const proposal = candidate;
        const allowed = [
            'environment',
            'sourcePath',
            'destinationPath',
            'configuration',
            'configurationStack',
            'replacePath',
        ];
        return (Object.keys(proposal).length === allowed.length &&
            Object.keys(proposal).every((key) => allowed.includes(key)) &&
            ['environment', 'sourcePath', 'destinationPath', 'configuration', 'replacePath'].every((key) => typeof proposal[key] === 'string' && proposal[key].length > 0) &&
            Array.isArray(proposal['configurationStack']) &&
            proposal['configurationStack'].length > 0 &&
            proposal['configurationStack'].every((configuration) => typeof configuration === 'string'));
    });
}
