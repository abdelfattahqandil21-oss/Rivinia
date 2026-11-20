import ts from 'typescript';
import { findEnvironmentDeclaration } from './environment-object-analysis.js';
import { emitEnvironmentModel } from './environment-model-emitter.js';
import { proofKey, proveModelType, type ModelTypeProof } from './environment-model-proof.js';

export interface EnvironmentModelResult {
  readonly modelText?: string;
  readonly proof?: ModelTypeProof;
  readonly diagnostic?: {
    readonly code: 'ENV_MODEL_TYPE_UNPROVEN' | 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE';
    readonly sourceLocation: { readonly file: string };
    readonly message: string;
  };
}

type EnvironmentModelDiagnosticCode =
  'ENV_MODEL_TYPE_UNPROVEN' | 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE';

/** Derive a self-contained shared model from every selected environment or fail closed. */
export function deriveEnvironmentModel(
  program: ts.Program,
  sourceFiles: readonly string[],
): EnvironmentModelResult {
  if (sourceFiles.length === 0) return blocked('', 'ENV_MODEL_TYPE_UNPROVEN');
  const checker = program.getTypeChecker();
  let common: Extract<ModelTypeProof, { kind: 'object' }> | undefined;
  for (const fileName of sourceFiles) {
    const sourceFile = program.getSourceFile(fileName);
    const declaration = sourceFile && findEnvironmentDeclaration(sourceFile);
    if (!sourceFile || !declaration?.name || !ts.isIdentifier(declaration.name))
      return blocked(fileName, 'ENV_MODEL_TYPE_UNPROVEN');
    const result = proveModelType(checker.getTypeAtLocation(declaration.name), checker);
    if (!result.proof || result.proof.kind !== 'object')
      return blocked(fileName, 'ENV_MODEL_TYPE_UNPROVEN');
    if (common && proofKey(common) !== proofKey(result.proof))
      return blocked(fileName, 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE');
    common = result.proof;
  }
  return common
    ? { proof: common, modelText: emitEnvironmentModel(common) }
    : blocked('', 'ENV_MODEL_TYPE_UNPROVEN');
}

function blocked(file: string, code: EnvironmentModelDiagnosticCode): EnvironmentModelResult {
  return {
    diagnostic: {
      code,
      sourceLocation: { file },
      message:
        code === 'ENV_MODEL_ENVIRONMENTS_INCOMPATIBLE'
          ? 'Selected environments do not satisfy one provable shared model.'
          : 'The selected environment type is outside the bounded model-emission subset.',
    },
  };
}
