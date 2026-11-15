"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnalysisProgram = createAnalysisProgram;
const tslib_1 = require("tslib");
const node_crypto_1 = require("node:crypto");
const core_1 = require("@angular-devkit/core");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
function createAnalysisProgram(inputs, options, maxSources, maxSourceBytes) {
    return options.project
        ? createConsumerProgram(inputs, options.project, maxSources, maxSourceBytes)
        : createSuppliedSourcesProgram(inputs);
}
function createSuppliedSourcesProgram(inputs) {
    const sourceMap = new Map(inputs.map((input) => [canonicalFileName(input.fileName), input.sourceText]));
    const compilerOptions = {
        target: typescript_1.default.ScriptTarget.ES2022,
        module: typescript_1.default.ModuleKind.ESNext,
        moduleResolution: typescript_1.default.ModuleResolutionKind.Bundler,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
    };
    const compilerHost = typescript_1.default.createCompilerHost(compilerOptions);
    const baseGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
    const baseFileExists = compilerHost.fileExists.bind(compilerHost);
    const baseReadFile = compilerHost.readFile.bind(compilerHost);
    const resolutionHost = {
        fileExists: (fileName) => sourceMap.has(canonicalFileName(fileName)),
        readFile: (fileName) => sourceMap.get(canonicalFileName(fileName)),
    };
    compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        const sourceText = sourceMap.get(canonicalFileName(fileName));
        return sourceText === undefined
            ? baseGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
            : typescript_1.default.createSourceFile(fileName, sourceText, languageVersion, true);
    };
    compilerHost.fileExists = (fileName) => sourceMap.has(canonicalFileName(fileName)) || baseFileExists(fileName);
    compilerHost.readFile = (fileName) => sourceMap.get(canonicalFileName(fileName)) ?? baseReadFile(fileName);
    compilerHost.resolveModuleNames = (moduleNames, containingFile) => moduleNames.map((moduleName) => typescript_1.default.resolveModuleName(moduleName, containingFile, compilerOptions, resolutionHost)
        .resolvedModule);
    return {
        program: typescript_1.default.createProgram(inputs
            .filter((input) => input.kind !== 'dependency')
            .map((input) => canonicalFileName(input.fileName)), compilerOptions, compilerHost),
        diagnostics: [],
        getInfluencingFileHashes: () => hashSources(sourceMap),
    };
}
function createConsumerProgram(inputs, project, maxSources, maxSourceBytes) {
    let rootDirectory;
    try {
        rootDirectory = (0, core_1.normalize)(project.rootDirectory);
    }
    catch {
        return failure('ENV_ANALYSIS_PROJECT_ROOT_INVALID', project.rootDirectory, 'The consumer workspace root is not a valid path.');
    }
    if (!(0, core_1.isAbsolute)(rootDirectory)) {
        return failure('ENV_ANALYSIS_PROJECT_ROOT_INVALID', rootDirectory, 'The consumer workspace root must be an absolute path.');
    }
    const tsconfigFileName = safeCanonicalAbsolute(rootDirectory, project.tsconfigFileName);
    if (!tsconfigFileName) {
        return failure('ENV_ANALYSIS_TSCONFIG_INVALID', project.tsconfigFileName, 'The consumer TypeScript configuration path is invalid.');
    }
    if (!isWithin(rootDirectory, tsconfigFileName)) {
        return failure('ENV_ANALYSIS_TSCONFIG_OUTSIDE_ROOT', tsconfigFileName, 'The consumer TypeScript configuration is outside the project root.');
    }
    const sourceMap = new Map();
    let totalBytes = 0;
    let budgetExceeded;
    let sourceReadFailed = false;
    let unsafeRelativeImport = false;
    const readProjectFile = (fileName) => {
        const canonical = canonicalFileName(fileName);
        if (!isWithin(rootDirectory, canonical))
            return undefined;
        const existing = sourceMap.get(canonical);
        if (existing !== undefined)
            return existing;
        let text;
        try {
            text = project.readFile(canonical);
        }
        catch {
            sourceReadFailed = true;
            return undefined;
        }
        if (text === undefined)
            return undefined;
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
            return failure('ENV_ANALYSIS_SOURCE_OUTSIDE_ROOT', fileName ?? input.fileName, 'An analysis source is outside the consumer workspace root.');
        }
        const current = sourceMap.get(fileName);
        if (current !== undefined && current !== input.sourceText) {
            return failure('ENV_ANALYSIS_SOURCE_COLLISION', fileName, 'Multiple analysis inputs provide different content for the same source path.');
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
    if (budgetExceeded)
        return resourceFailure(tsconfigFileName, budgetExceeded);
    if (sourceReadFailed)
        return failure('ENV_ANALYSIS_SOURCE_READ_FAILED', tsconfigFileName, 'A project source could not be read from the supplied workspace snapshot.');
    if (tsconfigText === undefined) {
        return failure('ENV_ANALYSIS_TSCONFIG_NOT_FOUND', tsconfigFileName, 'The consumer TypeScript configuration could not be read.');
    }
    const parsedJson = typescript_1.default.parseConfigFileTextToJson(tsconfigFileName, tsconfigText);
    if (parsedJson.error)
        return failure('ENV_ANALYSIS_TSCONFIG_INVALID', tsconfigFileName, 'The consumer TypeScript configuration is malformed.');
    const rootFiles = inputs
        .filter((input) => input.kind !== 'dependency')
        .map((input) => canonicalAbsolute(rootDirectory, input.fileName));
    const configHost = {
        useCaseSensitiveFileNames: true,
        fileExists: (fileName) => readProjectFile(fileName) !== undefined,
        readFile: readProjectFile,
        readDirectory: (directory) => rootFiles.filter((fileName) => isWithin(canonicalFileName(directory), fileName)),
    };
    const parsed = typescript_1.default.parseJsonConfigFileContent(parsedJson.config, configHost, (0, core_1.dirname)(tsconfigFileName), undefined, tsconfigFileName);
    if (budgetExceeded)
        return resourceFailure(tsconfigFileName, budgetExceeded);
    if (sourceReadFailed)
        return failure('ENV_ANALYSIS_SOURCE_READ_FAILED', tsconfigFileName, 'A project source could not be read from the supplied workspace snapshot.');
    if (parsed.errors.length > 0)
        return failure('ENV_ANALYSIS_TSCONFIG_INVALID', tsconfigFileName, 'The consumer TypeScript configuration or one of its inherited configurations is invalid.');
    const compilerOptions = { ...parsed.options, noEmit: true };
    const defaultHost = typescript_1.default.createCompilerHost(compilerOptions);
    const defaultLibDirectory = canonicalFileName((0, core_1.dirname)(typescript_1.default.getDefaultLibFilePath(compilerOptions)));
    const isDefaultLibrary = (fileName) => isWithin(defaultLibDirectory, canonicalFileName(fileName));
    const baseGetSourceFile = defaultHost.getSourceFile.bind(defaultHost);
    const baseFileExists = defaultHost.fileExists.bind(defaultHost);
    const baseReadFile = defaultHost.readFile.bind(defaultHost);
    const resolutionHost = {
        fileExists: (fileName) => isDefaultLibrary(fileName)
            ? baseFileExists(fileName)
            : readProjectFile(fileName) !== undefined,
        readFile: (fileName) => isDefaultLibrary(fileName) ? baseReadFile(fileName) : readProjectFile(fileName),
        directoryExists: (directory) => isWithin(rootDirectory, canonicalFileName(directory)),
        getCurrentDirectory: () => rootDirectory,
        realpath: (fileName) => canonicalFileName(fileName),
        useCaseSensitiveFileNames: true,
    };
    const compilerHost = {
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
                : typescript_1.default.createSourceFile(canonical, text, languageVersion, true);
        },
        fileExists: (fileName) => isDefaultLibrary(fileName)
            ? baseFileExists(fileName)
            : readProjectFile(fileName) !== undefined,
        readFile: (fileName) => isDefaultLibrary(fileName) ? baseReadFile(fileName) : readProjectFile(fileName),
        resolveModuleNames: (moduleNames, containingFile) => moduleNames.map((moduleName) => {
            if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
                const containingDirectory = (0, core_1.dirname)(containingFile);
                if (relativeEscapesRoot(rootDirectory, containingDirectory, moduleName)) {
                    unsafeRelativeImport = true;
                }
                else {
                    const candidate = canonicalAbsolute(containingDirectory, moduleName);
                    if (!isWithin(rootDirectory, candidate))
                        unsafeRelativeImport = true;
                }
            }
            return typescript_1.default.resolveModuleName(moduleName, containingFile, compilerOptions, resolutionHost)
                .resolvedModule;
        }),
        resolveTypeReferenceDirectives: (references, containingFile, redirectedReference, options, containingFileMode) => references.map((reference) => typescript_1.default.resolveTypeReferenceDirective(typeof reference === 'string' ? reference : reference.fileName, containingFile, options, resolutionHost, redirectedReference, undefined, containingFileMode).resolvedTypeReferenceDirective),
    };
    let program;
    try {
        program = typescript_1.default.createProgram(rootFiles, compilerOptions, compilerHost);
    }
    catch {
        if (budgetExceeded)
            return resourceFailure(tsconfigFileName, budgetExceeded);
        if (sourceReadFailed)
            return failure('ENV_ANALYSIS_SOURCE_READ_FAILED', tsconfigFileName, 'A project source could not be read from the supplied workspace snapshot.');
        if (unsafeRelativeImport)
            return failure('ENV_ANALYSIS_IMPORT_OUTSIDE_ROOT', tsconfigFileName, 'A relative TypeScript import resolves outside the consumer workspace root.');
        return failure('ENV_ANALYSIS_PROGRAM_FAILED', tsconfigFileName, 'The TypeScript program could not be created from the supplied workspace snapshot.');
    }
    if (budgetExceeded)
        return resourceFailure(tsconfigFileName, budgetExceeded);
    if (sourceReadFailed)
        return failure('ENV_ANALYSIS_SOURCE_READ_FAILED', tsconfigFileName, 'A project source could not be read from the supplied workspace snapshot.');
    if (unsafeRelativeImport)
        return failure('ENV_ANALYSIS_IMPORT_OUTSIDE_ROOT', tsconfigFileName, 'A relative TypeScript import resolves outside the consumer workspace root.');
    return { program, diagnostics: [], getInfluencingFileHashes: () => hashSources(sourceMap) };
}
function failure(code, file, message, resourceBudget) {
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
function resourceFailure(file, budget) {
    return failure('ENV_ANALYSIS_RESOURCE_LIMIT', file, `The project source graph exceeded the ${budget.kind} budget of ${budget.limit}. No partial analysis was returned.`, budget);
}
function relativeEscapesRoot(root, base, relativePath) {
    let normalizedPath;
    try {
        normalizedPath = (0, core_1.normalize)(relativePath);
    }
    catch {
        return true;
    }
    if ((0, core_1.isAbsolute)(normalizedPath))
        return !isWithin(root, normalizedPath);
    const rootDepth = root.split('/').filter(Boolean).length;
    let depth = base.split('/').filter(Boolean).length;
    for (const segment of relativePath.replaceAll('\\', '/').split('/')) {
        if (!segment || segment === '.')
            continue;
        if (segment === '..') {
            depth -= 1;
            if (depth < rootDepth)
                return true;
        }
        else {
            depth += 1;
        }
    }
    return false;
}
function canonicalAbsolute(base, fileName) {
    const normalized = (0, core_1.normalize)(fileName);
    return (0, core_1.isAbsolute)(normalized) ? normalized : (0, core_1.normalize)((0, core_1.join)(base, normalized));
}
function safeCanonicalAbsolute(base, fileName) {
    try {
        return canonicalAbsolute(base, fileName);
    }
    catch {
        return undefined;
    }
}
function hashSources(sourceMap) {
    return [...sourceMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([fileName, sourceText]) => ({
        path: fileName,
        sha256: (0, node_crypto_1.createHash)('sha256').update(sourceText, 'utf8').digest('hex'),
    }));
}
function canonicalFileName(fileName) {
    return fileName.replaceAll('\\', '/');
}
function isWithin(root, fileName) {
    return fileName === root || fileName.startsWith(`${root.replace(/\/$/, '')}/`);
}
