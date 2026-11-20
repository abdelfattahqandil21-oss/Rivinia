import { SchematicsException } from '@angular-devkit/schematics';
import type { Tree } from '@angular-devkit/schematics';
import { createMutationEnvironmentPlan } from './analysis/environment-plan.js';
import type { MutationEnvironmentPlan } from './analysis/environment-plan-model.js';
import { getUnsupportedRenderModes } from './analysis/render-mode.js';
import { inspectWorkspaceTree } from './inspect-workspace.js';
import { isSafeConsumerPath, isSafeConsumerReadPath, treePath } from './reviewed-apply.js';

export interface MutationProposalInput {
  readonly environment: string;
  readonly sourcePath: string;
  readonly destinationPath: string;
  readonly configuration: string;
  readonly configurationStack: readonly string[];
  readonly replacePath: string;
}

export async function createMutationProposalPlan(
  tree: Tree,
  project: string | undefined,
  proposalFile: string,
): Promise<MutationEnvironmentPlan> {
  if (!isSafeConsumerPath(process.cwd(), proposalFile)) {
    throw new SchematicsException(
      'ENV_PLAN_PATH_INVALID: proposalFile must be inside the non-symlink consumer workspace.',
    );
  }

  let proposalInput: { readonly proposals: readonly MutationProposalInput[] };
  try {
    proposalInput = JSON.parse(tree.readText(treePath(proposalFile)));
  } catch {
    throw new SchematicsException(
      'ENV_PROPOSAL_FILE_INVALID: proposalFile must be existing JSON with a proposals array.',
    );
  }
  if (!isProposalDocument(proposalInput)) {
    throw new SchematicsException(
      'ENV_PROPOSAL_FILE_INVALID: proposal fields are invalid or unknown.',
    );
  }

  for (const proposal of proposalInput.proposals) {
    for (const path of [proposal.sourcePath, proposal.destinationPath, proposal.replacePath]) {
      if (!isSafeConsumerPath(process.cwd(), path)) {
        throw new SchematicsException(
          'ENV_PLAN_PATH_INVALID: proposal paths must remain inside the non-symlink consumer workspace.',
        );
      }
    }
  }

  const inspected = await inspectWorkspaceTree(tree, project);
  if (!inspected.plan || inspected.plan.status !== 'reviewable') {
    throw new SchematicsException(
      inspected.diagnostics.join('\n') ||
        'ENV_INSPECT_BLOCKED: resolve diagnostics before proposing changes.',
    );
  }
  const unsupportedModes = new Set(
    proposalInput.proposals.flatMap(({ configurationStack }) =>
      getUnsupportedRenderModes(inspected.project.build, [configurationStack]),
    ),
  );
  if (unsupportedModes.size > 0) {
    throw new SchematicsException(
      `ENV_RENDER_MODE_UNSUPPORTED: mutation was refused without consumer file changes because the selected effective build configuration enables ${[...unsupportedModes].sort().join(', ')}. Read-only Inspect remains available; SSR/SSG behavior is not verified.`,
    );
  }
  const existingFiles = proposalInput.proposals
    .filter(({ destinationPath }) => tree.exists(treePath(destinationPath)))
    .map(({ destinationPath }) => ({ path: treePath(destinationPath) }));
  return createMutationEnvironmentPlan({
    inspectionPlan: inspected.plan,
    consumerRoot: '/',
    isPathSafe: (_root, relativePath) => isSafeConsumerPath(process.cwd(), relativePath),
    isReadPathSafe: (_root, relativePath) =>
      isSafeConsumerReadPath(process.cwd(), relativePath),
    existingFiles,
    otherBuildTargets: inspected.buildTargets,
    proposals: proposalInput.proposals,
  });
}

function isProposalDocument(
  value: unknown,
): value is { readonly proposals: readonly MutationProposalInput[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (
    Object.keys(document).some((key) => key !== 'proposals') ||
    !Array.isArray(document['proposals'])
  ) {
    return false;
  }
  return document['proposals'].every((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const proposal = candidate as Record<string, unknown>;
    const allowed = [
      'environment',
      'sourcePath',
      'destinationPath',
      'configuration',
      'configurationStack',
      'replacePath',
    ];
    return (
      Object.keys(proposal).length === allowed.length &&
      Object.keys(proposal).every((key) => allowed.includes(key)) &&
      ['environment', 'sourcePath', 'destinationPath', 'configuration', 'replacePath'].every(
        (key) => typeof proposal[key] === 'string' && proposal[key].length > 0,
      ) &&
      Array.isArray(proposal['configurationStack']) &&
      proposal['configurationStack'].length > 0 &&
      proposal['configurationStack'].every((configuration) => typeof configuration === 'string')
    );
  });
}
