import {
  applyEdits,
  createScanner,
  findNodeAtLocation,
  getNodeValue,
  parseTree,
} from 'jsonc-parser';
import type { Node, ParseError } from 'jsonc-parser';
import type { Tree } from '@angular-devkit/schematics';
import type {
  EnvironmentPlan,
  EnvironmentPlanConsumerApproval,
  EnvironmentPlanCurrentInput,
  FileReplacementEntry,
  MutationEnvironmentPlan,
  VerifyEnvironmentPlanEligibilityResult,
} from './environment-plan-model.js';
import { verifyEnvironmentPlanEligibility } from './environment-plan-validator.js';
import { stableStringify } from './environment-plan-utils.js';

const WORKSPACE_FILE = '/angular.json';

export interface ApplyEnvironmentPlanToTreeInput {
  readonly tree: Tree;
  readonly plan: EnvironmentPlan;
  readonly approval?: EnvironmentPlanConsumerApproval;
  readonly consumerRoot: string;
  readonly isPathSafe: (root: string, relativePath: string) => boolean;
  readonly isReadPathSafe?: (root: string, relativePath: string) => boolean;
}

export type ApplyEnvironmentPlanToTreeResult =
  { readonly ok: true; readonly tree: Tree } | { readonly ok: false; readonly code: string };

/**
 * Applies a reviewed plan to a private branch and returns that branch only on success.
 * This internal boundary has no schematic rule or public package export.
 */
export async function applyEnvironmentPlanToTree(
  input: ApplyEnvironmentPlanToTreeInput,
): Promise<ApplyEnvironmentPlanToTreeResult> {
  if (!isMutationPlan(input.plan)) return { ok: false, code: 'ENV_PLAN_NOT_MUTATION' };

  let currentInputs: readonly EnvironmentPlanCurrentInput[];
  try {
    currentInputs = input.plan.inputHashes.map(({ path }) => {
      const treePath = toTreePath(path);
      return input.tree.exists(treePath)
        ? {
            path: absoluteInputPath(input.consumerRoot, path),
            exists: true,
            sourceText: input.tree.readText(treePath),
          }
        : { path: absoluteInputPath(input.consumerRoot, path), exists: false };
    });
  } catch {
    return { ok: false, code: 'ENV_PLAN_INPUTS_STALE' };
  }

  const eligibility: VerifyEnvironmentPlanEligibilityResult = verifyEnvironmentPlanEligibility(
    input.plan,
    input.approval,
    input.consumerRoot,
    currentInputs,
    input.isPathSafe,
    input.isReadPathSafe ?? input.isPathSafe,
  );
  if (!eligibility.ok) return { ok: false, code: eligibility.code ?? 'ENV_PLAN_OPERATION_INVALID' };

  const workspaceText = input.tree.readText(WORKSPACE_FILE);
  const workspace = parseWorkspace(workspaceText);
  if (!workspace) return { ok: false, code: 'ENV_APPLY_WORKSPACE_INVALID' };
  const target = findBuildTarget(workspace, input.plan);
  if (!target) return { ok: false, code: 'ENV_APPLY_TARGET_MISMATCH' };

  let staged: Tree;
  try {
    staged = input.tree.branch();
    for (const operation of input.plan.operations) {
      if (operation.kind === 'create-environment-file') {
        const destination = toTreePath(operation.path);
        const source = toTreePath(operation.derivation.sourcePath);
        if (staged.exists(destination) || !staged.exists(source)) {
          return { ok: false, code: 'ENV_APPLY_PATH_STATE_MISMATCH' };
        }
        staged.create(destination, staged.read(source)!);
        continue;
      }
      if (operation.kind === 'confirm-file-replacement-present') {
        if (!staged.exists(toTreePath(operation.with))) {
          return { ok: false, code: 'ENV_APPLY_PATH_STATE_MISMATCH' };
        }
        continue;
      }
      const updated = appendPlannedReplacement(
        staged.readText(WORKSPACE_FILE),
        input.plan,
        operation,
      );
      staged.overwrite(WORKSPACE_FILE, updated);
    }
    if (!verifyApplyPostconditions(staged, input.plan)) {
      return { ok: false, code: 'ENV_APPLY_POSTCONDITION_FAILED' };
    }
    return { ok: true, tree: staged };
  } catch {
    return { ok: false, code: 'ENV_APPLY_OPERATION_FAILED' };
  }
}

