"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveEnvironmentModel = deriveEnvironmentModel;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const environment_object_analysis_js_1 = require("./environment-object-analysis.cjs");
const environment_model_emitter_js_1 = require("./environment-model-emitter.cjs");
const environment_model_proof_js_1 = require("./environment-model-proof.cjs");
/** Derive a self-contained shared model from every selected environment or fail closed. */
function deriveEnvironmentModel(program, sourceFiles) {
    if (sourceFiles.length === 0)
        return blocked('', 'ENV_MODEL_TYPE_UNPROVEN');
    const checker = program.getTypeChecker();
    let common;
    for (const fileName of sourceFiles) {
        const sourceFile = program.getSourceFile(fileName);
        const declaration = sourceFile && (0, environment_object_analysis_js_1.findEnvironmentDeclaration)(sourceFile);
        if (!sourceFile || !declaration?.name || !typescript_1.default.isIdentifier(declaration.name))
            return blocked(fileName, 'ENV_MODEL_TYPE_UNPROVEN');
        const result = (0, environment_model_proof_js_1.proveModelType)(checker.getTypeAtLocation(declaration.name), checker);
        if (!result.proof || result.proof.kind !== 'object')
            return blocked(fileName, 'ENV_MODEL_TYPE_UNPROVEN');
        if (common && (0, environment_model_proof_js_1.proofKey)(common) !== (0, environment_model_proof_js_1.proofKey)(result.proof))
            return blocked(fileName, 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE');
        common = result.proof;
    }
    return common
        ? { proof: common, modelText: (0, environment_model_emitter_js_1.emitEnvironmentModel)(common) }
        : blocked('', 'ENV_MODEL_TYPE_UNPROVEN');
}
function blocked(file, code) {
    return {
        diagnostic: {
            code,
            sourceLocation: { file },
            message: code === 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE'
                ? 'Selected environments do not satisfy one provable shared model.'
                : 'The selected environment type is outside the bounded model-emission subset.',
        },
    };
}
