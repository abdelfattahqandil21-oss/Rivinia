import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, normalize, type Path } from '@angular-devkit/core';
import ts from 'typescript';
import type {
  AnalysisDiagnostic,
  AnalysisResourceBudget,
  EnvironmentAnalysisOptions,
  EnvironmentSourceInput,
  InfluencingFileHash,
  TypeScriptProjectSource,
} from './analysis-model.js';

export interface AnalysisProgramResult {
  readonly program?: ts.Program;
  readonly diagnostics: readonly AnalysisDiagnostic[];
  readonly getInfluencingFileHashes: () => readonly InfluencingFileHash[];
}

export function createAnalysisProgram(
  inputs: readonly EnvironmentSourceInput[],
  options: EnvironmentAnalysisOptions,
  maxSources: number,
  maxSourceBytes: number,
): AnalysisProgramResult {
  return options.project
    ? createConsumerProgram(inputs, options.project, maxSources, maxSourceBytes)
    : createSuppliedSourcesProgram(inputs);
}

function createSuppliedSourcesProgram(
  inputs: readonly EnvironmentSourceInput[],
): AnalysisProgramResult {
  const sourceMap = new Map(
    inputs.map((input) => [canonicalFileName(input.fileName), input.sourceText]),
  );
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const compilerHost = ts.createCompilerHost(compilerOptions);
  const baseGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  const baseFileExists = compilerHost.fileExists.bind(compilerHost);
  const baseReadFile = compilerHost.readFile.bind(compilerHost);
  const resolutionHost: ts.ModuleResolutionHost = {
    fileExists: (fileName) => sourceMap.has(canonicalFileName(fileName)),
    readFile: (fileName) => sourceMap.get(canonicalFileName(fileName)),
  };
  compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const sourceText = sourceMap.get(canonicalFileName(fileName));
    return sourceText === undefined
      ? baseGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(fileName, sourceText, languageVersion, true);
  };
  compilerHost.fileExists = (fileName) =>
    sourceMap.has(canonicalFileName(fileName)) || baseFileExists(fileName);
  compilerHost.readFile = (fileName) =>
    sourceMap.get(canonicalFileName(fileName)) ?? baseReadFile(fileName);
  compilerHost.resolveModuleNames = (moduleNames, containingFile) =>
    moduleNames.map(
      (moduleName) =>
        ts.resolveModuleName(moduleName, containingFile, compilerOptions, resolutionHost)
          .resolvedModule,
    );
  return {
    program: ts.createProgram(
      inputs
        .filter((input) => input.kind !== 'dependency')
        .map((input) => canonicalFileName(input.fileName)),
      compilerOptions,
      compilerHost,
    ),
    diagnostics: [],
    getInfluencingFileHashes: () => hashSources(sourceMap),
  };
}