function verifyApplyPostconditions(tree: Tree, plan: MutationEnvironmentPlan): boolean {
  const workspace = parseWorkspace(tree.readText(WORKSPACE_FILE));
  if (!workspace) return false;
  const projectPath = ['projects', plan.project.name];
  const projectNode = findNodeAtLocation(workspace, projectPath);
  if (!projectNode || projectNode.type !== 'object') return false;
  const project = getNodeValue(projectNode) as Record<string, unknown>;
  if (
    project['root'] !== plan.project.root ||
    (project['sourceRoot'] ?? undefined) !== plan.project.sourceRoot
  )
    return false;
  const collectionPath = findNodeAtLocation(workspace, [...projectPath, 'targets'])
    ? [...projectPath, 'targets']
    : [...projectPath, 'architect'];
  const targetPath = [...collectionPath, plan.project.build!.name];
  const targetNode = findNodeAtLocation(workspace, targetPath);
  if (!targetNode || targetNode.type !== 'object') return false;
  const actualTarget = describeTarget(targetNode, plan.project.build!.name);
  if (
    actualTarget.builder !== plan.project.build!.builder ||
    stableStringify(actualTarget.configurations) !==
      stableStringify(plan.project.build!.configurations)
  )
    return false;

  const effectiveReplacements = (configurationStack: readonly string[]) => {
    let effective: FileReplacementEntry[] = [];
    for (const configuration of [null, ...configurationStack]) {
      const optionsPath =
        configuration === null
          ? [...targetPath, 'options']
          : [...targetPath, 'configurations', configuration];
      const optionsNode = findNodeAtLocation(workspace, optionsPath);
      if (!optionsNode || optionsNode.type !== 'object') continue;
      const replacementsNode = findNodeAtLocation(workspace, [...optionsPath, 'fileReplacements']);
      if (replacementsNode) {
        const entries = readFileReplacements(getNodeValue(replacementsNode));
        if (!entries) return undefined;
        effective = entries;
      }
    }
    return effective;
  };

  for (const operation of plan.operations) {
    if (operation.kind === 'create-environment-file') {
      const sourcePath = toTreePath(operation.derivation.sourcePath);
      const destinationPath = toTreePath(operation.path);
      const source = tree.read(sourcePath);
      const destination = tree.read(destinationPath);
      if (!source || !destination || !source.equals(destination)) return false;
      continue;
    }
    const effective = effectiveReplacements(operation.configurationStack);
    if (!effective) return false;
    if (operation.kind === 'confirm-file-replacement-present') {
      if (
        !tree.exists(toTreePath(operation.with)) ||
        stableStringify(effective) !== stableStringify(operation.effectiveEntries)
      )
        return false;
      continue;
    }
    const configurationPath = [
      ...targetPath,
      'configurations',
      operation.configuration,
      'fileReplacements',
    ];
    const replacementsNode = findNodeAtLocation(workspace, configurationPath);
    const entries = replacementsNode && readFileReplacements(getNodeValue(replacementsNode));
    if (
      !entries ||
      stableStringify(entries) !== stableStringify(operation.changePreview.resultingEntries) ||
      stableStringify(effective) !== stableStringify(operation.changePreview.effectiveAfter) ||
      entries.filter(
        ({ replace, with: replacement }) =>
          replace === operation.replace && replacement === operation.with,
      ).length !== 1
    )
      return false;
  }
  return true;
}

function isMutationPlan(plan: EnvironmentPlan): plan is MutationEnvironmentPlan {
  return !!plan && typeof plan === 'object' && plan.planKind === 'mutation';
}

