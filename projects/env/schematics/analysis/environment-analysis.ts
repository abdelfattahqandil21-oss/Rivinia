import ts from 'typescript';
import { sourceDiagnostic, typeScriptDiagnostic } from './analysis-diagnostics.js';
import type {
  AnalysisDiagnostic,
  AnalyzedEnvironment,
  EnvironmentAnalysisOptions,
  EnvironmentAnalysisResult,
  EnvironmentSourceInput,
  InfluencingFileHash,
  TypeScriptProjectSource,
} from './analysis-model.js';
import {
  analyzeEnvironmentObject,
  findEnvironmentDeclaration,
} from './environment-object-analysis.js';
import { reconcileEnvironmentTypes } from './type-reconciliation.js';
import { createAnalysisProgram } from './typescript-project-program.js';

export type {
  AnalysisDiagnostic,
  AnalyzedEnvironment,
  AnalyzedProperty,
  AnalyzedType,
  EnvironmentAnalysisOptions,
  EnvironmentAnalysisResult,
  EnvironmentSourceInput,
  InfluencingFileHash,
  SourceLocation,
  TypeScriptProjectSource,
} from './analysis-model.js';

const DEFAULT_MAX_SOURCES = 128;
const DEFAULT_MAX_SOURCE_BYTES = 8_388_608;
const DEFAULT_MAX_NESTING_DEPTH = 64;
const DEFAULT_MAX_TYPE_DEPTH = 8;

export function analyzeEnvironmentSources(
  inputs: readonly EnvironmentSourceInput[],
  options: EnvironmentAnalysisOptions = {},
): EnvironmentAnalysisResult {
  const maxSources = options.maxSources ?? DEFAULT_MAX_SOURCES;
  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const maxNestingDepth = options.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;
  const maxTypeDepth = options.maxTypeDepth ?? DEFAULT_MAX_TYPE_DEPTH;
  const sourceBytes = inputs.reduce(
    (total, input) => total + new TextEncoder().encode(input.sourceText).byteLength,
    0,
  );
  if (inputs.length > maxSources) {
    return {
      environments: [],
      fields: [],
      diagnostics: [
        sourceDiagnostic(
          'ENV_ANALYSIS_RESOURCE_LIMIT',
          inputs[0]?.fileName ?? '',
          `The supplied source count exceeds the configured limit of ${maxSources}.`,
          { kind: 'source-count', limit: maxSources },
        ),
      ],
      influencingFileHashes: [],
    };
  }
  if (sourceBytes > maxSourceBytes) {
    return {
      environments: [],
      fields: [],
      diagnostics: [
        sourceDiagnostic(
          'ENV_ANALYSIS_RESOURCE_LIMIT',
          inputs[0]?.fileName ?? '',
          `The supplied source bytes exceed the configured limit of ${maxSourceBytes}.`,
          { kind: 'source-bytes', limit: maxSourceBytes },
        ),
      ],
      influencingFileHashes: [],
    };
  }

  const programResult = createAnalysisProgram(inputs, options, maxSources, maxSourceBytes);
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
  const diagnostics: AnalysisDiagnostic[] = [];
  const environments: AnalyzedEnvironment[] = [];

  for (const input of roots) {
    const fileName = canonicalFileName(input.fileName);
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile || program.getSyntacticDiagnostics(sourceFile).length > 0) {
      diagnostics.push(
        sourceDiagnostic(
          'ENV_ANALYSIS_SOURCE_INVALID',
          input.fileName,
          'A source file is missing or has invalid TypeScript syntax.',
        ),
      );
      continue;
    }
    for (const semanticDiagnostic of program.getSemanticDiagnostics(sourceFile)) {
      const code =
        semanticDiagnostic.code === 2307 || semanticDiagnostic.code === 2305
          ? 'ENV_ANALYSIS_IMPORT_UNRESOLVED'
          : semanticDiagnostic.code === 2304 || semanticDiagnostic.code === 2552
            ? 'ENV_ANALYSIS_SYMBOL_UNRESOLVED'
            : undefined;
      if (code) diagnostics.push(typeScriptDiagnostic(code, semanticDiagnostic, sourceFile));
    }

    const declaration = findEnvironmentDeclaration(sourceFile);
    if (
      !declaration?.initializer ||
      !ts.isObjectLiteralExpression(unwrap(declaration.initializer))
    ) {
      diagnostics.push(
        sourceDiagnostic(
          'ENV_ANALYSIS_ROOT_UNSUPPORTED',
          input.fileName,
          'The environment export must be initialized by a static object literal.',
        ),
      );
      continue;
    }

    const analysis = analyzeEnvironmentObject(
      unwrap(declaration.initializer) as ts.ObjectLiteralExpression,
      sourceFile,
      checker,
      maxNestingDepth,
      maxTypeDepth,
    );
    environments.push({
      name: input.name,
      fileName: input.fileName,
      properties: analysis.properties,
      transferSafety: assessTransferSafety(sourceFile, declaration, analysis.properties),
    });
    diagnostics.push(...analysis.diagnostics);
  }

  const reconciliation = reconcileEnvironmentTypes(environments, maxTypeDepth);
  const allDiagnostics = [...diagnostics, ...reconciliation.diagnostics];
  const influencingFileHashes = programResult.getInfluencingFileHashes();
  if (
    allDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === 'ENV_ANALYSIS_RESOURCE_LIMIT' ||
        diagnostic.code === 'ENV_ANALYSIS_IMPORT_UNRESOLVED' ||
        diagnostic.code === 'ENV_ANALYSIS_SYMBOL_UNRESOLVED',
    )
  ) {
    return { environments: [], fields: [], diagnostics: allDiagnostics, influencingFileHashes };
  }
  return {
    environments,
    fields: reconciliation.fields,
    diagnostics: allDiagnostics,
    influencingFileHashes,
  };
}

function assessTransferSafety(
  sourceFile: ts.SourceFile,
  environmentDeclaration: ts.VariableDeclaration,
  properties: readonly import('./analysis-model.js').AnalyzedProperty[],
): import('./analysis-model.js').AnalyzedEnvironment['transferSafety'] {
  if (properties.some(({ valueStatus }) => valueStatus !== 'static')) {
    return {
      strategy: 'verbatim-sibling-copy',
      status: 'blocked',
      reason: 'dynamic-environment-value',
    };
  }

  let hasModuleLocationReference = false;
  const visit = (node: ts.Node) => {
    if (
      (ts.isMetaProperty(node) &&
        node.keywordToken === ts.SyntaxKind.ImportKeyword &&
        node.name.text === 'meta') ||
      (ts.isIdentifier(node) && ['__filename', '__dirname'].includes(node.text))
    ) {
      hasModuleLocationReference = true;
    }
    ts.forEachChild(node, visit);
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
    if (
      ts.isImportDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    )
      return true;
    if (ts.isVariableStatement(statement)) {
      return (
        statement.declarationList.declarations.length === 1 &&
        statement.declarationList.declarations[0] === environmentDeclaration
      );
    }
    return (
      'modifiers' in statement &&
      Array.isArray(statement.modifiers) &&
      statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
    );
  });
  return supported
    ? { strategy: 'verbatim-sibling-copy', status: 'safe' }
    : {
        strategy: 'verbatim-sibling-copy',
        status: 'blocked',
        reason: 'unsupported-top-level-effect',
      };
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

function canonicalFileName(fileName: string): string {
  return fileName.replaceAll('\\', '/');
}
