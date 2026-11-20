"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceDiagnostic = sourceDiagnostic;
exports.typeScriptDiagnostic = typeScriptDiagnostic;
exports.nodeDiagnostic = nodeDiagnostic;
exports.locationOf = locationOf;
exports.joinPath = joinPath;
function sourceDiagnostic(code, file, message, resourceBudget) {
    return {
        code,
        severity: 'error',
        blocking: true,
        sourceLocation: { file },
        message,
        safeAction: 'Correct the TypeScript source and run analysis again.',
        resourceBudget,
    };
}
function typeScriptDiagnostic(code, diagnostic, sourceFile) {
    const location = diagnostic.start === undefined
        ? undefined
        : sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    return {
        code,
        severity: 'error',
        blocking: true,
        sourceLocation: {
            file: sourceFile.fileName,
            line: location ? location.line + 1 : undefined,
            column: location ? location.character + 1 : undefined,
        },
        message: code === 'ENV_ANALYSIS_IMPORT_UNRESOLVED'
            ? 'A referenced TypeScript module or export could not be resolved from supplied analysis inputs.'
            : 'A referenced TypeScript symbol could not be resolved.',
        safeAction: 'Provide the referenced source file or correct the import before continuing.',
    };
}
function nodeDiagnostic(code, node, sourceFile, path, resourceBudget) {
    return {
        code,
        severity: 'error',
        blocking: true,
        path,
        sourceLocation: locationOf(node, sourceFile),
        message: code === 'ENV_ANALYSIS_RESOURCE_LIMIT'
            ? `The object nesting exceeds the configured depth budget of ${resourceBudget?.limit ?? 'the configured limit'}.`
            : diagnosticMessage(code),
        resourceBudget,
        safeAction: code === 'ENV_ANALYSIS_RESOURCE_LIMIT'
            ? `Reduce source nesting below the configured limit (${resourceBudget?.limit ?? 'unknown'}).`
            : 'Review the source expression and use a statically supported object shape.',
    };
}
function locationOf(node, sourceFile) {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { file: sourceFile.fileName, line: location.line + 1, column: location.character + 1 };
}
function joinPath(parent, name) {
    return parent ? `${parent}.${name}` : name;
}
function diagnosticMessage(code) {
    switch (code) {
        case 'ENV_ANALYSIS_DUPLICATE_PROPERTY':
            return 'The object contains a duplicate property name.';
        case 'ENV_ANALYSIS_SPREAD_UNSUPPORTED':
            return 'The object contains a spread whose provenance is not resolved yet.';
        case 'ENV_ANALYSIS_CIRCULAR_SPREAD':
            return 'The object spread graph contains a cycle.';
        case 'ENV_ANALYSIS_IMPORT_UNRESOLVED':
            return 'A referenced TypeScript module or export could not be resolved.';
        case 'ENV_ANALYSIS_SYMBOL_UNRESOLVED':
            return 'A referenced TypeScript symbol could not be resolved.';
        case 'ENV_ANALYSIS_COMPUTED_KEY_UNRESOLVED':
            return 'The computed property name cannot be resolved statically.';
        default:
            return 'The object contains a property form that is not supported yet.';
    }
}
