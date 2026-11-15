import { normalize } from '@angular-devkit/core';
import { SchematicsException } from '@angular-devkit/schematics';
import type { Rule } from '@angular-devkit/schematics';
import { applyEnvironmentModelPlanV4ToTree } from './analysis/environment-model-plan-v4-apply.js';
import type { EnvironmentModelPlanV4 } from './analysis/environment-model-plan-v4.js';
import type { EnvironmentModelInspectionPlanV4 } from './analysis/environment-model-plan-v4.js';
import { hashText } from './analysis/environment-plan-utils.js';
import { createEnvironmentModelProposal } from './environment-model-proposal.js';
import { isSafeConsumerPath, treePath } from './reviewed-apply.js';

interface EnvironmentModelOptions {
  readonly project: string;
  readonly mode: 'proposal' | 'apply';
  readonly planFile: string;
  readonly inspectionPlanFile: string;
  readonly previewFile: string;
  readonly reviewedDigest?: string;
  readonly reviewedPreviewSha256?: string;
  readonly approveModelGeneration?: boolean;
}

export default function environmentModel(options: EnvironmentModelOptions): Rule {
  return async (tree, context) => {
    const artifactPaths = [options.planFile, options.inspectionPlanFile, options.previewFile];
    if (
      new Set(artifactPaths).size !== artifactPaths.length ||
      artifactPaths.some((path) => !isSafeConsumerPath(process.cwd(), path))
    ) {
      throw new SchematicsException(
        'ENV_MODEL_PATH_INVALID: plan, inspection, and preview paths must be distinct safe workspace-relative paths.',
      );
    }

    if (options.mode === 'proposal') {
      if (
        options.reviewedDigest ||
        options.reviewedPreviewSha256 ||
        options.approveModelGeneration
      ) {
        throw new SchematicsException(
          'ENV_MODEL_OPTIONS_CONFLICT: proposal mode cannot include Apply approval options.',
        );
      }
      if (artifactPaths.some((path) => tree.exists(treePath(path)))) {
        throw new SchematicsException(
          'ENV_MODEL_ARTIFACT_COLLISION: choose new plan, inspection, and preview paths.',
        );
      }
      const proposal = await createEnvironmentModelProposal(tree, options.project, (_root, path) =>
        isSafeConsumerPath(process.cwd(), path),
      );
      const modelPath = proposal.plan.operations[0]?.path;
      if (
        modelPath &&
        artifactPaths.some(
          (path) =>
            path === modelPath ||
            path.startsWith(`${modelPath}/`) ||
            modelPath.startsWith(`${path}/`),
        )
      ) {
        throw new SchematicsException(
          'ENV_MODEL_ARTIFACT_COLLISION: review artifacts cannot overlap the model destination.',
        );
      }
      tree.create(treePath(options.planFile), `${JSON.stringify(proposal.plan, null, 2)}\n`);
      tree.create(
        treePath(options.inspectionPlanFile),
        `${JSON.stringify(proposal.inspectionPlan, null, 2)}\n`,
      );
      if (proposal.plan.status === 'blocked') {
        context.logger.error(
          `ENV_MODEL_PROPOSAL_BLOCKED: ${proposal.plan.conflicts.map(({ code }) => code).join(', ')}`,
        );
      } else if (proposal.preview) {
        tree.create(treePath(options.previewFile), proposal.preview.text);
        context.logger.info(`ENV_MODEL_PROPOSAL_READY: ${proposal.plan.integrity.digest}`);
        context.logger.info(`ENV_MODEL_PREVIEW_SHA256: ${proposal.preview.contentSha256}`);
        context.logger.warn(
          'ENV_MODEL_REVIEW_REQUIRED: inspect the local preview and plan, then provide both reviewed digests and explicit model-generation approval to Apply.',
        );
      }
      return tree;
    }

    if (
      !options.approveModelGeneration ||
      !options.reviewedDigest ||
      !options.reviewedPreviewSha256
    ) {
      throw new SchematicsException(
        'ENV_MODEL_APPROVAL_REQUIRED: Apply requires a reviewed plan digest, reviewed preview SHA-256, and explicit --approve-model-generation.',
      );
    }
    const readJson = <T>(path: string, code: string): T => {
      const normalized = normalize(path);
      if (
        normalized.startsWith('/') ||
        normalized.split('/').includes('..') ||
        !tree.exists(normalized)
      )
        throw new SchematicsException(`${code}: a required review artifact is missing or unsafe.`);
      try {
        return JSON.parse(tree.readText(normalized)) as T;
      } catch {
        throw new SchematicsException(`${code}: a required review artifact is not valid JSON.`);
      }
    };
    const plan = readJson<EnvironmentModelPlanV4>(options.planFile, 'ENV_MODEL_PLAN_INVALID');
    const modelPath = plan.operations[0]?.path;
    if (
      modelPath &&
      artifactPaths.some(
        (path) =>
          path === modelPath ||
          path.startsWith(`${modelPath}/`) ||
          modelPath.startsWith(`${path}/`),
      )
    ) {
      throw new SchematicsException(
        'ENV_MODEL_ARTIFACT_COLLISION: review artifacts cannot overlap the model destination.',
      );
    }
    const inspectionPlan = readJson<EnvironmentModelInspectionPlanV4>(
      options.inspectionPlanFile,
      'ENV_MODEL_INSPECTION_INVALID',
    );
    const previewPath = normalize(options.previewFile);
    if (
      previewPath.startsWith('/') ||
      previewPath.split('/').includes('..') ||
      !tree.exists(previewPath)
    )
      throw new SchematicsException(
        'ENV_MODEL_PREVIEW_INVALID: the reviewed local preview is missing.',
      );
    const previewText = tree.readText(previewPath);
    if (hashText(previewText) !== options.reviewedPreviewSha256)
      throw new SchematicsException(
        'ENV_MODEL_PREVIEW_REVIEW_MISMATCH: the local preview changed.',
      );

    const applied = await applyEnvironmentModelPlanV4ToTree({
      tree,
      plan,
      inspectionPlan,
      reviewedPlanDigest: options.reviewedDigest,
      approval: {
        reviewedPlanDigest: options.reviewedDigest,
        reviewedPreviewSha256: options.reviewedPreviewSha256,
        acceptedDecisionIds: ['model-generation'],
      },
      consumerRoot: '/',
      isPathSafe: (_root, path) => isSafeConsumerPath(process.cwd(), path),
    });
    if (!applied.ok)
      throw new SchematicsException(`${applied.code}: reviewed model Apply was rejected.`);
    context.logger.info(`ENV_MODEL_CREATED: ${applied.path} sha256=${applied.contentSha256}`);
    return applied.tree;
  };
}
