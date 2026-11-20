import ts from 'typescript';

export type ModelTypeProof =
  | {
      readonly kind: 'primitive';
      readonly name: 'string' | 'number' | 'boolean' | 'bigint' | 'symbol';
    }
  | { readonly kind: 'null' | 'undefined' }
  | { readonly kind: 'array'; readonly readonly: boolean; readonly element: ModelTypeProof }
  | {
      readonly kind: 'tuple';
      readonly readonly: boolean;
      readonly elements: readonly ModelTypeProof[];
    }
  | {
      readonly kind: 'object';
      readonly properties: readonly {
        readonly name: string;
        readonly optional: boolean;
        readonly readonly: boolean;
        readonly type: ModelTypeProof;
      }[];
    }
  | { readonly kind: 'union'; readonly members: readonly ModelTypeProof[] };

export interface ModelProofResult {
  readonly proof?: ModelTypeProof;
  readonly reason?: 'unsupported-type' | 'literal-union' | 'recursive-type' | 'resource-limit';
}

const MAX_MODEL_DEPTH = 8;
const MAX_MODEL_NODES = 256;

export function proveModelType(
  type: ts.Type,
  checker: ts.TypeChecker,
  depth = 0,
  ancestors: ReadonlySet<ts.Type> = new Set(),
  budget = { nodes: 0 },
): ModelProofResult {
  budget.nodes += 1;
  if (budget.nodes > MAX_MODEL_NODES || depth >= MAX_MODEL_DEPTH)
    return { reason: 'resource-limit' };
  if (ancestors.has(type)) return { reason: 'recursive-type' };

  const flags = type.flags;
  if (flags & (ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping))
    return { reason: 'unsupported-type' };
  if (flags & ts.TypeFlags.StringLike) return { proof: primitive('string') };
  if (flags & ts.TypeFlags.NumberLike) return { proof: primitive('number') };
  if (flags & ts.TypeFlags.BooleanLike) return { proof: primitive('boolean') };
  if (flags & ts.TypeFlags.BigIntLiteral) return { reason: 'unsupported-type' };
  if (flags & ts.TypeFlags.BigIntLike) return { proof: primitive('bigint') };
  if (flags & ts.TypeFlags.UniqueESSymbol) return { reason: 'unsupported-type' };
  if (flags & ts.TypeFlags.ESSymbolLike) return { proof: primitive('symbol') };
  if (flags & ts.TypeFlags.Null) return { proof: { kind: 'null' } };
  if (flags & ts.TypeFlags.Undefined) return { proof: { kind: 'undefined' } };
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter))
    return { reason: 'unsupported-type' };

  const nextAncestors = new Set(ancestors).add(type);
  if (flags & ts.TypeFlags.Union) {
    const union = type as ts.UnionType;
    if (
      union.types.some(isNonBooleanLiteral) ||
      union.types.filter((member) => Boolean(member.flags & ts.TypeFlags.Object)).length > 1
    )
      return { reason: 'literal-union' };
    const members = union.types.map((member) =>
      proveModelType(member, checker, depth + 1, nextAncestors, budget),
    );
    const failed = members.find((member) => !member.proof);
    if (failed) return failed;
    const unique = new Map(members.map(({ proof }) => [proofKey(proof!), proof!]));
    const values = [...unique.values()].sort((a, b) => proofKey(a).localeCompare(proofKey(b)));
    if (values.length === 1) return { proof: values[0] };
    return { proof: { kind: 'union', members: values } };
  }
  if (checker.isTupleType(type)) {
    const reference = type as ts.TypeReference;
    const target = reference.target as ts.TupleType;
    if (
      target.elementFlags.some(
        (flag) =>
          flag & (ts.ElementFlags.Optional | ts.ElementFlags.Rest | ts.ElementFlags.Variadic),
      )
    )
      return { reason: 'unsupported-type' };
    const members = checker
      .getTypeArguments(reference)
      .map((member) => proveModelType(member, checker, depth + 1, nextAncestors, budget));
    const failed = members.find((member) => !member.proof);
    if (failed) return failed;
    return {
      proof: {
        kind: 'tuple',
        readonly: target.readonly,
        elements: members.map(({ proof }) => proof!),
      },
    };
  }
  if (checker.isArrayType(type)) {
    const reference = type as ts.TypeReference;
    const element = proveModelType(
      checker.getTypeArguments(reference)[0]!,
      checker,
      depth + 1,
      nextAncestors,
      budget,
    );
    if (!element.proof) return element;
    return {
      proof: {
        kind: 'array',
        readonly:
          reference.target.symbol.escapedName === 'ReadonlyArray' ||
          type.getSymbol()?.escapedName === 'ReadonlyArray',
        element: element.proof,
      },
    };
  }
  if (!(flags & ts.TypeFlags.Object) || flags & ts.TypeFlags.Intersection)
    return { reason: 'unsupported-type' };
  if (
    flags & ts.TypeFlags.NonPrimitive ||
    checker.getIndexInfosOfType(type).length > 0 ||
    checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
    checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0
  )
    return { reason: 'unsupported-type' };

  const properties = [];
  for (const property of checker.getPropertiesOfType(type)) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (
      !declaration ||
      !isPlainPropertyDeclaration(declaration) ||
      !isSupportedPropertyName(declaration) ||
      (ts.canHaveModifiers(declaration) &&
        ts
          .getModifiers(declaration)
          ?.some(
            (modifier) =>
              modifier.kind === ts.SyntaxKind.PrivateKeyword ||
              modifier.kind === ts.SyntaxKind.ProtectedKeyword,
          ))
    )
      return { reason: 'unsupported-type' };
    const result = proveModelType(
      checker.getTypeOfSymbolAtLocation(property, declaration),
      checker,
      depth + 1,
      nextAncestors,
      budget,
    );
    if (!result.proof) return result;
    properties.push({
      name: String(property.escapedName),
      optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
      readonly: isReadonlyDeclaration(declaration),
      type: result.proof,
    });
  }
  properties.sort((a, b) => a.name.localeCompare(b.name));
  return { proof: { kind: 'object', properties } };
}

export function proofKey(proof: ModelTypeProof): string {
  return JSON.stringify(proof);
}

function primitive(name: Extract<ModelTypeProof, { kind: 'primitive' }>['name']): ModelTypeProof {
  return { kind: 'primitive', name };
}

function isNonBooleanLiteral(type: ts.Type): boolean {
  return Boolean(
    type.flags &
    (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BigIntLiteral),
  );
}

function isPlainPropertyDeclaration(node: ts.Node): boolean {
  return (
    ts.isPropertyAssignment(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)
  );
}

function isSupportedPropertyName(node: ts.Node): boolean {
  if (
    !ts.isPropertyAssignment(node) &&
    !ts.isPropertySignature(node) &&
    !ts.isPropertyDeclaration(node)
  )
    return false;
  return (
    ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)
  );
}

function isReadonlyDeclaration(node: ts.Node): boolean {
  if (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)
  )
    return true;
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (
      ts.isAsExpression(parent) &&
      ts.isTypeReferenceNode(parent.type) &&
      parent.type.typeName.getText() === 'const'
    )
      return true;
    if (ts.isVariableDeclaration(parent)) return false;
  }
  return false;
}
