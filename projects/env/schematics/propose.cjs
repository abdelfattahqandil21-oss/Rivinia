"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = propose;
const schematics_1 = require("@angular-devkit/schematics");
const mutation_proposal_js_1 = require("./mutation-proposal.cjs");
const reviewed_apply_js_1 = require("./reviewed-apply.cjs");
function propose(options) {
    return async (tree, context) => {
        if (!(0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), options.planFile)) {
            throw new schematics_1.SchematicsException('ENV_PLAN_PATH_INVALID: planFile must be inside the non-symlink consumer workspace.');
        }
        if (options.proposalFile === options.planFile || tree.exists((0, reviewed_apply_js_1.treePath)(options.planFile))) {
            throw new schematics_1.SchematicsException('ENV_PLAN_FILE_COLLISION: choose a new explicit planFile that does not already exist.');
        }
        const plan = await (0, mutation_proposal_js_1.createMutationProposalPlan)(tree, options.project, options.proposalFile);
        try {
            tree.create((0, reviewed_apply_js_1.treePath)(options.planFile), `${JSON.stringify(plan, null, 2)}\n`);
        }
        catch {
            throw new schematics_1.SchematicsException('ENV_PLAN_FILE_WRITE_FAILED: the explicit plan path is not writable.');
        }
        context.logger.info(JSON.stringify({ plan, diagnostics: plan.conflicts }, null, 2));
        if (plan.status === 'blocked') {
            context.logger.error('ENV_PLAN_PROPOSAL_BLOCKED: review the conflicts; Apply will reject this plan.');
        }
        else {
            context.logger.warn('ENV_PLAN_REVIEW_REQUIRED: inspect the plan and selected source files, then approve its digest and explicit decisions before Apply.');
        }
        return tree;
    };
}
