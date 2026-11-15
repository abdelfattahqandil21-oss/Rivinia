"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_VERSION = void 0;
exports.inspectWorkspaceTree = inspectWorkspaceTree;
exports.collectEnvironmentInputs = collectEnvironmentInputs;
exports.selectTsconfig = selectTsconfig;
const node_path_1 = require("node:path");
const environment_analysis_js_1 = require("./analysis/environment-analysis.cjs");
const environment_plan_js_1 = require("./analysis/environment-plan.cjs");
const render_mode_js_1 = require("./analysis/render-mode.cjs");
const workspace_discovery_js_1 = require("./analysis/workspace-discovery.cjs");
const tree_workspace_host_js_1 = require("./tree-workspace-host.cjs");
exports.TOOL_VERSION = '1.0.5';
const ENVIRONMENT_FILE = /^environment(?:\.([A-Za-z0-9_-]+))?\.ts$/;
async function inspectWorkspaceTree(tree, projectName) {
    const discovered = await (0, workspace_discovery_js_1.discoverWorkspace)((0, tree_workspace_host_js_1.createTreeWorkspaceHost)(tree), { projectName });
    if (!discovered.ok) {
        return { diagnostics: discovered.diagnostics.map(formatWorkspaceDiagnostic) };
    }
    const workspacePath = '/angular.json';
    if (!tree.exists(workspacePath)) {
        return { diagnostics: ['ENV_WORKSPACE_NOT_FOUND: angular.json was not found.'] };
    }
    const projectRoot = node_path_1.posix.normalize(`/${discovered.project.root}`);
    const sourceRoot = node_path_1.posix.normalize(`/${discovered.project.sourceRoot ?? discovered.project.root}`);
    const environmentInputs = collectEnvironmentInputs(tree, sourceRoot);
    const tsconfigPath = selectTsconfig(tree, projectRoot, discovered.project.build);
    const workspaceDiagnostics = discovered.diagnostics;
    let analysis;
    if (!tsconfigPath) {
        analysis = {
            environments: [],
            fields: [],
            diagnostics: [missingTsconfigDiagnostic(node_path_1.posix.join(projectRoot, 'tsconfig.app.json'))],
            influencingFileHashes: [],
        };
    }
    else {
        analysis = (0, environment_analysis_js_1.analyzeEnvironmentSources)(environmentInputs, {
            project: {
                rootDirectory: '/',
                tsconfigFileName: tsconfigPath,
                readFile: (fileName) => {
                    const treePath = node_path_1.posix.normalize(fileName);
                    return tree.exists(treePath) ? tree.readText(treePath) : undefined;
                },
            },
        });
    }
    const plan = (0, environment_plan_js_1.createReadOnlyEnvironmentPlan)({
        toolVersion: exports.TOOL_VERSION,
        consumerRoot: '/',
        workspaceFile: {
            path: workspacePath,
            sourceText: tree.readText(workspacePath),
        },
        project: discovered.project,
        workspaceDiagnostics,
        analysis,
    });
    return {
        plan,
        diagnostics: [
            ...plan.conflicts.map(({ code, message }) => `${code}: ${message}`),
            ...((0, render_mode_js_1.getUnsupportedRenderModes)(discovered.project.build).length
                ? [
                    `ENV_RENDER_MODE_UNSUPPORTED: read-only Inspect is available, but SSR/SSG build configurations are outside the verified mutation scope (${(0, render_mode_js_1.getUnsupportedRenderModes)(discovered.project.build).join(', ')}).`,
                ]
                : []),
        ],
        project: discovered.project,
        buildTargets: discovered.buildTargets,
    };
}
function collectEnvironmentInputs(tree, sourceRoot) {
    const inputs = [];
    const prefix = sourceRoot.endsWith('/') ? sourceRoot : `${sourceRoot}/`;
    tree.visit((filePath) => {
        if (!filePath.startsWith(prefix))
            return;
        const match = ENVIRONMENT_FILE.exec(node_path_1.posix.basename(filePath));
        if (!match)
            return;
        const sourceText = tree.readText(filePath);
        inputs.push({
            name: match[1] ?? 'base',
            fileName: node_path_1.posix.resolve('/', filePath),
            sourceText,
        });
    });
    return inputs;
}
function selectTsconfig(tree, projectRoot, build) {
    const defaultConfiguration = build?.defaultConfiguration;
    const configured = [
        defaultConfiguration
            ? build?.configurationsByName[defaultConfiguration]?.['tsConfig']
            : undefined,
        build?.options['tsConfig'],
    ].filter((value) => typeof value === 'string');
    const candidates = [
        ...configured.map((value) => node_path_1.posix.resolve('/', value)),
        node_path_1.posix.join(projectRoot, 'tsconfig.app.json'),
        node_path_1.posix.join(projectRoot, 'tsconfig.json'),
        '/tsconfig.json',
    ];
    return candidates.find((path, index) => candidates.indexOf(path) === index && tree.exists(path));
}
function missingTsconfigDiagnostic(path) {
    return {
        code: 'ENV_INSPECT_TSCONFIG_REQUIRED',
        severity: 'error',
        blocking: true,
        path,
        message: 'A TypeScript project configuration is required for environment inspection.',
        safeAction: 'Add a project tsconfig and run Inspect again.',
    };
}
function formatWorkspaceDiagnostic(diagnostic) {
    if (diagnostic.code !== 'ENV_WORKSPACE_PARSE_INVALID') {
        return `${diagnostic.code}: ${diagnostic.message}`;
    }
    const { file, line, column } = diagnostic.sourceLocation ?? {};
    const location = line !== undefined && column !== undefined ? ` Location: line ${line}, column ${column}.` : '';
    return `${diagnostic.code}: ${diagnostic.message}${location} Safe next step: ${diagnostic.safeAction}`;
}
