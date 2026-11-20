import { posix } from 'node:path';
import type { Tree } from '@angular-devkit/schematics';
import { analyzeEnvironmentSources } from './analysis/environment-analysis.js';
import type { AnalysisDiagnostic, EnvironmentSourceInput } from './analysis/analysis-model.js';
import { createReadOnlyEnvironmentPlan } from './analysis/environment-plan.js';
import type { InspectionEnvironmentPlan } from './analysis/environment-plan-model.js';
import { getUnsupportedRenderModes } from './analysis/render-mode.js';
import { discoverWorkspace } from './analysis/workspace-discovery.js';
import type { DiscoveredProject, DiscoveredTarget } from './analysis/workspace-discovery.js';
import { createTreeWorkspaceHost } from './tree-workspace-host.js';

export const TOOL_VERSION = '__RIVINIA_ENV_PACKAGE_VERSION__';
const ENVIRONMENT_FILE = /^environment(?:\.([A-Za-z0-9_-]+))?\.ts$/;

export type WorkspaceInspectionResult =
  | {
      readonly plan: InspectionEnvironmentPlan;
      readonly diagnostics: readonly string[];
      readonly project: DiscoveredProject;
      readonly buildTargets: readonly {
        readonly projectName: string;
        readonly target?: DiscoveredTarget;
      }[];
    }
  | { readonly plan?: undefined; readonly diagnostics: readonly string[] };

export async function inspectWorkspaceTree(
  tree: Tree,
  projectName?: string,
): Promise<WorkspaceInspectionResult> {
  const discovered = await discoverWorkspace(createTreeWorkspaceHost(tree), { projectName });
  if (!discovered.ok) {
    return { diagnostics: discovered.diagnostics.map(formatWorkspaceDiagnostic) };
  }

  const workspacePath = '/angular.json';
  if (!tree.exists(workspacePath)) {
    return { diagnostics: ['ENV_WORKSPACE_NOT_FOUND: angular.json was not found.'] };
  }

  const projectRoot = posix.normalize(`/${discovered.project.root}`);
  const sourceRoot = posix.normalize(
    `/${discovered.project.sourceRoot ?? discovered.project.root}`,
  );
  const environmentInputs = collectEnvironmentInputs(tree, sourceRoot);
  const tsconfigPath = selectTsconfig(tree, projectRoot, discovered.project.build);
  const workspaceDiagnostics = discovered.diagnostics;
  let analysis;
  if (!tsconfigPath) {
    analysis = {
      environments: [],
      fields: [],
      diagnostics: [missingTsconfigDiagnostic(posix.join(projectRoot, 'tsconfig.app.json'))],
      influencingFileHashes: [],
    };
  } else {
    analysis = analyzeEnvironmentSources(environmentInputs, {
      project: {
        rootDirectory: '/',
        tsconfigFileName: tsconfigPath,
        readFile: (fileName) => {
          const treePath = posix.normalize(fileName);
          return tree.exists(treePath) ? tree.readText(treePath) : undefined;
        },
      },
    });
  }

  const plan = createReadOnlyEnvironmentPlan({
    toolVersion: TOOL_VERSION,
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
      ...(getUnsupportedRenderModes(discovered.project.build).length
        ? [
            `ENV_RENDER_MODE_UNSUPPORTED: read-only Inspect is available, but SSR/SSG build configurations are outside the verified mutation scope (${getUnsupportedRenderModes(discovered.project.build).join(', ')}).`,
          ]
        : []),
    ],
    project: discovered.project,
    buildTargets: discovered.buildTargets,
  };
}

export function collectEnvironmentInputs(tree: Tree, sourceRoot: string): EnvironmentSourceInput[] {
  const inputs: EnvironmentSourceInput[] = [];
  const prefix = sourceRoot.endsWith('/') ? sourceRoot : `${sourceRoot}/`;
  tree.visit((filePath) => {
    if (!filePath.startsWith(prefix)) return;
    const match = ENVIRONMENT_FILE.exec(posix.basename(filePath));
    if (!match) return;
    const sourceText = tree.readText(filePath);
    inputs.push({
      name: match[1] ?? 'base',
      fileName: posix.resolve('/', filePath),
      sourceText,
    });
  });
  return inputs;
}

export function selectTsconfig(
  tree: Tree,
  projectRoot: string,
  build: DiscoveredTarget | undefined,
): string | undefined {
  const defaultConfiguration = build?.defaultConfiguration;
  const configured = [
    defaultConfiguration
      ? build?.configurationsByName[defaultConfiguration]?.['tsConfig']
      : undefined,
    build?.options['tsConfig'],
  ].filter((value): value is string => typeof value === 'string');
  const candidates = [
    ...configured.map((value) => posix.resolve('/', value)),
    posix.join(projectRoot, 'tsconfig.app.json'),
    posix.join(projectRoot, 'tsconfig.json'),
    '/tsconfig.json',
  ];
  return candidates.find((path, index) => candidates.indexOf(path) === index && tree.exists(path));
}

function missingTsconfigDiagnostic(path: string): AnalysisDiagnostic {
  return {
    code: 'ENV_INSPECT_TSCONFIG_REQUIRED',
    severity: 'error',
    blocking: true,
    path,
    message: 'A TypeScript project configuration is required for environment inspection.',
    safeAction: 'Add a project tsconfig and run Inspect again.',
  };
}

function formatWorkspaceDiagnostic(diagnostic: {
  readonly code: string;
  readonly message: string;
  readonly sourceLocation?: {
    readonly file: string;
    readonly line?: number;
    readonly column?: number;
  };
  readonly safeAction: string;
}) {
  if (diagnostic.code !== 'ENV_WORKSPACE_PARSE_INVALID') {
    return `${diagnostic.code}: ${diagnostic.message}`;
  }
  const { file, line, column } = diagnostic.sourceLocation ?? {};
  const location =
    line !== undefined && column !== undefined ? ` Location: line ${line}, column ${column}.` : '';
  return `${diagnostic.code}: ${diagnostic.message}${location} Safe next step: ${diagnostic.safeAction}`;
}
