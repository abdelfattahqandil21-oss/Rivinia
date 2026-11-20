import type { AnalysisDiagnostic, AnalyzedProperty } from './analysis-model.js';

export const ENVIRONMENT_PLAN_SCHEMA_VERSION = 3;

export interface EnvironmentPlanInputFile {
  readonly path: string;
  readonly sourceText: string;
}

export interface EnvironmentPlanCurrentInput {
  readonly path: string;
  readonly exists: boolean;
  readonly sourceText?: string;
}

export interface EnvironmentPlanInputFingerprint {
  readonly path: string;
  readonly sha256: string;
  readonly presence: 'present' | 'absent';
}

export interface EnvironmentPlanDecision {
  readonly id: string;
  readonly choice: string;
  readonly authority: 'approved-policy' | 'explicit-proposal';
}

export interface InspectionOperation {
  readonly id: string;
  readonly order: number;
  readonly kind: 'inspect-environment-source';
  readonly environment: string;
  /** Canonical path relative to the consumer workspace root. */
  readonly sourcePath: string;
  readonly transferSafety: {
    readonly strategy: 'verbatim-sibling-copy';
    readonly status: 'safe' | 'blocked';
    readonly reason?:
      'dynamic-environment-value' | 'module-location-reference' | 'unsupported-top-level-effect';
  };
  readonly properties: readonly PlanPropertyObservation[];
}

export interface CreateEnvironmentFileOperation {
  readonly id: string;
  readonly order: number;
  readonly kind: 'create-environment-file';
  /** Canonical path relative to the consumer workspace root. */
  readonly path: string;
  readonly environment: string;
  readonly replacement: { readonly configuration: string; readonly replace: string };
  readonly derivation: {
    readonly kind: 'copy-verbatim-source-to-sibling';
    readonly sourcePath: string;
    readonly sourceEnvironment: string;
    readonly sourceTransferSafety: InspectionOperation['transferSafety'];
    readonly requiredInputPath: string;
  };
}

export interface FileReplacementEntry {
  readonly replace: string;
  readonly with: string;
}

export interface AddFileReplacementOperation {
  readonly id: string;
  readonly order: number;
  readonly kind: 'add-file-replacement';
  readonly target: 'build';
  readonly targetName: string;
  readonly configuration: string;
  /** Effective Angular configuration composition, from left to right. */
  readonly configurationStack: readonly string[];
  readonly replace: string;
  readonly with: string;
  readonly requiredInputPath: string;
  readonly changePreview: {
    readonly mode: 'append-if-absent';
    readonly scope: {
      readonly workspaceFile: 'angular.json';
      readonly project: string;
      readonly target: string;
      readonly configuration: string;
      readonly property: 'fileReplacements';
    };
    readonly existingEntries: readonly FileReplacementEntry[];
    readonly resultingEntries: readonly FileReplacementEntry[];
    readonly effectiveBefore: readonly FileReplacementEntry[];
    readonly effectiveAfter: readonly FileReplacementEntry[];
  };
}

export interface ConfirmFileReplacementOperation {
  readonly id: string;
  readonly order: number;
  readonly kind: 'confirm-file-replacement-present';
  readonly target: 'build';
  readonly targetName: string;
  readonly configuration: string;
  readonly configurationStack: readonly string[];
  readonly replace: string;
  readonly with: string;
  readonly requiredInputPath: string;
  readonly effectiveEntries: readonly FileReplacementEntry[];
}

export type MutationEnvironmentPlanOperation =
  CreateEnvironmentFileOperation | AddFileReplacementOperation | ConfirmFileReplacementOperation;
export type EnvironmentPlanOperation = InspectionOperation | MutationEnvironmentPlanOperation;

export interface PlanPropertyObservation {
  readonly path: string;
  readonly type: AnalyzedProperty['type'];
  readonly typeStatus: AnalyzedProperty['typeStatus'];
  readonly valueStatus: AnalyzedProperty['valueStatus'];
  readonly presenceStatus: AnalyzedProperty['presenceStatus'];
  readonly sourceProvenance: AnalyzedProperty['sourceProvenance'];
  readonly shadowedProvenance?: AnalyzedProperty['shadowedProvenance'];
}

