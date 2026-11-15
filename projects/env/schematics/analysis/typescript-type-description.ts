import ts from 'typescript';
import type { AnalyzedType } from './analysis-model.js';

// Retain bounded shape only for reconciliation. It is deliberately excluded
// from serialized Analyzer and plan output so Plan Schema v3 stays unchanged.
const objectShapeSignatures = new WeakMap<AnalyzedType, string>();

export function describeType(
  type: ts.Type,
  checker: ts.TypeChecker,
  depth = 0,
  ancestors: ReadonlySet<ts.Type> = new Set(),
  maxDepth = 8,
  includeObjectShape = false,
): AnalyzedType {
  if (type.flags & ts.TypeFlags.StringLike) return { kind: 'string' };
  if (type.flags & ts.TypeFlags.NumberLike) return { kind: 'number' };
  if (type.flags & ts.TypeFlags.BooleanLike) return { kind: 'boolean' };
  if (type.flags & ts.TypeFlags.BigIntLike) return { kind: 'bigint' };
  if (type.flags & ts.TypeFlags.ESSymbolLike) return { kind: 'symbol' };
  if (type.flags & ts.TypeFlags.Null) return { kind: 'null' };
  if (type.flags & ts.TypeFlags.Undefined) return { kind: 'undefined' };
  if (depth >= maxDepth) return { kind: 'unknown', unknownReason: 'type-depth' };
  if (ancestors.has(type)) return { kind: 'unknown', unknownReason: 'circular-type' };
  const nextAncestors = new Set(ancestors).add(type);
  if (type.flags & ts.TypeFlags.Union) {
    const members = (type as ts.UnionType).types.map((member) =>
      describeType(member, checker, depth + 1, nextAncestors, maxDepth, includeObjectShape),
    );
    const unique = new Map(members.map((member) => [getCompatibilitySignature(member), member]));
    return { kind: 'union', members: [...unique.values()] };
  }
  if (checker.isTupleType(type)) {
    const target = (type as ts.TypeReference).target as ts.TupleType;
    return {
      kind: 'tuple',
      readonly: target.readonly,
      members: checker
        .getTypeArguments(type as ts.TypeReference)
        .map((member) =>
          describeType(member, checker, depth + 1, nextAncestors, maxDepth, includeObjectShape),
        ),
    };
  }
  if (
    checker.isArrayType(type) ||
    type.getSymbol()?.escapedName === 'Array' ||
    type.getSymbol()?.escapedName === 'ReadonlyArray'
  ) {
    const target = (type as ts.TypeReference).target;
    return {
      kind: 'array',
      readonly:
        target.symbol?.escapedName === 'ReadonlyArray' ||
        type.getSymbol()?.escapedName === 'ReadonlyArray',
      members: checker
        .getTypeArguments(type as ts.TypeReference)
        .map((member) => describeType(member, checker, depth + 1, nextAncestors, maxDepth, true)),
    };
  }
  if (type.flags & ts.TypeFlags.Object) {
    return includeObjectShape
      ? describeObjectShape(type, checker, depth, nextAncestors, maxDepth)
      : { kind: 'object' };
  }
  return { kind: 'unknown' };
}

export function getObjectShapeSignature(type: AnalyzedType): string | undefined {
  return type.kind === 'object' ? objectShapeSignatures.get(type) : undefined;
}

export function hasUnprovenStructuralObjectShape(
  type: AnalyzedType,
  insideStructuralType = false,
): boolean {
  const structuralContext =
    insideStructuralType || type.kind === 'array' || type.kind === 'tuple' || type.kind === 'union';
  if (type.kind === 'object') {
    return structuralContext && getObjectShapeSignature(type) === undefined;
  }
  return (
    type.members?.some((member) => hasUnprovenStructuralObjectShape(member, structuralContext)) ===
    true
  );
}

function describeObjectShape(
  type: ts.Type,
  checker: ts.TypeChecker,
  depth: number,
  ancestors: ReadonlySet<ts.Type>,
  maxDepth: number,
): AnalyzedType {
  try {
    // Index signatures and callable objects can have behavior beyond their
    // declared members. They are deliberately unsupported in a bounded shape.
    if (
      type.flags & ts.TypeFlags.NonPrimitive ||
      checker.getIndexInfosOfType(type).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0
    ) {
      return { kind: 'unknown' };
    }

    const members: string[] = [];
    for (const property of checker.getPropertiesOfType(type)) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration) return { kind: 'unknown' };
      const memberType = checker.getTypeOfSymbolAtLocation(property, declaration);
      const describedMember = describeType(
        memberType,
        checker,
        depth + 1,
        ancestors,
        maxDepth,
        true,
      );
      if (containsUnknownType(describedMember)) {
        const unknownReason = findUnknownReason(describedMember);
        return unknownReason ? { kind: 'unknown', unknownReason } : { kind: 'unknown' };
      }
      const modifiers = ts.canHaveModifiers(declaration)
        ? (ts.getModifiers(declaration) ?? [])
        : [];
      members.push(
        encodeSignature(
          String(property.escapedName),
          (property.flags & ts.SymbolFlags.Optional) !== 0 ? 'optional' : 'required',
          modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
            ? 'readonly'
            : 'mutable',
          getCompatibilitySignature(describedMember),
        ),
      );
    }
    members.sort();
    const description: AnalyzedType = { kind: 'object' };
    objectShapeSignatures.set(description, encodeSignature(String(members.length), ...members));
    return description;
  } catch {
    // TypeScript can expose unresolved or exotic object shapes through the
    // checker. Refuse these rather than treating them as a generic object.
    return { kind: 'unknown' };
  }
}

export function getCompatibilitySignature(type: AnalyzedType): string {
  if (type.kind === 'object') {
    const shape = objectShapeSignatures.get(type);
    return encodeSignature('object', shape ?? 'unproven');
  }
  const members = type.members?.map(getCompatibilitySignature);
  const orderedMembers = type.kind === 'tuple' ? members : members?.sort();
  return encodeSignature(
    type.kind,
    type.readonly === undefined ? 'unspecified' : type.readonly ? 'readonly' : 'mutable',
    ...(orderedMembers ?? []),
  );
}

function encodeSignature(...parts: string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

function findUnknownReason(type: AnalyzedType): AnalyzedType['unknownReason'] {
  if (type.kind === 'unknown') return type.unknownReason;
  for (const member of type.members ?? []) {
    const reason = findUnknownReason(member);
    if (reason) return reason;
  }
  return undefined;
}

export function containsUnknownType(type: AnalyzedType): boolean {
  return type.kind === 'unknown' || type.members?.some(containsUnknownType) === true;
}
