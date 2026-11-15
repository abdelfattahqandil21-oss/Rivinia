"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeEnvironmentSources = analyzeEnvironmentSources;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const analysis_diagnostics_js_1 = require("./analysis-diagnostics.cjs");
const environment_object_analysis_js_1 = require("./environment-object-analysis.cjs");
const type_reconciliation_js_1 = require("./type-reconciliation.cjs");
const typescript_project_program_js_1 = require("./typescript-project-program.cjs");
const DEFAULT_MAX_SOURCES = 128;
const DEFAULT_MAX_SOURCE_BYTES = 8_388_608;
const DEFAULT_MAX_NESTING_DEPTH = 64;
const DEFAULT_MAX_TYPE_DEPTH = 8;
function analyzeEnvironmentSources(inputs, options = {}) {
    const maxSources = options.maxSources ?? DEFAULT_MAX_SOURCES;
    const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
    const maxNestingDepth = options.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;
    const maxTypeDepth = options.maxTypeDepth ?? DEFAULT_MAX_TYPE_DEPTH;
    const sourceBytes = inputs.reduce((total, input) => total + new TextEncoder().encode(input.sourceText).byteLength, 0);
    if (inputs.length > maxSources) {
        return {
            environments: [],
            fields: [],
            diagnostics: [
                (0, analysis_diagnostics_js_1.sourceDiagnostic)('ENV_ANALYSIS_RESOURCE_LIMIT', inputs[0]?.fileName ?? '', `The supplied source count exceeds the configured limit of ${maxSources}.`, { kind: 'source-count', limit: maxSources }),
            ],
            influencingFileHashes: [],
        };
    }
    if (sourceBytes > maxSourceBytes) {
        return {
            environments: [],
            fields: [],
            diagnostics: [
                (0, analysis_diagnostics_js_1.sourceDiagnostic)('ENV_ANALYSIS_RESOURCE_LIMIT', inputs[0]?.fileName ?? '', `The supplied source bytes exceed the configured limit of ${maxSourceBytes}.`, { kind: 'source-bytes', limit: maxSourceBytes }),
            ],
            influencingFileHashes: [],
        };
    }
    const programResult = (0, typescript_project_program_js_1.createAnalysisProgram)(inputs, options, maxSources, maxSourceBytes);
    if (!programResult.program) {
        return {
            environments: [],
            fields: [],
            diagnostics: [...programResult.diagnostics],
            influencingFileHashes: [],
        };
    }
    const program = programResult.program;
    const roots = inputs.filter((input) => input.kind !== 'dependency');
    const checker = program.getTypeChecker();
    const diagnostics = [];
    const environments = [];
    for (const input of roots) {
        const fileName = canonicalFileName(input.fileName);
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile || program.getSyntacticDiagnostics(sourceFile).length > 0) {
            diagnostics.push((0, analysis_diagnostics_js_1.sourceDiagnostic)('ENV_ANALYSIS_SOURCE_INVALID', input.fileName, 'A source file is missing or has invalid TypeScript syntax.'));
            continue;
        }
        for (const semanticDiagnostic of program.getSemanticDiagnostics(sourceFile)) {
            const code = semanticDiagnostic.code === 2307 || semanticDiagnostic.code === 2305
                ? 'ENV_ANALYSIS_IMPORT_UNRESOLVED'
                : semanticDiagnostic.code === 2304 || semanticDiagnostic.code === 2552
                    ? 'ENV_ANALYSIS_SYMBOL_UNRESOLVED'
                    : undefined;
            if (code)
                diagnostics.push((0, analysis_diagnostics_js_1.typeScriptDiagnostic)(code, semanticDiagnostic, sourceFile));
        }
        const declaration = (0, environment_object_analysis_js_1.findEnvironmentDeclaration)(sourceFile);
        if (!declaration?.initializer ||
            !typescript_1.default.isObjectLiteralExpression(unwrap(declaration.initializer))) {
            diagnostics.push((0, analysis_diagnostics_js_1.sourceDiagnostic)('ENV_ANALYSIS_ROOT_UNSUPPORTED', input.fileName, 'The environment export must be initialized by a static object literal.'));
            continue;
        }
        const analysis = (0, environment_object_analysis_js_1.analyzeEnvironmentObject)(unwrap(declaration.initializer), sourceFile, checker, maxNestingDepth, maxTypeDepth);
        environments.push({
            name: input.name,
            fileName: input.fileName,
            properties: analysis.properties,
            transferSafety: assessTransferSafety(sourceFile, declaration, analysis.properties),
        });
        diagnostics.push(...analysis.diagnostics);
    }
    const reconciliation = (0, type_reconciliation_js_1.reconcileEnvironmentTypes)(environments, maxTypeDepth);
    const allDiagnostics = [...diagnostics, ...reconciliation.diagnostics];
    const influencingFileHashes = programResult.getInfluencingFileHashes();
    if (allDiagnostics.some((diagnostic) => diagnostic.code === 'ENV_ANALYSIS_RESOURCE_LIMIT' ||
        diagnostic.code === 'ENV_ANALYSIS_IMPORT_UNRESOLVED' ||
        diagnostic.code === 'ENV_ANALYSIS_SYMBOL_UNRESOLVED')) {
        return { environments: [], fields: [], diagnostics: allDiagnostics, influencingFileHashes };
    }
    return {
        environments,
        fields: reconciliation.fields,
        diagnostics: allDiagnostics,
        influencingFileHashes,
    };
}
function assessTransferSafety(sourceFile, environmentDeclaration, properties) {
    if (properties.some(({ valueStatus }) => valueStatus !== 'static')) {
        return {
            strategy: 'verbatim-sibling-copy',
            status: 'blocked',
            reason: 'dynamic-environment-value',
        };
    }
    let hasModuleLocationReference = false;
    const visit = (node) => {
        if ((typescript_1.default.isMetaProperty(node) &&
            node.keywordToken === typescript_1.default.SyntaxKind.ImportKeyword &&
            node.name.text === 'meta') ||
            (typescript_1.default.isIdentifier(node) && ['__filename', '__dirname'].includes(node.text))) {
            hasModuleLocationReference = true;
        }
        typescript_1.default.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (hasModuleLocationReference) {
        return {
            strategy: 'verbatim-sibling-copy',
            status: 'blocked',
            reason: 'module-location-reference',
        };
    }
    const supported = sourceFile.statements.every((statement) => {
        if (typescript_1.default.isImportDeclaration(statement) ||
            typescript_1.default.isExportDeclaration(statement) ||
            typescript_1.default.isInterfaceDeclaration(statement) ||
            typescript_1.default.isTypeAliasDeclaration(statement) ||
            typescript_1.default.isEmptyStatement(statement))
            return true;
        if (typescript_1.default.isVariableStatement(statement)) {
            return (statement.declarationList.declarations.length === 1 &&
                statement.declarationList.declarations[0] === environmentDeclaration);
        }
        return ('modifiers' in statement &&
            Array.isArray(statement.modifiers) &&
            statement.modifiers.some((modifier) => modifier.kind === typescript_1.default.SyntaxKind.DeclareKeyword));
    });
    return supported
        ? { strategy: 'verbatim-sibling-copy', status: 'safe' }
        : {
            strategy: 'verbatim-sibling-copy',
            status: 'blocked',
            reason: 'unsupported-top-level-effect',
        };
}
function unwrap(expression) {
    while (typescript_1.default.isParenthesizedExpression(expression) ||
        typescript_1.default.isAsExpression(expression) ||
        typescript_1.default.isTypeAssertionExpression(expression) ||
        typescript_1.default.isSatisfiesExpression(expression) ||
        typescript_1.default.isNonNullExpression(expression)) {
        expression = expression.expression;
    }
    return expression;
}
function canonicalFileName(fileName) {
    return fileName.replaceAll('\\', '/');
}
