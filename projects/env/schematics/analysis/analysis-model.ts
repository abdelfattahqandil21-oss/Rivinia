export interface EnvironmentSourceInput {
  readonly name: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly kind?: 'environment' | 'dependency';
}

export interface EnvironmentAnalysisOptions {
  readonly maxSources?: number;
  readonly maxSourceBytes?: number;
  readonly maxNestingDepth?: number;
  readonly maxTypeDepth?: number;
  readonly project?: TypeScriptProjectSource;
}

export interface TypeScriptProjectSource {
  /** Absolute root of the consumer workspace snapshot exposed by `readFile`. */
  readonly rootDirectory: string;
  /** Absolute path to the consumer tsconfig used for this analysis. */
  readonly tsconfigFileName: string;
  /** Read-only source access; paths outside rootDirectory are never requested. */
  readonly readFile: (absoluteFileName: string) => string | undefined;
}

export interface AnalyzedType {
  readonly kind:
    | 'string'
    | 'number'
    | 'boolean'
    | 'bigint'
    | 'symbol'
    | 'null'
    | 'undefined'
    | 'object'
    | 'array'
    | 'tuple'
    | 'union'
    | 'unknown';
  readonly unknownReason?: 'type-depth' | 'circular-type';
  readonly readonly?: boolean;
  readonly members?: readonly AnalyzedType[];
}

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface AnalyzedProperty {
  readonly path: string;
  readonly type: AnalyzedType;
  readonly typeStatus: 'known' | 'unknown';
  readonly valueStatus: 'static' | 'dynamic';
  readonly presenceStatus: 'present';
  readonly sourceProvenance: SourceLocation;
  readonly shadowedProvenance?: readonly SourceLocation[];
}

export interface AnalysisResourceBudget {
  readonly kind: 'source-count' | 'source-bytes' | 'object-depth' | 'type-depth';
  readonly limit: number;
}

export interface AnalysisDiagnostic {
  readonly code: string;
  readonly severity: 'error';
  readonly blocking: true;
  readonly path?: string;
  readonly sourceLocation?: Partial<SourceLocation> & Pick<SourceLocation, 'file'>;
  readonly message: string;
  readonly safeAction: string;
  readonly resourceBudget?: AnalysisResourceBudget;
}

export interface AnalyzedEnvironment {
  readonly name: string;
  readonly fileName: string;
  readonly properties: readonly AnalyzedProperty[];
  readonly transferSafety: {
    readonly strategy: 'verbatim-sibling-copy';
    readonly status: 'safe' | 'blocked';
    readonly reason?:
      'dynamic-environment-value' | 'module-location-reference' | 'unsupported-top-level-effect';
  };
}

export interface InfluencingFileHash {
  readonly path: string;
  readonly sha256: string;
}

export interface EnvironmentAnalysisResult {
  readonly environments: readonly AnalyzedEnvironment[];
  readonly fields: readonly import('./type-reconciliation.js').ReconciledField[];
  readonly diagnostics: readonly AnalysisDiagnostic[];
  readonly influencingFileHashes: readonly InfluencingFileHash[];
}
