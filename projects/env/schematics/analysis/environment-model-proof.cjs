"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proveModelType = proveModelType;
exports.proofKey = proofKey;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const MAX_MODEL_DEPTH = 8;
const MAX_MODEL_NODES = 256;
function proveModelType(type, checker, depth = 0, ancestors = new Set(), budget = { nodes: 0 }) {
    budget.nodes += 1;
    if (budget.nodes > MAX_MODEL_NODES || depth >= MAX_MODEL_DEPTH)
        return { reason: 'resource-limit' };
    if (ancestors.has(type))
        return { reason: 'recursive-type' };
    const flags = type.flags;
    if (flags & (typescript_1.default.TypeFlags.TemplateLiteral | typescript_1.default.TypeFlags.StringMapping))
        return { reason: 'unsupported-type' };
    if (flags & typescript_1.default.TypeFlags.StringLike)
        return { proof: primitive('string') };
    if (flags & typescript_1.default.TypeFlags.NumberLike)
        return { proof: primitive('number') };
    if (flags & typescript_1.default.TypeFlags.BooleanLike)
        return { proof: primitive('boolean') };
    if (flags & typescript_1.default.TypeFlags.BigIntLiteral)
        return { reason: 'unsupported-type' };
    if (flags & typescript_1.default.TypeFlags.BigIntLike)
        return { proof: primitive('bigint') };
    if (flags & typescript_1.default.TypeFlags.UniqueESSymbol)
        return { reason: 'unsupported-type' };
    if (flags & typescript_1.default.TypeFlags.ESSymbolLike)
        return { proof: primitive('symbol') };
    if (flags & typescript_1.default.TypeFlags.Null)
        return { proof: { kind: 'null' } };
    if (flags & typescript_1.default.TypeFlags.Undefined)
        return { proof: { kind: 'undefined' } };
    if (flags & (typescript_1.default.TypeFlags.Any | typescript_1.default.TypeFlags.Unknown | typescript_1.default.TypeFlags.TypeParameter))
        return { reason: 'unsupported-type' };
    const nextAncestors = new Set(ancestors).add(type);
    if (flags & typescript_1.default.TypeFlags.Union) {
        const union = type;
        if (union.types.some(isNonBooleanLiteral) ||
            union.types.filter((member) => Boolean(member.flags & typescript_1.default.TypeFlags.Object)).length > 1)
            return { reason: 'literal-union' };
        const members = union.types.map((member) => proveModelType(member, checker, depth + 1, nextAncestors, budget));
        const failed = members.find((member) => !member.proof);
        if (failed)
            return failed;
        const unique = new Map(members.map(({ proof }) => [proofKey(proof), proof]));
        const values = [...unique.values()].sort((a, b) => proofKey(a).localeCompare(proofKey(b)));
        if (values.length === 1)
            return { proof: values[0] };
        return { proof: { kind: 'union', members: values } };
    }
    if (checker.isTupleType(type)) {
        const reference = type;
        const target = reference.target;
        if (target.elementFlags.some((flag) => flag & (typescript_1.default.ElementFlags.Optional | typescript_1.default.ElementFlags.Rest | typescript_1.default.ElementFlags.Variadic)))
            return { reason: 'unsupported-type' };
        const members = checker
            .getTypeArguments(reference)
            .map((member) => proveModelType(member, checker, depth + 1, nextAncestors, budget));
        const failed = members.find((member) => !member.proof);
        if (failed)
            return failed;
        return {
            proof: {
                kind: 'tuple',
                readonly: target.readonly,
                elements: members.map(({ proof }) => proof),
            },
        };
    }
    if (checker.isArrayType(type)) {
        const reference = type;
        const element = proveModelType(checker.getTypeArguments(reference)[0], checker, depth + 1, nextAncestors, budget);
        if (!element.proof)
            return element;
        return {
            proof: {
                kind: 'array',
                readonly: reference.target.symbol.escapedName === 'ReadonlyArray' ||
                    type.getSymbol()?.escapedName === 'ReadonlyArray',
                element: element.proof,
            },
        };
    }
    if (!(flags & typescript_1.default.TypeFlags.Object) || flags & typescript_1.default.TypeFlags.Intersection)
        return { reason: 'unsupported-type' };
    if (flags & typescript_1.default.TypeFlags.NonPrimitive ||
        checker.getIndexInfosOfType(type).length > 0 ||
        checker.getSignaturesOfType(type, typescript_1.default.SignatureKind.Call).length > 0 ||
        checker.getSignaturesOfType(type, typescript_1.default.SignatureKind.Construct).length > 0)
        return { reason: 'unsupported-type' };
    const properties = [];
    for (const property of checker.getPropertiesOfType(type)) {
        const declaration = property.valueDeclaration ?? property.declarations?.[0];
        if (!declaration ||
            !isPlainPropertyDeclaration(declaration) ||
            !isSupportedPropertyName(declaration) ||
            (typescript_1.default.canHaveModifiers(declaration) &&
                typescript_1.default
                    .getModifiers(declaration)
                    ?.some((modifier) => modifier.kind === typescript_1.default.SyntaxKind.PrivateKeyword ||
                    modifier.kind === typescript_1.default.SyntaxKind.ProtectedKeyword)))
            return { reason: 'unsupported-type' };
        const result = proveModelType(checker.getTypeOfSymbolAtLocation(property, declaration), checker, depth + 1, nextAncestors, budget);
        if (!result.proof)
            return result;
        properties.push({
            name: String(property.escapedName),
            optional: (property.flags & typescript_1.default.SymbolFlags.Optional) !== 0,
            readonly: isReadonlyDeclaration(declaration),
            type: result.proof,
        });
    }
    properties.sort((a, b) => a.name.localeCompare(b.name));
    return { proof: { kind: 'object', properties } };
}
function proofKey(proof) {
    return JSON.stringify(proof);
}
function primitive(name) {
    return { kind: 'primitive', name };
}
function isNonBooleanLiteral(type) {
    return Boolean(type.flags &
        (typescript_1.default.TypeFlags.StringLiteral | typescript_1.default.TypeFlags.NumberLiteral | typescript_1.default.TypeFlags.BigIntLiteral));
}
function isPlainPropertyDeclaration(node) {
    return (typescript_1.default.isPropertyAssignment(node) || typescript_1.default.isPropertySignature(node) || typescript_1.default.isPropertyDeclaration(node));
}
function isSupportedPropertyName(node) {
    if (!typescript_1.default.isPropertyAssignment(node) &&
        !typescript_1.default.isPropertySignature(node) &&
        !typescript_1.default.isPropertyDeclaration(node))
        return false;
    return (typescript_1.default.isIdentifier(node.name) || typescript_1.default.isStringLiteral(node.name) || typescript_1.default.isNumericLiteral(node.name));
}
function isReadonlyDeclaration(node) {
    if (typescript_1.default.canHaveModifiers(node) &&
        typescript_1.default.getModifiers(node)?.some((m) => m.kind === typescript_1.default.SyntaxKind.ReadonlyKeyword))
        return true;
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (typescript_1.default.isAsExpression(parent) &&
            typescript_1.default.isTypeReferenceNode(parent.type) &&
            parent.type.typeName.getText() === 'const')
            return true;
        if (typescript_1.default.isVariableDeclaration(parent))
            return false;
    }
    return false;
}
