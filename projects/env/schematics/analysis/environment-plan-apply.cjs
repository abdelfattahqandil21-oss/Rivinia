"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyEnvironmentPlanToTree = applyEnvironmentPlanToTree;
const jsonc_parser_1 = require("jsonc-parser");
const environment_plan_validator_js_1 = require("./environment-plan-validator.cjs");
const environment_plan_utils_js_1 = require("./environment-plan-utils.cjs");
const WORKSPACE_FILE = '/angular.json';
/**
 * Applies a reviewed plan to a private branch and returns that branch only on success.
 * This internal boundary has no schematic rule or public package export.
 */
async function applyEnvironmentPlanToTree(input) {
    if (!isMutationPlan(input.plan))
        return { ok: false, code: 'ENV_PLAN_NOT_MUTATION' };
    let currentInputs;
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
    }
    catch {
        return { ok: false, code: 'ENV_PLAN_INPUTS_STALE' };
    }
    const eligibility = (0, environment_plan_validator_js_1.verifyEnvironmentPlanEligibility)(input.plan, input.approval, input.consumerRoot, currentInputs, input.isPathSafe, input.isReadPathSafe ?? input.isPathSafe);
    if (!eligibility.ok)
        return { ok: false, code: eligibility.code ?? 'ENV_PLAN_OPERATION_INVALID' };
    const workspaceText = input.tree.readText(WORKSPACE_FILE);
    const workspace = parseWorkspace(workspaceText);
    if (!workspace)
        return { ok: false, code: 'ENV_APPLY_WORKSPACE_INVALID' };
    const target = findBuildTarget(workspace, input.plan);
    if (!target)
        return { ok: false, code: 'ENV_APPLY_TARGET_MISMATCH' };
    let staged;
    try {
        staged = input.tree.branch();
        for (const operation of input.plan.operations) {
            if (operation.kind === 'create-environment-file') {
                const destination = toTreePath(operation.path);
                const source = toTreePath(operation.derivation.sourcePath);
                if (staged.exists(destination) || !staged.exists(source)) {
                    return { ok: false, code: 'ENV_APPLY_PATH_STATE_MISMATCH' };
                }
                staged.create(destination, staged.read(source));
                continue;
            }
            if (operation.kind === 'confirm-file-replacement-present') {
                if (!staged.exists(toTreePath(operation.with))) {
                    return { ok: false, code: 'ENV_APPLY_PATH_STATE_MISMATCH' };
                }
                continue;
            }
            const updated = appendPlannedReplacement(staged.readText(WORKSPACE_FILE), input.plan, operation);
            staged.overwrite(WORKSPACE_FILE, updated);
        }
        if (!verifyApplyPostconditions(staged, input.plan)) {
            return { ok: false, code: 'ENV_APPLY_POSTCONDITION_FAILED' };
        }
        return { ok: true, tree: staged };
    }
    catch {
        return { ok: false, code: 'ENV_APPLY_OPERATION_FAILED' };
    }
}
function verifyApplyPostconditions(tree, plan) {
    const workspace = parseWorkspace(tree.readText(WORKSPACE_FILE));
    if (!workspace)
        return false;
    const projectPath = ['projects', plan.project.name];
    const projectNode = (0, jsonc_parser_1.findNodeAtLocation)(workspace, projectPath);
    if (!projectNode || projectNode.type !== 'object')
        return false;
    const project = (0, jsonc_parser_1.getNodeValue)(projectNode);
    if (project['root'] !== plan.project.root ||
        (project['sourceRoot'] ?? undefined) !== plan.project.sourceRoot)
        return false;
    const collectionPath = (0, jsonc_parser_1.findNodeAtLocation)(workspace, [...projectPath, 'targets'])
        ? [...projectPath, 'targets']
        : [...projectPath, 'architect'];
    const targetPath = [...collectionPath, plan.project.build.name];
    const targetNode = (0, jsonc_parser_1.findNodeAtLocation)(workspace, targetPath);
    if (!targetNode || targetNode.type !== 'object')
        return false;
    const actualTarget = describeTarget(targetNode, plan.project.build.name);
    if (actualTarget.builder !== plan.project.build.builder ||
        (0, environment_plan_utils_js_1.stableStringify)(actualTarget.configurations) !==
            (0, environment_plan_utils_js_1.stableStringify)(plan.project.build.configurations))
        return false;
    const effectiveReplacements = (configurationStack) => {
        let effective = [];
        for (const configuration of [null, ...configurationStack]) {
            const optionsPath = configuration === null
                ? [...targetPath, 'options']
                : [...targetPath, 'configurations', configuration];
            const optionsNode = (0, jsonc_parser_1.findNodeAtLocation)(workspace, optionsPath);
            if (!optionsNode || optionsNode.type !== 'object')
                continue;
            const replacementsNode = (0, jsonc_parser_1.findNodeAtLocation)(workspace, [...optionsPath, 'fileReplacements']);
            if (replacementsNode) {
                const entries = readFileReplacements((0, jsonc_parser_1.getNodeValue)(replacementsNode));
                if (!entries)
                    return undefined;
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
            if (!source || !destination || !source.equals(destination))
                return false;
            continue;
        }
        const effective = effectiveReplacements(operation.configurationStack);
        if (!effective)
            return false;
        if (operation.kind === 'confirm-file-replacement-present') {
            if (!tree.exists(toTreePath(operation.with)) ||
                (0, environment_plan_utils_js_1.stableStringify)(effective) !== (0, environment_plan_utils_js_1.stableStringify)(operation.effectiveEntries))
                return false;
            continue;
        }
        const configurationPath = [
            ...targetPath,
            'configurations',
            operation.configuration,
            'fileReplacements',
        ];
        const replacementsNode = (0, jsonc_parser_1.findNodeAtLocation)(workspace, configurationPath);
        const entries = replacementsNode && readFileReplacements((0, jsonc_parser_1.getNodeValue)(replacementsNode));
        if (!entries ||
            (0, environment_plan_utils_js_1.stableStringify)(entries) !== (0, environment_plan_utils_js_1.stableStringify)(operation.changePreview.resultingEntries) ||
            (0, environment_plan_utils_js_1.stableStringify)(effective) !== (0, environment_plan_utils_js_1.stableStringify)(operation.changePreview.effectiveAfter) ||
            entries.filter(({ replace, with: replacement }) => replace === operation.replace && replacement === operation.with).length !== 1)
            return false;
    }
    return true;
}
function isMutationPlan(plan) {
    return !!plan && typeof plan === 'object' && plan.planKind === 'mutation';
}
function absoluteInputPath(root, relativePath) {
    return `${root.replace(/[\\/]+$/, '')}/${relativePath}`;
}
function toTreePath(relativePath) {
    return `/${relativePath}`;
}
function parseWorkspace(text) {
    const errors = [];
    const root = (0, jsonc_parser_1.parseTree)(text, errors, { allowTrailingComma: true, disallowComments: false });
    return errors.length === 0 && root?.type === 'object' ? root : undefined;
}
function findBuildTarget(root, plan) {
    const projectPath = ['projects', plan.project.name];
    const projectNode = (0, jsonc_parser_1.findNodeAtLocation)(root, projectPath);
    if (!projectNode || projectNode.type !== 'object')
        return undefined;
    const project = (0, jsonc_parser_1.getNodeValue)(projectNode);
    if (project['root'] !== plan.project.root ||
        (project['sourceRoot'] ?? undefined) !== plan.project.sourceRoot)
        return undefined;
    const targetsPath = [...projectPath, 'targets'];
    const architectPath = [...projectPath, 'architect'];
    const targets = (0, jsonc_parser_1.findNodeAtLocation)(root, targetsPath);
    const architect = (0, jsonc_parser_1.findNodeAtLocation)(root, architectPath);
    if (!!targets === !!architect)
        return undefined;
    const collectionPath = targets ? targetsPath : architectPath;
    const targetPath = [...collectionPath, plan.project.build.name];
    const targetNode = (0, jsonc_parser_1.findNodeAtLocation)(root, targetPath);
    if (!targetNode || targetNode.type !== 'object')
        return undefined;
    const actual = describeTarget(targetNode, plan.project.build.name);
    return (0, environment_plan_utils_js_1.stableStringify)(actual) === (0, environment_plan_utils_js_1.stableStringify)(plan.project.build) ? targetNode : undefined;
}
function describeTarget(node, name) {
    const target = (0, jsonc_parser_1.getNodeValue)(node);
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
    const fileReplacements = fileReplacementSets.flatMap(({ configuration, entries }) => entries.map((entry) => ({ configuration, ...entry })));
    const buildTargetMappings = [
        readBuildTargetMapping(null, options),
        ...configurationNames.map((configuration) => readBuildTargetMapping(configuration, asRecord(configurations[configuration]))),
    ].filter((mapping) => !!mapping);
    const outputPaths = [
        readOutputPath(null, options['outputPath']),
        ...configurationNames.map((configuration) => readOutputPath(configuration, asRecord(configurations[configuration])['outputPath'])),
    ].filter((path) => !!path);
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
function appendPlannedReplacement(text, plan, operation) {
    const root = parseWorkspace(text);
    if (!root)
        throw new Error('Workspace JSONC is invalid.');
    const projectPath = ['projects', plan.project.name];
    const targetsPath = [...projectPath, 'targets'];
    const architectPath = [...projectPath, 'architect'];
    const collectionPath = (0, jsonc_parser_1.findNodeAtLocation)(root, targetsPath) ? targetsPath : architectPath;
    const configurationPath = [
        ...collectionPath,
        operation.targetName,
        'configurations',
        operation.configuration,
    ];
    const configurationNode = (0, jsonc_parser_1.findNodeAtLocation)(root, configurationPath);
    if (!configurationNode || configurationNode.type !== 'object') {
        throw new Error('The planned build configuration disappeared.');
    }
    const propertyNode = (0, jsonc_parser_1.findNodeAtLocation)(root, [...configurationPath, 'fileReplacements']);
    const replacement = { replace: operation.replace, with: operation.with };
    if (propertyNode) {
        if (propertyNode.type !== 'array')
            throw new Error('fileReplacements is not an array.');
        const current = (0, jsonc_parser_1.getNodeValue)(propertyNode);
        const entries = readFileReplacements(current);
        if (!entries ||
            (0, environment_plan_utils_js_1.stableStringify)(entries) !== (0, environment_plan_utils_js_1.stableStringify)(operation.changePreview.existingEntries)) {
            throw new Error('fileReplacements changed after validation.');
        }
        if ((0, environment_plan_utils_js_1.stableStringify)(operation.changePreview.resultingEntries) !==
            (0, environment_plan_utils_js_1.stableStringify)([...entries, replacement])) {
            throw new Error('The replacement preview is inconsistent.');
        }
        return appendJsonArrayValue(text, propertyNode, [...configurationPath, 'fileReplacements'], replacement);
    }
    if ((0, environment_plan_utils_js_1.stableStringify)(operation.changePreview.existingEntries) !== '[]') {
        throw new Error('The planned replacement property is missing.');
    }
    return addJsonObjectProperty(text, configurationNode, configurationPath, 'fileReplacements', operation.changePreview.resultingEntries);
}
function appendJsonArrayValue(text, arrayNode, path, value) {
    const children = arrayNode.children ?? [];
    const closeOffset = arrayNode.offset + arrayNode.length - 1;
    const containerIndent = propertyLineIndent(text, arrayNode.parent) ?? '';
    const step = childIndentStep(text, children, containerIndent);
    let updated = text;
    if (children.length) {
        const last = children[children.length - 1];
        const lastEnd = last.offset + last.length;
        const tail = updated.slice(lastEnd, closeOffset);
        if (!containsCommaToken(tail)) {
            updated = insertText(updated, lastEnd, ',');
        }
    }
    const currentRoot = parseWorkspace(updated);
    const currentArray = currentRoot && (0, jsonc_parser_1.findNodeAtLocation)(currentRoot, path);
    if (!currentArray || currentArray.type !== 'array')
        throw new Error('Array edit lost its target.');
    return insertArrayElementAtEnd(updated, currentArray, value, containerIndent, step);
}
function insertArrayElementAtEnd(text, node, value, containerIndent, step) {
    const closeOffset = node.offset + node.length - 1;
    const eol = detectEol(text);
    const closeIndent = closingLineIndent(text, closeOffset);
    const itemIndent = closeIndent ?? `${containerIndent}${step}`;
    const rendered = JSON.stringify(value, null, step).replaceAll(`\n`, `${eol}${itemIndent}`);
    const insertion = closeIndent === undefined
        ? `${eol}${itemIndent}${rendered}${eol}${containerIndent}`
        : `${step}${rendered}${eol}${closeIndent}`;
    return insertText(text, closeOffset, insertion);
}
function addJsonObjectProperty(text, node, path, key, value) {
    const children = node.children ?? [];
    const closeOffset = node.offset + node.length - 1;
    const objectIndent = propertyLineIndent(text, node.parent) ?? '';
    const step = childIndentStep(text, children, objectIndent);
    let updated = text;
    if (children.length) {
        const lastProperty = children[children.length - 1];
        const valueNode = lastProperty.children?.[1];
        if (!valueNode)
            throw new Error('Malformed JSON object property.');
        const valueEnd = valueNode.offset + valueNode.length;
        if (!containsCommaToken(updated.slice(valueEnd, closeOffset))) {
            updated = insertText(updated, valueEnd, ',');
        }
    }
    const currentRoot = parseWorkspace(updated);
    if (!currentRoot)
        throw new Error('Workspace JSONC became invalid.');
    const currentNode = (0, jsonc_parser_1.findNodeAtLocation)(currentRoot, path);
    if (!currentNode || currentNode.type !== 'object')
        throw new Error('Object edit lost its target.');
    return insertObjectPropertyAtEnd(updated, currentNode, key, value, objectIndent, step);
}
function insertObjectPropertyAtEnd(text, node, key, value, objectIndent, step) {
    const closeOffset = node.offset + node.length - 1;
    const eol = detectEol(text);
    const closeIndent = closingLineIndent(text, closeOffset);
    const propertyIndent = closeIndent === undefined ? `${objectIndent}${step}` : `${closeIndent}${step}`;
    const rendered = JSON.stringify(value, null, step).replaceAll(`\n`, `${eol}${propertyIndent}`);
    const property = `${JSON.stringify(key)}: ${rendered}`;
    const insertion = closeIndent === undefined
        ? `${eol}${propertyIndent}${property}${eol}${objectIndent}`
        : `${step}${property}${eol}${closeIndent}`;
    return insertText(text, closeOffset, insertion);
}
function containsCommaToken(text) {
    const scanner = (0, jsonc_parser_1.createScanner)(text, true);
    let token = scanner.scan();
    while (token !== 17) {
        if (token === 5)
            return true;
        token = scanner.scan();
    }
    return false;
}
function propertyLineIndent(text, node) {
    let current = node;
    while (current && current.type !== 'property')
        current = current.parent;
    return current ? indentationAt(text, current.offset) : undefined;
}
function childIndentStep(text, children, baseIndent) {
    if (children.length) {
        const indent = indentationAt(text, children[0].offset);
        if (indent?.startsWith(baseIndent) && indent.length > baseIndent.length) {
            return indent.slice(baseIndent.length);
        }
    }
    return '  ';
}
function indentationAt(text, offset) {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const prefix = text.slice(lineStart, offset);
    return /^\s*$/.test(prefix) ? prefix : undefined;
}
function closingLineIndent(text, offset) {
    return indentationAt(text, offset);
}
function detectEol(text) {
    return text.includes('\r\n') ? '\r\n' : '\n';
}
function insertText(text, offset, insertion) {
    return (0, jsonc_parser_1.applyEdits)(text, [{ offset, length: 0, content: insertion }]);
}
function readFileReplacements(value) {
    if (!Array.isArray(value))
        return undefined;
    const entries = [];
    for (const item of value) {
        if (!item ||
            typeof item !== 'object' ||
            Array.isArray(item) ||
            typeof item['replace'] !== 'string' ||
            typeof item['with'] !== 'string')
            return undefined;
        entries.push({ replace: item['replace'], with: item['with'] });
    }
    return entries;
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function readBuildTargetMapping(configuration, options) {
    const target = options['buildTarget'] ?? options['browserTarget'];
    return typeof target === 'string' ? { configuration, target } : undefined;
}
function readOutputPath(configuration, value) {
    if (typeof value === 'string')
        return { configuration, outputPath: value };
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const outputPath = Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === 'string'));
    return Object.keys(outputPath).length ? { configuration, outputPath } : undefined;
}
