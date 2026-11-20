import ts from 'typescript';
import { joinPath, locationOf, nodeDiagnostic } from './analysis-diagnostics.js';
import type { AnalysisDiagnostic, AnalyzedProperty } from './analysis-model.js';
import { containsUnknownType, describeType } from './typescript-type-description.js';

interface PropertyEntry {
  readonly name: string;
  readonly initializer: ts.Expression;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.PropertyAssignment;
  readonly shadowed: readonly ReturnType<typeof locationOf>[];
}

export interface EnvironmentObjectAnalysis {
  readonly properties: readonly AnalyzedProperty[];
  readonly diagnostics: readonly AnalysisDiagnostic[];
}

export function findEnvironmentDeclaration(
  sourceFile: ts.SourceFile,
): ts.VariableDeclaration | undefined {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === 'environment',
    );
    if (declaration) return declaration;
  }
  return undefined;
}

export function analyzeEnvironmentObject(
  object: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  maxNestingDepth: number,
  maxTypeDepth: number,
): EnvironmentObjectAnalysis {
  const properties: AnalyzedProperty[] = [];
  const diagnostics: AnalysisDiagnostic[] = [];
  collectProperties(
    object,
    '',
    sourceFile,
    checker,
    properties,
    diagnostics,
    new Set(),
    maxNestingDepth,
    maxTypeDepth,
  );
  properties.sort((left, right) => left.path.localeCompare(right.path));
  return { properties, diagnostics };
}

function collectProperties(
  object: ts.ObjectLiteralExpression,
  parentPath: string,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  output: AnalyzedProperty[],
  diagnostics: AnalysisDiagnostic[],
  spreadStack: Set<ts.Node>,
  maxNestingDepth: number,
  maxTypeDepth: number,
  depth = 0,
): void {
  if (depth > maxNestingDepth) {
    diagnostics.push(
      nodeDiagnostic('ENV_ANALYSIS_RESOURCE_LIMIT', object, sourceFile, parentPath, {
        kind: 'object-depth',
        limit: maxNestingDepth,
      }),
    );
    return;
  }
  const entries = resolveObjectEntries(
    object,
    sourceFile,
    checker,
    diagnostics,
    new Set(spreadStack).add(object),
    parentPath,
    maxNestingDepth,
    depth,
  );

  for (const [name, entry] of entries) {
    const path = joinPath(parentPath, name);
    const initializer = unwrap(entry.initializer);
    const inferredType = checker.getTypeAtLocation(entry.initializer);
    const analyzedType = describeType(inferredType, checker, 0, new Set(), maxTypeDepth);
    output.push({
      path,
      type: analyzedType,
      typeStatus:
        inferredType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ||
        containsUnknownType(analyzedType)
          ? 'unknown'
          : 'known',
      valueStatus: isStaticExpression(initializer),
      presenceStatus: 'present',
      sourceProvenance: locationOf(entry.node.name, entry.sourceFile),
      shadowedProvenance: entry.shadowed.length ? entry.shadowed : undefined,
    });
    if (ts.isObjectLiteralExpression(initializer)) {
      collectProperties(
        initializer,
        path,
        entry.sourceFile,
        checker,
        output,
        diagnostics,
        spreadStack,
        maxNestingDepth,
        maxTypeDepth,
        depth + 1,
      );
    }
  }
}

function resolveObjectEntries(
  object: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  diagnostics: AnalysisDiagnostic[],
  spreadStack: Set<ts.Node>,
  parentPath: string,
  maxNestingDepth: number,
  depth: number,
): Map<string, PropertyEntry> {
  if (depth > maxNestingDepth) {
    diagnostics.push(
      nodeDiagnostic('ENV_ANALYSIS_RESOURCE_LIMIT', object, sourceFile, parentPath, {
        kind: 'object-depth',
        limit: maxNestingDepth,
      }),
    );
    return new Map();
  }
  const entries = new Map<string, PropertyEntry>();
  const explicitlyDeclared = new Set<string>();
  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member)) {
      const resolved = resolveObjectLiteral(member.expression, checker);
      if (!resolved) {
        diagnostics.push(
          nodeDiagnostic('ENV_ANALYSIS_SPREAD_UNSUPPORTED', member, sourceFile, parentPath),
        );
        continue;
      }
      if (spreadStack.has(resolved.object)) {
        diagnostics.push(
          nodeDiagnostic('ENV_ANALYSIS_CIRCULAR_SPREAD', member, sourceFile, parentPath),
        );
        continue;
      }
      const spreadEntries = resolveObjectEntries(
        resolved.object,
        resolved.sourceFile,
        checker,
        diagnostics,
        new Set(spreadStack).add(resolved.object),
        parentPath,
        maxNestingDepth,
        depth + 1,
      );
      for (const [name, incoming] of spreadEntries) {
        entries.set(name, withShadow(entries.get(name), incoming));
      }
      continue;
    }
    if (!ts.isPropertyAssignment(member)) {
      diagnostics.push(
        nodeDiagnostic('ENV_ANALYSIS_PROPERTY_UNSUPPORTED', member, sourceFile, parentPath),
      );
      continue;
    }
    const name = resolvePropertyName(member.name, checker);
    if (name === undefined) {
      diagnostics.push(
        nodeDiagnostic('ENV_ANALYSIS_COMPUTED_KEY_UNRESOLVED', member, sourceFile, parentPath),
      );
      continue;
    }
    if (explicitlyDeclared.has(name)) {
      diagnostics.push(
        nodeDiagnostic(
          'ENV_ANALYSIS_DUPLICATE_PROPERTY',
          member,
          sourceFile,
          joinPath(parentPath, name),
        ),
      );
      continue;
    }
    explicitlyDeclared.add(name);
    entries.set(name, withShadow(entries.get(name), entryFor(name, member, sourceFile)));
  }
  return entries;
}

