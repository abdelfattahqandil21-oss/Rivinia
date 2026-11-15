import { normalize } from '@angular-devkit/core';
import { SchematicsException } from '@angular-devkit/schematics';
import type { Rule } from '@angular-devkit/schematics';
import { verifyEnvironmentPlanReview } from './analysis/environment-plan.js';
import type { EnvironmentPlan } from './analysis/environment-plan-model.js';

interface ValidatePlanOptions {
  readonly plan: string;
  readonly reviewedDigest: string;
}

export default function validatePlan(options: ValidatePlanOptions): Rule {
  return (tree, context) => {
    const path = normalize(options.plan);
    if (path.startsWith('/') || path.split('/').includes('..') || !tree.exists(path)) {
      throw new SchematicsException(
        'ENV_PLAN_FILE_INVALID: provide an existing workspace-relative plan file.',
      );
    }
    let plan: EnvironmentPlan;
    try {
      plan = tree.readJson(path) as unknown as EnvironmentPlan;
    } catch {
      throw new SchematicsException('ENV_PLAN_FILE_INVALID: the plan file is not valid JSON.');
    }
    const verification = verifyEnvironmentPlanReview(plan, options.reviewedDigest);
    if (!verification.ok) {
      throw new SchematicsException(`${verification.code}: the reviewed plan was rejected.`);
    }
    context.logger.info(`ENV_PLAN_REVIEW_VALID: ${plan.integrity.digest}`);
    return tree;
  };
}