function createConsumerProgram(
  inputs: readonly EnvironmentSourceInput[],
  project: TypeScriptProjectSource,
  maxSources: number,
  maxSourceBytes: number,
): AnalysisProgramResult {
  let rootDirectory: string;
  try {
    rootDirectory = normalize(project.rootDirectory);
  } catch {
    return failure(
      'ENV_ANALYSIS_PROJECT_ROOT_INVALID',
      project.rootDirectory,
      'The consumer workspace root is not a valid path.',
    );
  }
  if (!isAbsolute(rootDirectory as Path)) {
    return failure(
      'ENV_ANALYSIS_PROJECT_ROOT_INVALID',
      rootDirectory,
      'The consumer workspace root must be an absolute path.',
    );
  }
  const tsconfigFileName = safeCanonicalAbsolute(rootDirectory, project.tsconfigFileName);
  if (!tsconfigFileName) {
    return failure(
      'ENV_ANALYSIS_TSCONFIG_INVALID',
      project.tsconfigFileName,
      'The consumer TypeScript configuration path is invalid.',
    );
  }
  if (!isWithin(rootDirectory, tsconfigFileName)) {
    return failure(
      'ENV_ANALYSIS_TSCONFIG_OUTSIDE_ROOT',
      tsconfigFileName,
      'The consumer TypeScript configuration is outside the project root.',
    );
  }

  const sourceMap = new Map<string, string>();
  let totalBytes = 0;
  let budgetExceeded: AnalysisResourceBudget | undefined;
  let sourceReadFailed = false;
  let unsafeRelativeImport = false;
  const readProjectFile = (fileName: string): string | undefined => {
    const canonical = canonicalFileName(fileName);
    if (!isWithin(rootDirectory, canonical)) return undefined;
    const existing = sourceMap.get(canonical);
    if (existing !== undefined) return existing;
    let text: string | undefined;
    try {
      text = project.readFile(canonical);
    } catch {
      sourceReadFailed = true;
      return undefined;
    }
    if (text === undefined) return undefined;
    const bytes = new TextEncoder().encode(text).byteLength;
    if (sourceMap.size + 1 > maxSources) {
      budgetExceeded = { kind: 'source-count', limit: maxSources };
      return undefined;
    }
    if (totalBytes + bytes > maxSourceBytes) {
      budgetExceeded = { kind: 'source-bytes', limit: maxSourceBytes };
      return undefined;
    }
    sourceMap.set(canonical, text);
    totalBytes += bytes;
    return text;
  };

  for (const input of inputs) {
    const fileName = safeCanonicalAbsolute(rootDirectory, input.fileName);
    if (!fileName || !isWithin(rootDirectory, fileName)) {
      return failure(
        'ENV_ANALYSIS_SOURCE_OUTSIDE_ROOT',
        fileName ?? input.fileName,
        'An analysis source is outside the consumer workspace root.',
      );
    }
    const current = sourceMap.get(fileName);
    if (current !== undefined && current !== input.sourceText) {
      return failure(
        'ENV_ANALYSIS_SOURCE_COLLISION',
        fileName,
        'Multiple analysis inputs provide different content for the same source path.',
      );
    }
    if (current === undefined) {
      const bytes = new TextEncoder().encode(input.sourceText).byteLength;
      if (sourceMap.size + 1 > maxSources) {
        return resourceFailure(tsconfigFileName, { kind: 'source-count', limit: maxSources });
      }
      if (totalBytes + bytes > maxSourceBytes) {
        return resourceFailure(tsconfigFileName, { kind: 'source-bytes', limit: maxSourceBytes });
      }
      sourceMap.set(fileName, input.sourceText);
      totalBytes += bytes;
    }
  }

  const tsconfigText = readProjectFile(tsconfigFileName);
  if (budgetExceeded) return resourceFailure(tsconfigFileName, budgetExceeded);
  if (sourceReadFailed)
    return failure(
      'ENV_ANALYSIS_SOURCE_READ_FAILED',
      tsconfigFileName,
      'A project source could not be read from the supplied workspace snapshot.',
    );
  if (tsconfigText === undefined) {
    return failure(
      'ENV_ANALYSIS_TSCONFIG_NOT_FOUND',
      tsconfigFileName,
      'The consumer TypeScript configuration could not be read.',
    );
  }
  const parsedJson = ts.parseConfigFileTextToJson(tsconfigFileName, tsconfigText);
  if (parsedJson.error)
    return failure(
      'ENV_ANALYSIS_TSCONFIG_INVALID',
      tsconfigFileName,
      'The consumer TypeScript configuration is malformed.',
    );

  const rootFiles = inputs
    .filter((input) => input.kind !== 'dependency')
    .map((input) => canonicalAbsolute(rootDirectory, input.fileName));
  const configHost: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    fileExists: (fileName) => readProjectFile(fileName) !== undefined,
    readFile: readProjectFile,
    readDirectory: (directory) =>
      rootFiles.filter((fileName) => isWithin(canonicalFileName(directory), fileName)),
  };
  const parsed = ts.parseJsonConfigFileContent(
    parsedJson.config,
    configHost,
    dirname(tsconfigFileName as Path),
    undefined,
    tsconfigFileName,
  );
  if (budgetExceeded) return resourceFailure(tsconfigFileName, budgetExceeded);
  if (sourceReadFailed)
    return failure(
      'ENV_ANALYSIS_SOURCE_READ_FAILED',
      tsconfigFileName,
      'A project source could not be read from the supplied workspace snapshot.',
    );
  if (parsed.errors.length > 0)
    return failure(
      'ENV_ANALYSIS_TSCONFIG_INVALID',
      tsconfigFileName,
      'The consumer TypeScript configuration or one of its inherited configurations is invalid.',
    );

  const compilerOptions: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  const defaultHost = ts.createCompilerHost(compilerOptions);
  const defaultLibDirectory = canonicalFileName(
    dirname(ts.getDefaultLibFilePath(compilerOptions) as Path),
  );
  const isDefaultLibrary = (fileName: string) =>
    isWithin(defaultLibDirectory, canonicalFileName(fileName));
  const baseGetSourceFile = defaultHost.getSourceFile.bind(defaultHost);
  const baseFileExists = defaultHost.fileExists.bind(defaultHost);
  const baseReadFile = defaultHost.readFile.bind(defaultHost);
  const resolutionHost: ts.ModuleResolutionHost = {
    fileExists: (fileName) =>
      isDefaultLibrary(fileName)
        ? baseFileExists(fileName)
        : readProjectFile(fileName) !== undefined,
    readFile: (fileName) =>
      isDefaultLibrary(fileName) ? baseReadFile(fileName) : readProjectFile(fileName),
    directoryExists: (directory) => isWithin(rootDirectory, canonicalFileName(directory)),
    getCurrentDirectory: () => rootDirectory,
    realpath: (fileName) => canonicalFileName(fileName),
    useCaseSensitiveFileNames: true,
  };
  const compilerHost: ts.CompilerHost = {
    ...defaultHost,
    getCurrentDirectory: () => rootDirectory,
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const canonical = canonicalFileName(fileName);
      if (isDefaultLibrary(canonical)) {
        return baseGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
      }
      const text = readProjectFile(canonical);
      return text === undefined
        ? undefined
        : ts.createSourceFile(canonical, text, languageVersion, true);
    },
    fileExists: (fileName) =>
      isDefaultLibrary(fileName)
        ? baseFileExists(fileName)
        : readProjectFile(fileName) !== undefined,
    readFile: (fileName) =>
      isDefaultLibrary(fileName) ? baseReadFile(fileName) : readProjectFile(fileName),
    resolveModuleNames: (moduleNames, containingFile) =>
      moduleNames.map((moduleName) => {
        if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
          const containingDirectory = dirname(containingFile as Path);
          if (relativeEscapesRoot(rootDirectory, containingDirectory, moduleName)) {
            unsafeRelativeImport = true;
          } else {
            const candidate = canonicalAbsolute(containingDirectory, moduleName);
            if (!isWithin(rootDirectory, candidate)) unsafeRelativeImport = true;
          }
        }
        return ts.resolveModuleName(moduleName, containingFile, compilerOptions, resolutionHost)
          .resolvedModule;
      }),
    resolveTypeReferenceDirectives: (
      references,
      containingFile,
      redirectedReference,
      options,
      containingFileMode,
    ) =>
      references.map(
        (reference) =>
          ts.resolveTypeReferenceDirective(
            typeof reference === 'string' ? reference : reference.fileName,
            containingFile,
            options,
            resolutionHost,
            redirectedReference,
            undefined,
            containingFileMode,
          ).resolvedTypeReferenceDirective,
      ),
  };

  let program: ts.Program;
  try {
    program = ts.createProgram(rootFiles, compilerOptions, compilerHost);
  } catch {
    if (budgetExceeded) return resourceFailure(tsconfigFileName, budgetExceeded);
    if (sourceReadFailed)
      return failure(
        'ENV_ANALYSIS_SOURCE_READ_FAILED',
        tsconfigFileName,
        'A project source could not be read from the supplied workspace snapshot.',
      );
    if (unsafeRelativeImport)
      return failure(
        'ENV_ANALYSIS_IMPORT_OUTSIDE_ROOT',
        tsconfigFileName,
        'A relative TypeScript import resolves outside the consumer workspace root.',
      );
    return failure(
      'ENV_ANALYSIS_PROGRAM_FAILED',
      tsconfigFileName,
      'The TypeScript program could not be created from the supplied workspace snapshot.',
    );
  }
  if (budgetExceeded) return resourceFailure(tsconfigFileName, budgetExceeded);
  if (sourceReadFailed)
    return failure(
      'ENV_ANALYSIS_SOURCE_READ_FAILED',
      tsconfigFileName,
      'A project source could not be read from the supplied workspace snapshot.',
    );
  if (unsafeRelativeImport)
    return failure(
      'ENV_ANALYSIS_IMPORT_OUTSIDE_ROOT',
      tsconfigFileName,
      'A relative TypeScript import resolves outside the consumer workspace root.',
    );
  return { program, diagnostics: [], getInfluencingFileHashes: () => hashSources(sourceMap) };
}

