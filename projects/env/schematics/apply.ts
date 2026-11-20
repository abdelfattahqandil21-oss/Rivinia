import type { Rule } from '@angular-devkit/schematics';
import { applyReviewedPlan } from './reviewed-apply.js';
import type { ReviewedApplyOptions } from './reviewed-apply.js';

export default function apply(options: ReviewedApplyOptions): Rule {
  return (tree, context) => applyReviewedPlan(tree, context, options);
}
