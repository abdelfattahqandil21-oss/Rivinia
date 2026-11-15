import { createHash } from 'node:crypto';
import type {
  EnvironmentPlan,
  EnvironmentPlanConflict,
  EnvironmentPlanCurrentInput,
  EnvironmentPlanInputFingerprint,
  EnvironmentPlanInputFile,
  InspectionEnvironmentPlan,
  MutationEnvironmentPlan,
} from './environment-plan-model.js';

export function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function operationId(body: unknown): string {
  return hashText(stableStringify(body)).slice(0, 20);
}

export function withIntegrity<T extends object>(
  body: T,
): T & { readonly integrity: EnvironmentPlan['integrity'] } {
  return { ...body, integrity: { algorithm: 'sha256', digest: hashText(stableStringify(body)) } };
}

export function conflict(code: string, message: string): EnvironmentPlanConflict {
  return {
    code,
    message,
    safeAction: 'Review the workspace and resolve this proposal explicitly.',
  };
}

export function inspectionDecisions(): InspectionEnvironmentPlan['decisions'] {
  return [
    {
      id: 'consumer-file-ownership',
      choice: 'preserve-existing-files',
      authority: 'approved-policy',
    },
    {
      id: 'environment-values',
      choice: 'preserve-per-source-values-and-do-not-synthesize-missing-fields',
      authority: 'approved-policy',
    },
  ];
}

export function mutationDecisions(): MutationEnvironmentPlan['proposedDecisions'] {
  return [
    {
      id: 'consumer-file-ownership',
      choice: 'create-only-when-destination-is-missing',
      authority: 'approved-policy',
    },
    {
      id: 'environment-values',
      choice: 'copy-only-the-matching-environment-without-value-conversion',
      authority: 'approved-policy',
    },
    {
      id: 'configuration-mapping',
      choice: 'use-explicit-proposal-without-renaming-existing-configurations',
      authority: 'explicit-proposal',
    },
    {
      id: 'environment-semantics',
      choice: 'verbatim-copy-does-not-prove-target-environment-semantics',
      authority: 'explicit-proposal',
    },
  ];
}

export function isPathSafeSafely(
  check: (root: string, relativePath: string) => boolean,
  root: string,
  relativePath: string,
): boolean {
  try {
    return check(root, relativePath);
  } catch {
    return false;
  }
}

export function canonicalInputHashes(
  consumerRoot: string,
  currentInputs: readonly EnvironmentPlanCurrentInput[],
) {
  const byPath = new Map<string, Omit<EnvironmentPlanInputFingerprint, 'path'>>();
  for (const { path, sourceText, exists } of currentInputs) {
    const relative = toRootRelativePath(consumerRoot, path);
    if (
      !relative ||
      byPath.has(relative) ||
      (exists && typeof sourceText !== 'string') ||
      (!exists && sourceText !== undefined)
    )
      return undefined;
    byPath.set(
      relative,
      exists
        ? { sha256: hashText(sourceText!), presence: 'present' as const }
        : { sha256: hashText(ABSENT_INPUT_SENTINEL), presence: 'absent' as const },
    );
  }
  return [...byPath.entries()]
    .map(([path, fingerprint]) => ({ path, ...fingerprint }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export const ABSENT_INPUT_SENTINEL = 'ENV_PLAN_ABSENT_V1';

export function isCanonicalRelativePath(path: string): boolean {
  return (
    !!path &&
    !/[\x00-\x1f]/.test(path) &&
    !path.startsWith('/') &&
    !/^[a-zA-Z]:/.test(path) &&
    path.replaceAll('\\', '/') === path &&
    path.split('/').every((part) => !!part && part !== '.' && part !== '..')
  );
}

export function toRootRelativePath(root: string, filePath: string): string | undefined {
  const canonicalRoot = normalizeAbsolutePath(root);
  if (!canonicalRoot) return undefined;
  const normalizedInput = filePath.replaceAll('\\', '/');
  const absolute = normalizedInput.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedInput);
  if (!absolute) return normalizeRelativePath(normalizedInput);
  const canonicalInput = normalizeAbsolutePath(normalizedInput);
  if (
    !canonicalInput ||
    (canonicalInput !== canonicalRoot &&
      !canonicalInput.startsWith(`${canonicalRoot.replace(/\/$/, '')}/`))
  )
    return undefined;
  return canonicalInput.slice(canonicalRoot.replace(/\/$/, '').length).replace(/^\//, '');
}

function normalizeAbsolutePath(path: string): string | undefined {
  const value = path.replaceAll('\\', '/');
  const drive = value.match(/^([a-zA-Z]:)\//)?.[1]?.toUpperCase();
  if (!value.startsWith('/') && !drive) return undefined;
  const prefix = drive ? `${drive}/` : '/';
  const rest = drive ? value.slice(3) : value.slice(1);
  const parts: string[] = [];
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(part);
  }
  return `${prefix}${parts.join('/')}`.replace(/\/$/, '') || prefix;
}

function normalizeRelativePath(path: string): string | undefined {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join('/') : undefined;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJsonValue(entry)]),
  );
}
