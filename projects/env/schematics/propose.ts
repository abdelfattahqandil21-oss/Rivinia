import { SchematicsException } from '@angular-devkit/schematics';
import type { Rule } from '@angular-devkit/schematics';
import { createMutationProposalPlan } from './mutation-proposal.js';
import { isSafeConsumerPath, treePath } from './reviewed-apply.js';

interface ProposeOptions {
  readonly project?: string;
  readonly proposalFile: string;
  readonly planFile: string;
}

export default function propose(options: ProposeOptions): Rule {
  return async (tree, context) => {
    if (!isSafeConsumerPath(process.cwd(), options.planFile)) {
      throw new SchematicsException(
        'ENV_PLAN_PATH_INVALID: planFile must be inside the non-symlink consumer workspace.',
      );
    }
    if (options.proposalFile === options.planFile || tree.exists(treePath(options.planFile))) {
      throw new SchematicsException(
        'ENV_PLAN_FILE_COLLISION: choose a new explicit planFile that does not already exist.',
      );
    }
    const plan = await createMutationProposalPlan(tree, options.project, options.proposalFile);

    try {
      tree.create(treePath(options.planFile), `${JSON.stringify(plan, null, 2)}\n`);
    } catch {
      throw new SchematicsException(
        'ENV_PLAN_FILE_WRITE_FAILED: the explicit plan path is not writable.',
      );
    }
    context.logger.info(JSON.stringify({ plan, diagnostics: plan.conflicts }, null, 2));
    if (plan.status === 'blocked') {
      context.logger.error(
        'ENV_PLAN_PROPOSAL_BLOCKED: review the conflicts; Apply will reject this plan.',
      );
    } else {
      context.logger.warn(
        'ENV_PLAN_REVIEW_REQUIRED: inspect the plan and selected source files, then approve its digest and explicit decisions before Apply.',
      );
    }
    return tree;
  };
}