function failure(
  code: string,
  file: string,
  message: string,
  resourceBudget?: AnalysisResourceBudget,
): AnalysisProgramResult {
  return {
    diagnostics: [
      {
        code,
        severity: 'error',
        blocking: true,
        sourceLocation: { file },
        message,
        safeAction: resourceBudget
          ? `Reduce ${resourceBudget.kind} below the configured limit (${resourceBudget.limit}) and retry.`
          : 'Correct the project inputs and run analysis again.',
        resourceBudget,
      },
    ],
    getInfluencingFileHashes: () => [],
  };
}

function resourceFailure(file: string, budget: AnalysisResourceBudget): AnalysisProgramResult {
  return failure(
    'ENV_ANALYSIS_RESOURCE_LIMIT',
    file,
    `The project source graph exceeded the ${budget.kind} budget of ${budget.limit}. No partial analysis was returned.`,
    budget,
  );
}

function relativeEscapesRoot(root: string, base: string, relativePath: string): boolean {
  let normalizedPath: string;
  try {
    normalizedPath = normalize(relativePath);
  } catch {
    return true;
  }
  if (isAbsolute(normalizedPath as Path)) return !isWithin(root, normalizedPath);
  const rootDepth = root.split('/').filter(Boolean).length;
  let depth = base.split('/').filter(Boolean).length;
  for (const segment of relativePath.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      depth -= 1;
      if (depth < rootDepth) return true;
    } else {
      depth += 1;
    }
  }
  return false;
}

function canonicalAbsolute(base: string, fileName: string): string {
  const normalized = normalize(fileName);
  return isAbsolute(normalized) ? normalized : normalize(join(base as Path, normalized));
}

function safeCanonicalAbsolute(base: string, fileName: string): string | undefined {
  try {
    return canonicalAbsolute(base, fileName);
  } catch {
    return undefined;
  }
}

function hashSources(sourceMap: ReadonlyMap<string, string>): readonly InfluencingFileHash[] {
  return [...sourceMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fileName, sourceText]) => ({
      path: fileName,
      sha256: createHash('sha256').update(sourceText, 'utf8').digest('hex'),
    }));
}

function canonicalFileName(fileName: string): string {
  return fileName.replaceAll('\\', '/');
}

function isWithin(root: string, fileName: string): boolean {
  return fileName === root || fileName.startsWith(`${root.replace(/\/$/, '')}/`);
}
