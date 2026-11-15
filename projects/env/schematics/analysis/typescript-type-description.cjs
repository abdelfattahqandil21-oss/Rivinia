"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeType = describeType;
exports.getObjectShapeSignature = getObjectShapeSignature;
exports.hasUnprovenStructuralObjectShape = hasUnprovenStructuralObjectShape;
exports.getCompatibilitySignature = getCompatibilitySignature;
exports.containsUnknownType = containsUnknownType;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
// Retain bounded shape only for reconciliation. It is deliberately excluded
// from serialized Analyzer and plan output so Plan Schema v3 stays unchanged.
const objectShapeSignatures = new WeakMap();
function describeType(type, checker, depth = 0, ancestors = new Set(), maxDepth = 8, includeObjectShape = false) {
    if (type.flags & typescript_1.default.TypeFlags.StringLike)
        return { kind: 'string' };
    if (type.flags & typescript_1.default.TypeFlags.NumberLike)
        return { kind: 'number' };
    if (type.flags & typescript_1.default.TypeFlags.BooleanLike)
        return { kind: 'boolean' };
    if (type.flags & typescript_1.default.TypeFlags.BigIntLike)
        return { kind: 'bigint' };
    if (type.flags & typescript_1.default.TypeFlags.ESSymbolLike)
        return { kind: 'symbol' };
    if (type.flags & typescript_1.default.TypeFlags.Null)
        return { kind: 'null' };
    if (type.flags & typescript_1.default.TypeFlags.Undefined)
        return { kind: 'undefined' };
    if (depth >= maxDepth)
        return { kind: 'unknown', unknownReason: 'type-depth' };
    if (ancestors.has(type))
        return { kind: 'unknown', unknownReason: 'circular-type' };
    const nextAncestors = new Set(ancestors).add(type);
    if (type.flags & typescript_1.default.TypeFlags.Union) {
        const members = type.types.map((member) => describeType(member, checker, depth + 1, nextAncestors, maxDepth, includeObjectShape));
        const unique = new Map(members.map((member) => [getCompatibilitySignature(member), member]));
        return { kind: 'union', members: [...unique.values()] };
    }
    if (checker.isTupleType(type)) {
        const target = type.target;
        return {
            kind: 'tuple',
            readonly: target.readonly,
            members: checker
                .getTypeArguments(type)
                .map((member) => describeType(member, checker, depth + 1, nextAncestors, maxDepth, includeObjectShape)),
        };
    }
    if (checker.isArrayType(type) ||
        type.getSymbol()?.escapedName === 'Array' ||
        type.getSymbol()?.escapedName === 'ReadonlyArray') {
        const target = type.target;
        return {
            kind: 'array',
            readonly: target.symbol?.escapedName === 'ReadonlyArray' ||
                type.getSymbol()?.escapedName === 'ReadonlyArray',
            members: checker
                .getTypeArguments(type)
                .map((member) => describeType(member, checker, depth + 1, nextAncestors, maxDepth, true)),
        };
    }
    if (type.flags & typescript_1.default.TypeFlags.Object) {
        return includeObjectShape
            ? describeObjectShape(type, checker, depth, nextAncestors, maxDepth)
            : { kind: 'object' };
    }
    return { kind: 'unknown' };
}
function getObjectShapeSignature(type) {
    return type.kind === 'object' ? objectShapeSignatures.get(type) : undefined;
}
function hasUnprovenStructuralObjectShape(type, insideStructuralType = false) {
    const structuralContext = insideStructuralType || type.kind === 'array' || type.kind === 'tuple' || type.kind === 'union';
    if (type.kind === 'object') {
        return structuralContext && getObjectShapeSignature(type) === undefined;
    }
    return (type.members?.some((member) => hasUnprovenStructuralObjectShape(member, structuralContext)) ===
        true);
}
function describeObjectShape(type, checker, depth, ancestors, maxDepth) {
    try {
        // Index signatures and callable objects can have behavior beyond their
        // declared members. They are deliberately unsupported in a bounded shape.
        if (type.flags & typescript_1.default.TypeFlags.NonPrimitive ||
            checker.getIndexInfosOfType(type).length > 0 ||
            checker.getSignaturesOfType(type, typescript_1.default.SignatureKind.Call).length > 0 ||
            checker.getSignaturesOfType(type, typescript_1.default.SignatureKind.Construct).length > 0) {
            return { kind: 'unknown' };
        }
        const members = [];
        for (const property of checker.getPropertiesOfType(type)) {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            if (!declaration)
                return { kind: 'unknown' };
            const memberType = checker.getTypeOfSymbolAtLocation(property, declaration);
            const describedMember = describeType(memberType, checker, depth + 1, ancestors, maxDepth, true);
            if (containsUnknownType(describedMember)) {
                const unknownReason = findUnknownReason(describedMember);
                return unknownReason ? { kind: 'unknown', unknownReason } : { kind: 'unknown' };
            }
            const modifiers = typescript_1.default.canHaveModifiers(declaration)
                ? (typescript_1.default.getModifiers(declaration) ?? [])
                : [];
            members.push(encodeSignature(String(property.escapedName), (property.flags & typescript_1.default.SymbolFlags.Optional) !== 0 ? 'optional' : 'required', modifiers.some((modifier) => modifier.kind === typescript_1.default.SyntaxKind.ReadonlyKeyword)
                ? 'readonly'
                : 'mutable', getCompatibilitySignature(describedMember)));
        }
        members.sort();
        const description = { kind: 'object' };
        objectShapeSignatures.set(description, encodeSignature(String(members.length), ...members));
        return description;
    }
    catch {
        // TypeScript can expose unresolved or exotic object shapes through the
        // checker. Refuse these rather than treating them as a generic object.
        return { kind: 'unknown' };
    }
}
function getCompatibilitySignature(type) {
    if (type.kind === 'object') {
        const shape = objectShapeSignatures.get(type);
        return encodeSignature('object', shape ?? 'unproven');
    }
    const members = type.members?.map(getCompatibilitySignature);
    const orderedMembers = type.kind === 'tuple' ? members : members?.sort();
    return encodeSignature(type.kind, type.readonly === undefined ? 'unspecified' : type.readonly ? 'readonly' : 'mutable', ...(orderedMembers ?? []));
}
function encodeSignature(...parts) {
    return parts.map((part) => `${part.length}:${part}`).join('');
}
function findUnknownReason(type) {
    if (type.kind === 'unknown')
        return type.unknownReason;
    for (const member of type.members ?? []) {
        const reason = findUnknownReason(member);
        if (reason)
            return reason;
    }
    return undefined;
}
function containsUnknownType(type) {
    return type.kind === 'unknown' || type.members?.some(containsUnknownType) === true;
}
