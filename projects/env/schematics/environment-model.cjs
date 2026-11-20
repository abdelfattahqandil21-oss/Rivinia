"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = environmentModel;
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const environment_model_plan_v4_apply_js_1 = require("./analysis/environment-model-plan-v4-apply.cjs");
const environment_plan_utils_js_1 = require("./analysis/environment-plan-utils.cjs");
const environment_model_proposal_js_1 = require("./environment-model-proposal.cjs");
const reviewed_apply_js_1 = require("./reviewed-apply.cjs");
function environmentModel(options) {
    return async (tree, context) => {
        const artifactPaths = [options.planFile, options.inspectionPlanFile, options.previewFile];
        if (new Set(artifactPaths).size !== artifactPaths.length ||
            artifactPaths.some((path) => !(0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), path))) {
            throw new schematics_1.SchematicsException('ENV_MODEL_PATH_INVALID: plan, inspection, and preview paths must be distinct safe workspace-relative paths.');
        }
        if (options.mode === 'proposal') {
            if (options.reviewedDigest ||
                options.reviewedPreviewSha256 ||
                options.approveModelGeneration) {
                throw new schematics_1.SchematicsException('ENV_MODEL_OPTIONS_CONFLICT: proposal mode cannot include Apply approval options.');
            }
            if (artifactPaths.some((path) => tree.exists((0, reviewed_apply_js_1.treePath)(path)))) {
                throw new schematics_1.SchematicsException('ENV_MODEL_ARTIFACT_COLLISION: choose new plan, inspection, and preview paths.');
            }
            const proposal = await (0, environment_model_proposal_js_1.createEnvironmentModelProposal)(tree, options.project, (_root, path) => (0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), path));
            const modelPath = proposal.plan.operations[0]?.path;
            if (modelPath &&
                artifactPaths.some((path) => path === modelPath ||
                    path.startsWith(`${modelPath}/`) ||
                    modelPath.startsWith(`${path}/`))) {
                throw new schematics_1.SchematicsException('ENV_MODEL_ARTIFACT_COLLISION: review artifacts cannot overlap the model destination.');
            }
            tree.create((0, reviewed_apply_js_1.treePath)(options.planFile), `${JSON.stringify(proposal.plan, null, 2)}\n`);
            tree.create((0, reviewed_apply_js_1.treePath)(options.inspectionPlanFile), `${JSON.stringify(proposal.inspectionPlan, null, 2)}\n`);
            if (proposal.plan.status === 'blocked') {
                context.logger.error(`ENV_MODEL_PROPOSAL_BLOCKED: ${proposal.plan.conflicts.map(({ code }) => code).join(', ')}`);
            }
            else if (proposal.preview) {
                tree.create((0, reviewed_apply_js_1.treePath)(options.previewFile), proposal.preview.text);
                context.logger.info(`ENV_MODEL_PROPOSAL_READY: ${proposal.plan.integrity.digest}`);
                context.logger.info(`ENV_MODEL_PREVIEW_SHA256: ${proposal.preview.contentSha256}`);
                context.logger.warn('ENV_MODEL_REVIEW_REQUIRED: inspect the local preview and plan, then provide both reviewed digests and explicit model-generation approval to Apply.');
            }
            return tree;
        }
        if (!options.approveModelGeneration ||
            !options.reviewedDigest ||
            !options.reviewedPreviewSha256) {
            throw new schematics_1.SchematicsException('ENV_MODEL_APPROVAL_REQUIRED: Apply requires a reviewed plan digest, reviewed preview SHA-256, and explicit --approve-model-generation.');
        }
        const readJson = (path, code) => {
            const normalized = (0, core_1.normalize)(path);
            if (normalized.startsWith('/') ||
                normalized.split('/').includes('..') ||
                !tree.exists(normalized))
                throw new schematics_1.SchematicsException(`${code}: a required review artifact is missing or unsafe.`);
            try {
                return JSON.parse(tree.readText(normalized));
            }
            catch {
                throw new schematics_1.SchematicsException(`${code}: a required review artifact is not valid JSON.`);
            }
        };
        const plan = readJson(options.planFile, 'ENV_MODEL_PLAN_INVALID');
        const modelPath = plan.operations[0]?.path;
        if (modelPath &&
            artifactPaths.some((path) => path === modelPath ||
                path.startsWith(`${modelPath}/`) ||
                modelPath.startsWith(`${path}/`))) {
            throw new schematics_1.SchematicsException('ENV_MODEL_ARTIFACT_COLLISION: review artifacts cannot overlap the model destination.');
        }
        const inspectionPlan = readJson(options.inspectionPlanFile, 'ENV_MODEL_INSPECTION_INVALID');
        const previewPath = (0, core_1.normalize)(options.previewFile);
        if (previewPath.startsWith('/') ||
            previewPath.split('/').includes('..') ||
            !tree.exists(previewPath))
            throw new schematics_1.SchematicsException('ENV_MODEL_PREVIEW_INVALID: the reviewed local preview is missing.');
        const previewText = tree.readText(previewPath);
        if ((0, environment_plan_utils_js_1.hashText)(previewText) !== options.reviewedPreviewSha256)
            throw new schematics_1.SchematicsException('ENV_MODEL_PREVIEW_REVIEW_MISMATCH: the local preview changed.');
        const applied = await (0, environment_model_plan_v4_apply_js_1.applyEnvironmentModelPlanV4ToTree)({
            tree,
            plan,
            inspectionPlan,
            reviewedPlanDigest: options.reviewedDigest,
            approval: {
                reviewedPlanDigest: options.reviewedDigest,
                reviewedPreviewSha256: options.reviewedPreviewSha256,
                acceptedDecisionIds: ['model-generation'],
            },
            consumerRoot: '/',
            isPathSafe: (_root, path) => (0, reviewed_apply_js_1.isSafeConsumerPath)(process.cwd(), path),
        });
        if (!applied.ok)
            throw new schematics_1.SchematicsException(`${applied.code}: reviewed model Apply was rejected.`);
        context.logger.info(`ENV_MODEL_CREATED: ${applied.path} sha256=${applied.contentSha256}`);
        return applied.tree;
    };
}