function absoluteInputPath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${relativePath}`;
}

function toTreePath(relativePath: string): string {
  return `/${relativePath}`;
}

function parseWorkspace(text: string): Node | undefined {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  return errors.length === 0 && root?.type === 'object' ? root : undefined;
}

function findBuildTarget(root: Node, plan: MutationEnvironmentPlan): Node | undefined {
  const projectPath = ['projects', plan.project.name];
  const projectNode = findNodeAtLocation(root, projectPath);
  if (!projectNode || projectNode.type !== 'object') return undefined;
  const project = getNodeValue(projectNode) as Record<string, unknown>;
  if (
    project['root'] !== plan.project.root ||
    (project['sourceRoot'] ?? undefined) !== plan.project.sourceRoot
  )
    return undefined;

  const targetsPath = [...projectPath, 'targets'];
  const architectPath = [...projectPath, 'architect'];
  const targets = findNodeAtLocation(root, targetsPath);
  const architect = findNodeAtLocation(root, architectPath);
  if (!!targets === !!architect) return undefined;
  const collectionPath = targets ? targetsPath : architectPath;
  const targetPath = [...collectionPath, plan.project.build!.name];
  const targetNode = findNodeAtLocation(root, targetPath);
  if (!targetNode || targetNode.type !== 'object') return undefined;
  const actual = describeTarget(targetNode, plan.project.build!.name);
  return stableStringify(actual) === stableStringify(plan.project.build) ? targetNode : undefined;
}

function describeTarget(node: Node, name: string) {
  const target = getNodeValue(node) as Record<string, unknown>;
  const options = asRecord(target['options']);
  const configurations = asRecord(target['configurations']);
  const configurationNames = Object.keys(configurations);
  const fileReplacementSets = [
    { configuration: null, options },
    ...configurationNames.map((configuration) => ({
      configuration,
      options: asRecord(configurations[configuration]),
    })),
  ].map(({ configuration, options: values }) => ({
    configuration,
    present: Object.prototype.hasOwnProperty.call(values, 'fileReplacements'),
    entries: readFileReplacements(values['fileReplacements']) ?? [],
  }));
  const fileReplacements = fileReplacementSets.flatMap(({ configuration, entries }) =>
    entries.map((entry) => ({ configuration, ...entry })),
  );
  const buildTargetMappings = [
    readBuildTargetMapping(null, options),
    ...configurationNames.map((configuration) =>
      readBuildTargetMapping(configuration, asRecord(configurations[configuration])),
    ),
  ].filter((mapping): mapping is NonNullable<typeof mapping> => !!mapping);
  const outputPaths = [
    readOutputPath(null, options['outputPath']),
    ...configurationNames.map((configuration) =>
      readOutputPath(configuration, asRecord(configurations[configuration])['outputPath']),
    ),
  ].filter((path): path is NonNullable<typeof path> => !!path);
  return {
    name,
    builder: target['builder'],
    defaultConfiguration: target['defaultConfiguration'],
    buildTargetMappings,
    configurations: configurationNames,
    outputPaths,
    fileReplacementSets,
    fileReplacements,
  };
}

function appendPlannedReplacement(
  text: string,
  plan: MutationEnvironmentPlan,
  operation: Extract<
    MutationEnvironmentPlan['operations'][number],
    { kind: 'add-file-replacement' }
  >,
): string {
  const root = parseWorkspace(text);
  if (!root) throw new Error('Workspace JSONC is invalid.');
  const projectPath = ['projects', plan.project.name];
  const targetsPath = [...projectPath, 'targets'];
  const architectPath = [...projectPath, 'architect'];
  const collectionPath = findNodeAtLocation(root, targetsPath) ? targetsPath : architectPath;
  const configurationPath = [
    ...collectionPath,
    operation.targetName,
    'configurations',
    operation.configuration,
  ];
  const configurationNode = findNodeAtLocation(root, configurationPath);
  if (!configurationNode || configurationNode.type !== 'object') {
    throw new Error('The planned build configuration disappeared.');
  }
  const propertyNode = findNodeAtLocation(root, [...configurationPath, 'fileReplacements']);
  const replacement = { replace: operation.replace, with: operation.with };
  if (propertyNode) {
    if (propertyNode.type !== 'array') throw new Error('fileReplacements is not an array.');
    const current = getNodeValue(propertyNode) as unknown;
    const entries = readFileReplacements(current);
    if (
      !entries ||
      stableStringify(entries) !== stableStringify(operation.changePreview.existingEntries)
    ) {
      throw new Error('fileReplacements changed after validation.');
    }
    if (
      stableStringify(operation.changePreview.resultingEntries) !==
      stableStringify([...entries, replacement])
    ) {
      throw new Error('The replacement preview is inconsistent.');
    }
    return appendJsonArrayValue(
      text,
      propertyNode,
      [...configurationPath, 'fileReplacements'],
      replacement,
    );
  }
  if (stableStringify(operation.changePreview.existingEntries) !== '[]') {
    throw new Error('The planned replacement property is missing.');
  }
  return addJsonObjectProperty(
    text,
    configurationNode,
    configurationPath,
    'fileReplacements',
    operation.changePreview.resultingEntries,
  );
}

function appendJsonArrayValue(
  text: string,
  arrayNode: Node,
  path: (string | number)[],
  value: unknown,
): string {
  const children = arrayNode.children ?? [];
  const closeOffset = arrayNode.offset + arrayNode.length - 1;
  const containerIndent = propertyLineIndent(text, arrayNode.parent) ?? '';
  const step = childIndentStep(text, children, containerIndent);
  let updated = text;
  if (children.length) {
    const last = children[children.length - 1]!;
    const lastEnd = last.offset + last.length;
    const tail = updated.slice(lastEnd, closeOffset);
    if (!containsCommaToken(tail)) {
      updated = insertText(updated, lastEnd, ',');
    }
  }
  const currentRoot = parseWorkspace(updated);
  const currentArray = currentRoot && findNodeAtLocation(currentRoot, path);
  if (!currentArray || currentArray.type !== 'array')
    throw new Error('Array edit lost its target.');
  return insertArrayElementAtEnd(updated, currentArray, value, containerIndent, step);
}

function insertArrayElementAtEnd(
  text: string,
  node: Node,
  value: unknown,
  containerIndent: string,
  step: string,
): string {
  const closeOffset = node.offset + node.length - 1;
  const eol = detectEol(text);
  const closeIndent = closingLineIndent(text, closeOffset);
  const itemIndent = closeIndent ?? `${containerIndent}${step}`;
  const rendered = JSON.stringify(value, null, step).replaceAll(`\n`, `${eol}${itemIndent}`);
  const insertion =
    closeIndent === undefined
      ? `${eol}${itemIndent}${rendered}${eol}${containerIndent}`
      : `${step}${rendered}${eol}${closeIndent}`;
  return insertText(text, closeOffset, insertion);
}

function addJsonObjectProperty(
  text: string,
  node: Node,
  path: (string | number)[],
  key: string,
  value: unknown,
): string {
  const children = node.children ?? [];
  const closeOffset = node.offset + node.length - 1;
  const objectIndent = propertyLineIndent(text, node.parent) ?? '';
  const step = childIndentStep(text, children, objectIndent);
  let updated = text;
  if (children.length) {
    const lastProperty = children[children.length - 1]!;
    const valueNode = lastProperty.children?.[1];
    if (!valueNode) throw new Error('Malformed JSON object property.');
    const valueEnd = valueNode.offset + valueNode.length;
    if (!containsCommaToken(updated.slice(valueEnd, closeOffset))) {
      updated = insertText(updated, valueEnd, ',');
    }
  }
  const currentRoot = parseWorkspace(updated);
  if (!currentRoot) throw new Error('Workspace JSONC became invalid.');
  const currentNode = findNodeAtLocation(currentRoot, path);
  if (!currentNode || currentNode.type !== 'object')
    throw new Error('Object edit lost its target.');
  return insertObjectPropertyAtEnd(updated, currentNode, key, value, objectIndent, step);
}

function insertObjectPropertyAtEnd(
  text: string,
  node: Node,
  key: string,
  value: unknown,
  objectIndent: string,
  step: string,
): string {
  const closeOffset = node.offset + node.length - 1;
  const eol = detectEol(text);
  const closeIndent = closingLineIndent(text, closeOffset);
  const propertyIndent =
    closeIndent === undefined ? `${objectIndent}${step}` : `${closeIndent}${step}`;
  const rendered = JSON.stringify(value, null, step).replaceAll(`\n`, `${eol}${propertyIndent}`);
  const property = `${JSON.stringify(key)}: ${rendered}`;
  const insertion =
    closeIndent === undefined
      ? `${eol}${propertyIndent}${property}${eol}${objectIndent}`
      : `${step}${property}${eol}${closeIndent}`;
  return insertText(text, closeOffset, insertion);
}

function containsCommaToken(text: string): boolean {
  const scanner = createScanner(text, true);
  let token = scanner.scan();
  while (token !== 17) {
    if (token === 5) return true;
    token = scanner.scan();
  }
  return false;
}

function propertyLineIndent(text: string, node: Node | undefined): string | undefined {
  let current = node;
  while (current && current.type !== 'property') current = current.parent;
  return current ? indentationAt(text, current.offset) : undefined;
}

function childIndentStep(text: string, children: readonly Node[], baseIndent: string): string {
  if (children.length) {
    const indent = indentationAt(text, children[0]!.offset);
    if (indent?.startsWith(baseIndent) && indent.length > baseIndent.length) {
      return indent.slice(baseIndent.length);
    }
  }
  return '  ';
}

function indentationAt(text: string, offset: number): string | undefined {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const prefix = text.slice(lineStart, offset);
  return /^\s*$/.test(prefix) ? prefix : undefined;
}

function closingLineIndent(text: string, offset: number): string | undefined {
  return indentationAt(text, offset);
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function insertText(text: string, offset: number, insertion: string): string {
  return applyEdits(text, [{ offset, length: 0, content: insertion }]);
}

function readFileReplacements(value: unknown): FileReplacementEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: FileReplacementEntry[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      typeof item['replace'] !== 'string' ||
      typeof item['with'] !== 'string'
    )
      return undefined;
    entries.push({ replace: item['replace'], with: item['with'] });
  }
  return entries;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBuildTargetMapping(configuration: string | null, options: Record<string, unknown>) {
  const target = options['buildTarget'] ?? options['browserTarget'];
  return typeof target === 'string' ? { configuration, target } : undefined;
}

function readOutputPath(configuration: string | null, value: unknown) {
  if (typeof value === 'string') return { configuration, outputPath: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const outputPath = Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return Object.keys(outputPath).length ? { configuration, outputPath } : undefined;
}
