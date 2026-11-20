import { posix } from 'node:path';
import ts from 'typescript';
import { SchematicsException } from '@angular-devkit/schematics';
import type { Tree } from '@angular-devkit/schematics';
import { createAnalysisProgram } from './analysis/typescript-project-program.js';
import { deriveEnvironmentModel } from './analysis/environment-model.js';
import { createEnvironmentModelPlanV4 } from './analysis/environment-model-plan-v4.js';
import type { EnvironmentModelPlanV4Result } from './analysis/environment-model-plan-v4.js';
import type { EnvironmentPlanCurrentInput } from './analysis/environment-plan-model.js';
import { discoverWorkspace } from './analysis/workspace-discovery.js';
import { createTreeWorkspaceHost } from './tree-workspace-host.js';
import { collectEnvironmentInputs, selectTsconfig, TOOL_VERSION } from './inspect-workspace.js';

const MAX_MODEL_ANALYSIS_SOURCES = 128;
const MAX_MODEL_ANALYSIS_BYTES = 8_388_608;

export async function createEnvironmentModelProposal(
  tree: Tree,
  projectName: string,
  isPathSafe: (root: string, relativePath: string) => boolean,
): Promise<EnvironmentModelPlanV4Result> {
  const workspace = await discoverWorkspace(createTreeWorkspaceHost(tree), { projectName });
  if (!workspace.ok) {
    throw new SchematicsException(
      workspace.diagnostics.map(({ code }) => code).join(', ') || 'ENV_WORKSPACE_INVALID',
    );
  }
  const projectRoot = posix.normalize(`/${workspace.project.root}`);
  const sourceRoot = posix.normalize(`/${workspace.project.sourceRoot ?? workspace.project.root}`);
  const sources = collectEnvironmentInputs(tree, sourceRoot).sort((left, right) =>
    left.fileName.localeCompare(right.fileName),
  );
  const sourcePaths = sources.map(({ fileName }) => fileName.replace(/^\//, ''));
  const tsconfigPath = selectTsconfig(tree, projectRoot, workspace.project.build);
  const absoluteTsconfig = tsconfigPath ?? posix.join(projectRoot, 'tsconfig.app.json');
  const programResult = tsconfigPath
    ? createAnalysisProgram(
        sources,
        {
          project: {
            rootDirectory: '/',
            tsconfigFileName: tsconfigPath,
            readFile: (fileName) => {
              const path = posix.normalize(fileName);
              return path.startsWith('/') && tree.exists(path) ? tree.readText(path) : undefined;
            },
          },
        },
        MAX_MODEL_ANALYSIS_SOURCES,
        MAX_MODEL_ANALYSIS_BYTES,
      )
    : undefined;
  const derived = programResult?.program
    ? deriveEnvironmentModel(
        programResult.program,
        sources.map(({ fileName }) => fileName),
      )
    : undefined;
  const inputPaths = [
    'angular.json',
    absoluteTsconfig.replace(/^\//, ''),
    ...sourcePaths,
    ...(programResult?.getInfluencingFileHashes().map(({ path }) => path.replace(/^\//, '')) ?? []),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
  const destinationPath = `${workspace.project.sourceRoot ?? workspace.project.root}/environment.model.ts`;
  const inputFilePaths = [...inputPaths, destinationPath].filter(
    (path, index, paths) => paths.indexOf(path) === index,
  );
  const currentInputs: EnvironmentPlanCurrentInput[] = inputFilePaths.map((path) => {
    const treePath = posix.normalize(`/${path}`);
    return tree.exists(treePath)
      ? { path: treePath, exists: true, sourceText: tree.readText(treePath) }
      : { path: treePath, exists: false };
  });

  return createEnvironmentModelPlanV4({
    toolVersion: TOOL_VERSION,
    typescriptVersion: ts.version,
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