export interface EnvironmentPlanConflict {
  readonly code: string;
  readonly resourceBudget?: AnalysisDiagnostic['resourceBudget'];
  readonly path?: string;
  readonly sourceLocation?: {
    readonly file: string;
    readonly line?: number;
    readonly column?: number;
  };
  readonly message: string;
  readonly safeAction: string;
}

interface EnvironmentPlanBase {
  readonly schemaVersion: number;
  readonly toolVersion: string;
  readonly typescriptVersion: string;
  readonly project: EnvironmentPlanProject;
  readonly inputHashes: readonly EnvironmentPlanInputFingerprint[];
  readonly conflicts: readonly EnvironmentPlanConflict[];
  readonly integrity: {
    readonly algorithm: 'sha256';
    readonly digest: string;
  };
}

export interface InspectionEnvironmentPlan extends EnvironmentPlanBase {
  readonly planKind: 'inspection';
  readonly applicability: 'inspection-only';
  readonly status: 'reviewable' | 'blocked';
  readonly decisions: readonly EnvironmentPlanDecision[];
  readonly operations: readonly InspectionOperation[];
}

export interface MutationEnvironmentPlan extends EnvironmentPlanBase {
  readonly planKind: 'mutation';
  readonly applicability: 'mutation-proposal-only';
  readonly status: 'ready' | 'blocked';
  /** These decisions are proposals; plan validity is not consumer approval. */
  readonly proposedDecisions: readonly EnvironmentPlanDecision[];
  readonly decisionApproval: 'pending-consumer-approval';
  readonly operations: readonly MutationEnvironmentPlanOperation[];
}

export type EnvironmentPlan = InspectionEnvironmentPlan | MutationEnvironmentPlan;
export type EnvironmentPlanBody =
  Omit<InspectionEnvironmentPlan, 'integrity'> | Omit<MutationEnvironmentPlan, 'integrity'>;

export interface EnvironmentPlanProject {
  readonly name: string;
  readonly root: string;
  readonly sourceRoot?: string;
  readonly build?: EnvironmentPlanTarget;
  readonly serve?: EnvironmentPlanTarget;
}

export interface EnvironmentPlanTarget {
  readonly name: string;
  readonly builder: string;
  readonly defaultConfiguration?: string;
  readonly buildTargetMappings: readonly {
    readonly configuration: string | null;
    readonly target: string;
  }[];
  /** Configuration ordering is meaningful and is preserved. */
  readonly configurations: readonly string[];
  readonly outputPaths: readonly {
    readonly configuration: string | null;
    readonly outputPath: string | Readonly<Record<string, string>>;
  }[];
  /** Distinguishes an absent setting from an explicitly empty array. */
  readonly fileReplacementSets: readonly {
    readonly configuration: string | null;
    readonly present: boolean;
    readonly entries: readonly FileReplacementEntry[];
  }[];
  readonly fileReplacements: readonly (FileReplacementEntry & {
    readonly configuration: string | null;
  })[];
}

export interface EnvironmentPlanConsumerApproval {
  readonly reviewedDigest: string;
  readonly acceptedDecisionIds: readonly string[];
}

export interface VerifyEnvironmentPlanResult {
  readonly ok: boolean;
  readonly code?:
    | 'ENV_PLAN_SCHEMA_UNSUPPORTED'
    | 'ENV_PLAN_INTEGRITY_INVALID'
    | 'ENV_PLAN_OPERATION_INVALID'
    | 'ENV_PLAN_INPUTS_STALE'
    | 'ENV_PLAN_REVIEW_MISMATCH'
    | 'ENV_PLAN_BLOCKED'
    | 'ENV_PLAN_NOT_MUTATION'
    | 'ENV_PLAN_PATH_INVALID'
    | 'ENV_PLAN_INPUT_REQUIRED'
    | 'ENV_PLAN_OUTPUT_COLLISION'
    | 'ENV_PLAN_TOOL_INCOMPATIBLE'
    | 'ENV_PLAN_APPROVAL_REQUIRED'
    | 'ENV_PLAN_DECISION_APPROVAL_INVALID';
}

export interface VerifyEnvironmentPlanEligibilityResult extends VerifyEnvironmentPlanResult {
  readonly eligibleForApply?: boolean;
}
