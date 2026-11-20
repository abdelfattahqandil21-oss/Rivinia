"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validatePlan;
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const environment_plan_js_1 = require("./analysis/environment-plan.cjs");
function validatePlan(options) {
    return (tree, context) => {
        const path = (0, core_1.normalize)(options.plan);
        if (path.startsWith('/') || path.split('/').includes('..') || !tree.exists(path)) {
            throw new schematics_1.SchematicsException('ENV_PLAN_FILE_INVALID: provide an existing workspace-relative plan file.');
        }
        let plan;
        try {
            plan = tree.readJson(path);
        }
        catch {
            throw new schematics_1.SchematicsException('ENV_PLAN_FILE_INVALID: the plan file is not valid JSON.');
        }
        const verification = (0, environment_plan_js_1.verifyEnvironmentPlanReview)(plan, options.reviewedDigest);
        if (!verification.ok) {
            throw new schematics_1.SchematicsException(`${verification.code}: the reviewed plan was rejected.`);
        }
        context.logger.info(`ENV_PLAN_REVIEW_VALID: ${plan.integrity.digest}`);
        return tree;
    };
}
