import { SchematicsException } from '@angular-devkit/schematics';
import type { Rule } from '@angular-devkit/schematics';
import { inspectWorkspaceTree } from './inspect-workspace.js';

interface InspectOptions {
  readonly project?: string;
}

export default function inspect(options: InspectOptions): Rule {
  return async (tree, context) => {
    const result = await inspectWorkspaceTree(tree, options.project);
    context.logger.info(
      JSON.stringify({ plan: result.plan ?? null, diagnostics: result.diagnostics }, null, 2),
    );
    if (!result.plan || result.plan.status === 'blocked') {
      throw new SchematicsException(result.diagnostics.join('\n') || 'ENV_INSPECT_BLOCKED');
    }
    return tree;
  };
}
