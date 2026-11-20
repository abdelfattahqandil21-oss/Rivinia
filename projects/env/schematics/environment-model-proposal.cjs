"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnvironmentModelProposal = createEnvironmentModelProposal;
const tslib_1 = require("tslib");
const node_path_1 = require("node:path");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const schematics_1 = require("@angular-devkit/schematics");
const typescript_project_program_js_1 = require("./analysis/typescript-project-program.cjs");
const environment_model_js_1 = require("./analysis/environment-model.cjs");
const environment_model_plan_v4_js_1 = require("./analysis/environment-model-plan-v4.cjs");
const workspace_discovery_js_1 = require("./analysis/workspace-discovery.cjs");
const tree_workspace_host_js_1 = require("./tree-workspace-host.cjs");
const inspect_workspace_js_1 = require("./inspect-workspace.cjs");
const MAX_MODEL_ANALYSIS_SOURCES = 128;
const MAX_MODEL_ANALYSIS_BYTES = 8_388_608;
async function createEnvironmentModelProposal(tree, projectName, isPathSafe) {
    const workspace = await (0, workspace_discovery_js_1.discoverWorkspace)((0, tree_workspace_host_js_1.createTreeWorkspaceHost)(tree), { projectName });
    if (!workspace.ok) {
        throw new schematics_1.SchematicsException(workspace.diagnostics.map(({ code }) => code).join(', ') || 'ENV_WORKSPACE_INVALID');
    }
    const projectRoot = node_path_1.posix.normalize(`/${workspace.project.root}`);
    const sourceRoot = node_path_1.posix.normalize(`/${workspace.project.sourceRoot ?? workspace.project.root}`);
    const sources = (0, inspect_workspace_js_1.collectEnvironmentInputs)(tree, sourceRoot).sort((left, right) => left.fileName.localeCompare(right.fileName));
    const sourcePaths = sources.map(({ fileName }) => fileName.replace(/^\//, ''));
    const tsconfigPath = (0, inspect_workspace_js_1.selectTsconfig)(tree, projectRoot, workspace.project.build);
    const absoluteTsconfig = tsconfigPath ?? node_path_1.posix.join(projectRoot, 'tsconfig.app.json');
    const programResult = tsconfigPath
        ? (0, typescript_project_program_js_1.createAnalysisProgram)(sources, {
            project: {
                rootDirectory: '/',
                tsconfigFileName: tsconfigPath,
                readFile: (fileName) => {
                    const path = node_path_1.posix.normalize(fileName);
                    return path.startsWith('/') && tree.exists(path) ? tree.readText(path) : undefined;
                },
            },
        }, MAX_MODEL_ANALYSIS_SOURCES, MAX_MODEL_ANALYSIS_BYTES)
        : undefined;
    const derived = programResult?.program
        ? (0, environment_model_js_1.deriveEnvironmentModel)(programResult.program, sources.map(({ fileName }) => fileName))
        : undefined;
    const inputPaths = [
        'angular.json',
        absoluteTsconfig.replace(/^\//, ''),
        ...sourcePaths,
        ...(programResult?.getInfluencingFileHashes().map(({ path }) => path.replace(/^\//, '')) ?? []),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
    const destinationPath = `${workspace.project.sourceRoot ?? workspace.project.root}/environment.model.ts`;
    const inputFilePaths = [...inputPaths, destinationPath].filter((path, index, paths) => paths.indexOf(path) === index);
    const currentInputs = inputFilePaths.map((path) => {
        const treePath = node_path_1.posix.normalize(`/${path}`);
        return tree.exists(treePath)
            ? { path: treePath, exists: true, sourceText: tree.readText(treePath) }
            : { path: treePath, exists: false };
    });
    return (0, environment_model_plan_v4_js_1.createEnvironmentModelPlanV4)({
        toolVersion: inspect_workspace_js_1.TOOL_VERSION,
        typescriptVersion: typescript_1.default.version,
        consumerRoot: '/',
        project: {
            name: workspace.project.name,
            root: workspace.project.root,
            sourceRoot: workspace.project.sourceRoot ?? workspace.project.root,
        },
        sourcePaths,
        tsconfigPath: absoluteTsconfig.replace(/^\//, ''),
        inputPaths,
        modelProof: derived?.proof,
        currentInputs,
        isPathSafe,
    });
}
