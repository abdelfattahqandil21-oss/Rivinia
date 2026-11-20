"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = inspect;
const schematics_1 = require("@angular-devkit/schematics");
const inspect_workspace_js_1 = require("./inspect-workspace.cjs");
function inspect(options) {
    return async (tree, context) => {
        const result = await (0, inspect_workspace_js_1.inspectWorkspaceTree)(tree, options.project);
        context.logger.info(JSON.stringify({ plan: result.plan ?? null, diagnostics: result.diagnostics }, null, 2));
        if (!result.plan || result.plan.status === 'blocked') {
            throw new schematics_1.SchematicsException(result.diagnostics.join('\n') || 'ENV_INSPECT_BLOCKED');
        }
        return tree;
    };
}
