"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverWorkspace = discoverWorkspace;
const core_1 = require("@angular-devkit/core");
const jsonc_parser_1 = require("jsonc-parser");
const rxjs_1 = require("rxjs");
const APPLICATION_BUILDERS = new Set([
    '@angular/build:application',
    '@angular-devkit/build-angular:application',
]);
const MAX_WORKSPACE_PROJECTS = 256;
async function discoverWorkspace(host, options = {}) {
    const workspacePath = options.workspacePath ?? '/angular.json';
    let workspace;
    const workspaceBytes = await (0, rxjs_1.lastValueFrom)(host.read((0, core_1.normalize)(workspacePath))).catch(() => undefined);
    if (workspaceBytes) {
        const workspaceText = new TextDecoder('utf-8', { ignoreBOM: true }).decode(workspaceBytes);
        const parseErrors = [];
        (0, jsonc_parser_1.parse)(workspaceText, parseErrors, { allowTrailingComma: true, disallowComments: false });
        const firstParseError = parseErrors[0];
        if (firstParseError) {
            const sourcePosition = positionAt(workspaceText, firstParseError.offset);
            return failure({
                ...diagnostic('ENV_WORKSPACE_PARSE_INVALID', `Cannot parse angular.json. JSONC parser reported ${(0, jsonc_parser_1.printParseErrorCode)(firstParseError.error)}.`, workspacePath, 'Fix angular.json and rerun Inspect. No application files were modified.', workspacePath),
                sourceLocation: { file: workspacePath, ...sourcePosition },
            });
        }
    }
    try {
        ({ workspace } = await core_1.workspaces.readWorkspace(workspacePath, core_1.workspaces.createWorkspaceHost(host), core_1.workspaces.WorkspaceFormat.JSON));
    }
    catch {
        const exists = await (0, rxjs_1.lastValueFrom)(host.exists((0, core_1.normalize)(workspacePath))).catch(() => false);
        return failure(diagnostic(exists ? 'ENV_WORKSPACE_INVALID' : 'ENV_WORKSPACE_NOT_FOUND', exists
            ? `Workspace configuration at ${workspacePath} is invalid.`
            : `Workspace configuration was not found at ${workspacePath}.`, workspacePath, 'Provide a valid Angular workspace configuration and run discovery again.'));
    }
    const projects = [...workspace.projects.entries()];
    if (projects.length > MAX_WORKSPACE_PROJECTS) {
        return failure(diagnostic('ENV_WORKSPACE_RESOURCE_LIMIT', `Workspace project count ${projects.length} exceeds the output-path discovery limit of ${MAX_WORKSPACE_PROJECTS}.`, workspacePath, 'Reduce the workspace project count or inspect a smaller workspace before proposing environment changes.'));
    }
    const selected = options.projectName
        ? projects.filter(([name, project]) => name === options.projectName && project.extensions['projectType'] === 'application')
        : projects.filter(([, project]) => project.extensions['projectType'] === 'application');
    if (selected.length !== 1) {
        const code = selected.length === 0
            ? 'ENV_WORKSPACE_PROJECT_NOT_FOUND'
            : 'ENV_WORKSPACE_PROJECT_SELECTION_REQUIRED';
        return failure(diagnostic(code, selected.length === 0
            ? `No matching application project was found${options.projectName ? ` for ${options.projectName}` : ''}.`
            : 'More than one application project is available; select one explicitly.', workspacePath, 'Select exactly one existing application project before continuing.'));
    }
    const [name, definition] = selected[0];
    const buildTargets = projects.map(([projectName, projectDefinition]) => ({
        projectName,
        target: readTarget(projectDefinition.targets.get('build'), 'build'),
    }));
    const unsafeField = isUnsafeWorkspacePath(definition.root) ||
        (definition.sourceRoot !== undefined && isUnsafeWorkspacePath(definition.sourceRoot));
    if (unsafeField) {
        const field = isUnsafeWorkspacePath(definition.root) ? 'root' : 'sourceRoot';
        return failure(diagnostic('ENV_WORKSPACE_PATH_UNSAFE', `Project ${field} must remain inside the workspace.`, workspacePath, 'Correct the project metadata so its paths stay within the workspace.', `projects.${name}.${field}`));
    }
    const build = readTarget(definition.targets.get('build'), 'build');
    const serve = readTarget(definition.targets.get('serve'), 'serve');
    const diagnostics = [];
    if (build && !APPLICATION_BUILDERS.has(build.builder)) {
        diagnostics.push(diagnostic('ENV_WORKSPACE_BUILDER_UNSUPPORTED', `Build target ${name}:build uses unsupported builder ${build.builder}.`, workspacePath, 'Use a verified Angular application builder or stop before requesting edits.', `projects.${name}.targets.build.builder`));
    }
    return {
        ok: true,
        project: {
            name,
            projectType: typeof definition.extensions['projectType'] === 'string'
                ? definition.extensions['projectType']
                : undefined,
            root: definition.root,
            sourceRoot: definition.sourceRoot,
            build,
            serve,
        },
        diagnostics,
        buildTargets,
    };
}
function positionAt(text, offset) {
    const precedingLines = text.slice(0, offset).split(/\r\n|\r|\n/);
    return {
        line: precedingLines.length,
        column: precedingLines[precedingLines.length - 1].length + 1,
    };
}
function readTarget(target, name) {
    if (!target)
        return undefined;
    const configurationsByName = target.configurations ?? {};
    const options = target.options ?? {};
    const result = {
        name,
        builder: target.builder,
        defaultConfiguration: target.defaultConfiguration,
        configurations: Object.keys(configurationsByName),
        configurationsByName,
        options,
    };
    if (name === 'build') {
        return {
            ...result,
            outputPath: options['outputPath'],
            builderSupport: APPLICATION_BUILDERS.has(target.builder) ? 'candidate' : 'unsupported',
        };
    }
    return result;
}
function isUnsafeWorkspacePath(value) {
    const normalized = value.replaceAll('\\', '/');
    if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized))
        return true;
    let depth = 0;
    for (const segment of normalized.split('/')) {
        if (!segment || segment === '.')
            continue;
        if (segment === '..') {
            if (depth === 0)
                return true;
            depth -= 1;
        }
        else {
            depth += 1;
        }
    }
    return false;
}
function diagnostic(code, message, file, safeAction, path) {
    return {
        code,
        severity: 'error',
        blocking: true,
        message,
        path,
        sourceLocation: { file },
        safeAction,
    };
}
function failure(diagnostic) {
    return { ok: false, diagnostics: [diagnostic] };
}
