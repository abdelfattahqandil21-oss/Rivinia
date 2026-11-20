"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEnvironmentDeclaration = findEnvironmentDeclaration;
exports.analyzeEnvironmentObject = analyzeEnvironmentObject;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const analysis_diagnostics_js_1 = require("./analysis-diagnostics.cjs");
const typescript_type_description_js_1 = require("./typescript-type-description.cjs");
function findEnvironmentDeclaration(sourceFile) {
    for (const statement of sourceFile.statements) {
        if (!typescript_1.default.isVariableStatement(statement) ||
            !statement.modifiers?.some((modifier) => modifier.kind === typescript_1.default.SyntaxKind.ExportKeyword)) {
            continue;
        }
        const declaration = statement.declarationList.declarations.find((candidate) => typescript_1.default.isIdentifier(candidate.name) && candidate.name.text === 'environment');
        if (declaration)
            return declaration;
    }
    return undefined;
}
function analyzeEnvironmentObject(object, sourceFile, checker, maxNestingDepth, maxTypeDepth) {
    const properties = [];
    const diagnostics = [];
    collectProperties(object, '', sourceFile, checker, properties, diagnostics, new Set(), maxNestingDepth, maxTypeDepth);
    properties.sort((left, right) => left.path.localeCompare(right.path));
    return { properties, diagnostics };
}
function collectProperties(object, parentPath, sourceFile, checker, output, diagnostics, spreadStack, maxNestingDepth, maxTypeDepth, depth = 0) {
    if (depth > maxNestingDepth) {
        diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_RESOURCE_LIMIT', object, sourceFile, parentPath, {
            kind: 'object-depth',
            limit: maxNestingDepth,
        }));
        return;
    }
    const entries = resolveObjectEntries(object, sourceFile, checker, diagnostics, new Set(spreadStack).add(object), parentPath, maxNestingDepth, depth);
    for (const [name, entry] of entries) {
        const path = (0, analysis_diagnostics_js_1.joinPath)(parentPath, name);
        const initializer = unwrap(entry.initializer);
        const inferredType = checker.getTypeAtLocation(entry.initializer);
        const analyzedType = (0, typescript_type_description_js_1.describeType)(inferredType, checker, 0, new Set(), maxTypeDepth);
        output.push({
            path,
            type: analyzedType,
            typeStatus: inferredType.flags & (typescript_1.default.TypeFlags.Any | typescript_1.default.TypeFlags.Unknown) ||
                (0, typescript_type_description_js_1.containsUnknownType)(analyzedType)
                ? 'unknown'
                : 'known',
            valueStatus: isStaticExpression(initializer),
            presenceStatus: 'present',
            sourceProvenance: (0, analysis_diagnostics_js_1.locationOf)(entry.node.name, entry.sourceFile),
            shadowedProvenance: entry.shadowed.length ? entry.shadowed : undefined,
        });
        if (typescript_1.default.isObjectLiteralExpression(initializer)) {
            collectProperties(initializer, path, entry.sourceFile, checker, output, diagnostics, spreadStack, maxNestingDepth, maxTypeDepth, depth + 1);
        }
    }
}
function resolveObjectEntries(object, sourceFile, checker, diagnostics, spreadStack, parentPath, maxNestingDepth, depth) {
    if (depth > maxNestingDepth) {
        diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_RESOURCE_LIMIT', object, sourceFile, parentPath, {
            kind: 'object-depth',
            limit: maxNestingDepth,
        }));
        return new Map();
    }
    const entries = new Map();
    const explicitlyDeclared = new Set();
    for (const member of object.properties) {
        if (typescript_1.default.isSpreadAssignment(member)) {
            const resolved = resolveObjectLiteral(member.expression, checker);
            if (!resolved) {
                diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_SPREAD_UNSUPPORTED', member, sourceFile, parentPath));
                continue;
            }
            if (spreadStack.has(resolved.object)) {
                diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_CIRCULAR_SPREAD', member, sourceFile, parentPath));
                continue;
            }
            const spreadEntries = resolveObjectEntries(resolved.object, resolved.sourceFile, checker, diagnostics, new Set(spreadStack).add(resolved.object), parentPath, maxNestingDepth, depth + 1);
            for (const [name, incoming] of spreadEntries) {
                entries.set(name, withShadow(entries.get(name), incoming));
            }
            continue;
        }
        if (!typescript_1.default.isPropertyAssignment(member)) {
            diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_PROPERTY_UNSUPPORTED', member, sourceFile, parentPath));
            continue;
        }
        const name = resolvePropertyName(member.name, checker);
        if (name === undefined) {
            diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_COMPUTED_KEY_UNRESOLVED', member, sourceFile, parentPath));
            continue;
        }
        if (explicitlyDeclared.has(name)) {
            diagnostics.push((0, analysis_diagnostics_js_1.nodeDiagnostic)('ENV_ANALYSIS_DUPLICATE_PROPERTY', member, sourceFile, (0, analysis_diagnostics_js_1.joinPath)(parentPath, name)));
            continue;
        }
        explicitlyDeclared.add(name);
        entries.set(name, withShadow(entries.get(name), entryFor(name, member, sourceFile)));
    }
    return entries;
}
function resolveObjectLiteral(expression, checker) {
    const unwrapped = unwrap(expression);
    if (typescript_1.default.isObjectLiteralExpression(unwrapped)) {
        return { object: unwrapped, sourceFile: unwrapped.getSourceFile() };
    }
    if (!typescript_1.default.isIdentifier(unwrapped) && !typescript_1.default.isPropertyAccessExpression(unwrapped))
        return undefined;
    let symbol = checker.getSymbolAtLocation(unwrapped);
    if (symbol?.flags && symbol.flags & typescript_1.default.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(typescript_1.default.isVariableDeclaration);
    if (!declaration?.initializer || !typescript_1.default.isVariableDeclaration(declaration))
        return undefined;
    if (!(declaration.parent.flags & typescript_1.default.NodeFlags.Const))
        return undefined;
    const initializer = unwrap(declaration.initializer);
    if (!typescript_1.default.isObjectLiteralExpression(initializer))
        return undefined;
    return { object: initializer, sourceFile: declaration.getSourceFile() };
}
function resolvePropertyName(name, checker) {
    if (!typescript_1.default.isComputedPropertyName(name)) {
        return typescript_1.default.isIdentifier(name) || typescript_1.default.isStringLiteralLike(name) || typescript_1.default.isNumericLiteral(name)
            ? name.text
            : undefined;
    }
    return resolveStringConstant(name.expression, checker, new Set());
}
function resolveStringConstant(expression, checker, visited) {
    const unwrapped = unwrap(expression);
    if (typescript_1.default.isStringLiteralLike(unwrapped) || typescript_1.default.isNumericLiteral(unwrapped))
        return unwrapped.text;
    if (typescript_1.default.isPropertyAccessExpression(unwrapped)) {
        const enumConstant = checker.getConstantValue(unwrapped);
        if (enumConstant !== undefined)
            return String(enumConstant);
    }
    if (typescript_1.default.isTemplateExpression(unwrapped)) {
        let result = unwrapped.head.text;
        for (const span of unwrapped.templateSpans) {
            const value = resolveStringConstant(span.expression, checker, visited);
            if (value === undefined)
                return undefined;
            result += value + span.literal.text;
        }
        return result;
    }
    if (!typescript_1.default.isIdentifier(unwrapped))
        return undefined;
    let symbol = checker.getSymbolAtLocation(unwrapped);
    if (symbol?.flags && symbol.flags & typescript_1.default.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(typescript_1.default.isVariableDeclaration);
    if (!declaration?.initializer ||
        visited.has(declaration) ||
        !(declaration.parent.flags & typescript_1.default.NodeFlags.Const)) {
        return undefined;
    }
    visited.add(declaration);
    return resolveStringConstant(declaration.initializer, checker, visited);
}
function isStaticExpression(expression) {
    if (typescript_1.default.isStringLiteralLike(expression) ||
        typescript_1.default.isNumericLiteral(expression) ||
        expression.kind === typescript_1.default.SyntaxKind.TrueKeyword ||
        expression.kind === typescript_1.default.SyntaxKind.FalseKeyword ||
        expression.kind === typescript_1.default.SyntaxKind.NullKeyword ||
        (typescript_1.default.isIdentifier(expression) && expression.text === 'undefined')) {
        return 'static';
    }
    if (typescript_1.default.isArrayLiteralExpression(expression)) {
        return expression.elements.every((element) => !typescript_1.default.isSpreadElement(element) && isStaticExpression(unwrap(element)) === 'static')
            ? 'static'
            : 'dynamic';
    }
    if (typescript_1.default.isObjectLiteralExpression(expression)) {
        return expression.properties.every((property) => typescript_1.default.isPropertyAssignment(property) &&
            isStaticExpression(unwrap(property.initializer)) === 'static')
            ? 'static'
            : 'dynamic';
    }
    return 'dynamic';
}
function entryFor(name, node, sourceFile) {
    return { name, initializer: node.initializer, sourceFile, node, shadowed: [] };
}
function withShadow(existing, incoming) {
    return existing
        ? {
            ...incoming,
            shadowed: [
                ...existing.shadowed,
                (0, analysis_diagnostics_js_1.locationOf)(existing.node.name, existing.sourceFile),
                ...incoming.shadowed,
            ],
        }
        : incoming;
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