function resolveObjectLiteral(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): { readonly object: ts.ObjectLiteralExpression; readonly sourceFile: ts.SourceFile } | undefined {
  const unwrapped = unwrap(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return { object: unwrapped, sourceFile: unwrapped.getSourceFile() };
  }
  if (!ts.isIdentifier(unwrapped) && !ts.isPropertyAccessExpression(unwrapped)) return undefined;
  let symbol = checker.getSymbolAtLocation(unwrapped);
  if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
    symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
  if (!declaration?.initializer || !ts.isVariableDeclaration(declaration)) return undefined;
  if (!(declaration.parent.flags & ts.NodeFlags.Const)) return undefined;
  const initializer = unwrap(declaration.initializer);
  if (!ts.isObjectLiteralExpression(initializer)) return undefined;
  return { object: initializer, sourceFile: declaration.getSourceFile() };
}

function resolvePropertyName(name: ts.PropertyName, checker: ts.TypeChecker): string | undefined {
  if (!ts.isComputedPropertyName(name)) {
    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
      ? name.text
      : undefined;
  }
  return resolveStringConstant(name.expression, checker, new Set());
}

function resolveStringConstant(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  visited: Set<ts.Node>,
): string | undefined {
  const unwrapped = unwrap(expression);
  if (ts.isStringLiteralLike(unwrapped) || ts.isNumericLiteral(unwrapped)) return unwrapped.text;
  if (ts.isPropertyAccessExpression(unwrapped)) {
    const enumConstant = checker.getConstantValue(unwrapped);
    if (enumConstant !== undefined) return String(enumConstant);
  }
  if (ts.isTemplateExpression(unwrapped)) {
    let result = unwrapped.head.text;
    for (const span of unwrapped.templateSpans) {
      const value = resolveStringConstant(span.expression, checker, visited);
      if (value === undefined) return undefined;
      result += value + span.literal.text;
    }
    return result;
  }
  if (!ts.isIdentifier(unwrapped)) return undefined;
  let symbol = checker.getSymbolAtLocation(unwrapped);
  if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
    symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.declarations?.find(ts.isVariableDeclaration);
  if (
    !declaration?.initializer ||
    visited.has(declaration) ||
    !(declaration.parent.flags & ts.NodeFlags.Const)
  ) {
    return undefined;
  }
  visited.add(declaration);
  return resolveStringConstant(declaration.initializer, checker, visited);
}

function isStaticExpression(expression: ts.Expression): 'static' | 'dynamic' {
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNumericLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(expression) && expression.text === 'undefined')
  ) {
    return 'static';
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.every(
      (element) => !ts.isSpreadElement(element) && isStaticExpression(unwrap(element)) === 'static',
    )
      ? 'static'
      : 'dynamic';
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return expression.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        isStaticExpression(unwrap(property.initializer)) === 'static',
    )
      ? 'static'
      : 'dynamic';
  }
  return 'dynamic';
}

function entryFor(
  name: string,
  node: ts.PropertyAssignment,
  sourceFile: ts.SourceFile,
): PropertyEntry {
  return { name, initializer: node.initializer, sourceFile, node, shadowed: [] };
}

function withShadow(existing: PropertyEntry | undefined, incoming: PropertyEntry): PropertyEntry {
  return existing
    ? {
        ...incoming,
        shadowed: [
          ...existing.shadowed,
          locationOf(existing.node.name, existing.sourceFile),
          ...incoming.shadowed,
        ],
      }
    : incoming;
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}
