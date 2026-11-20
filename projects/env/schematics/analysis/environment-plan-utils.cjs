"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABSENT_INPUT_SENTINEL = void 0;
exports.hashText = hashText;
exports.operationId = operationId;
exports.withIntegrity = withIntegrity;
exports.conflict = conflict;
exports.inspectionDecisions = inspectionDecisions;
exports.mutationDecisions = mutationDecisions;
exports.isPathSafeSafely = isPathSafeSafely;
exports.canonicalInputHashes = canonicalInputHashes;
exports.isCanonicalRelativePath = isCanonicalRelativePath;
exports.toRootRelativePath = toRootRelativePath;
exports.stableStringify = stableStringify;
const node_crypto_1 = require("node:crypto");
function hashText(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex');
}
function operationId(body) {
    return hashText(stableStringify(body)).slice(0, 20);
}
function withIntegrity(body) {
    return { ...body, integrity: { algorithm: 'sha256', digest: hashText(stableStringify(body)) } };
}
function conflict(code, message) {
    return {
        code,
        message,
        safeAction: 'Review the workspace and resolve this proposal explicitly.',
    };
}
function inspectionDecisions() {
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
function mutationDecisions() {
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
function isPathSafeSafely(check, root, relativePath) {
    try {
        return check(root, relativePath);
    }
    catch {
        return false;
    }
}
function canonicalInputHashes(consumerRoot, currentInputs) {
    const byPath = new Map();
    for (const { path, sourceText, exists } of currentInputs) {
        const relative = toRootRelativePath(consumerRoot, path);
        if (!relative ||
            byPath.has(relative) ||
            (exists && typeof sourceText !== 'string') ||
            (!exists && sourceText !== undefined))
            return undefined;
        byPath.set(relative, exists
            ? { sha256: hashText(sourceText), presence: 'present' }
            : { sha256: hashText(exports.ABSENT_INPUT_SENTINEL), presence: 'absent' });
    }
    return [...byPath.entries()]
        .map(([path, fingerprint]) => ({ path, ...fingerprint }))
        .sort((a, b) => a.path.localeCompare(b.path));
}
exports.ABSENT_INPUT_SENTINEL = 'ENV_PLAN_ABSENT_V1';
function isCanonicalRelativePath(path) {
    return (!!path &&
        !/[\x00-\x1f]/.test(path) &&
        !path.startsWith('/') &&
        !/^[a-zA-Z]:/.test(path) &&
        path.replaceAll('\\', '/') === path &&
        path.split('/').every((part) => !!part && part !== '.' && part !== '..'));
}
function toRootRelativePath(root, filePath) {
    const canonicalRoot = normalizeAbsolutePath(root);
    if (!canonicalRoot)
        return undefined;
    const normalizedInput = filePath.replaceAll('\\', '/');
    const absolute = normalizedInput.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedInput);
    if (!absolute)
        return normalizeRelativePath(normalizedInput);
    const canonicalInput = normalizeAbsolutePath(normalizedInput);
    if (!canonicalInput ||
        (canonicalInput !== canonicalRoot &&
            !canonicalInput.startsWith(`${canonicalRoot.replace(/\/$/, '')}/`)))
        return undefined;
    return canonicalInput.slice(canonicalRoot.replace(/\/$/, '').length).replace(/^\//, '');
}
function normalizeAbsolutePath(path) {
    const value = path.replaceAll('\\', '/');
    const drive = value.match(/^([a-zA-Z]:)\//)?.[1]?.toUpperCase();
    if (!value.startsWith('/') && !drive)
        return undefined;
    const prefix = drive ? `${drive}/` : '/';
    const rest = drive ? value.slice(3) : value.slice(1);
    const parts = [];
    for (const part of rest.split('/')) {
        if (!part || part === '.')
            continue;
        if (part === '..') {
            if (!parts.length)
                return undefined;
            parts.pop();
        }
        else
            parts.push(part);
    }
    return `${prefix}${parts.join('/')}`.replace(/\/$/, '') || prefix;
}
function normalizeRelativePath(path) {
    const parts = [];
    for (const part of path.split('/')) {
        if (!part || part === '.')
            continue;
        if (part === '..') {
            if (!parts.length)
                return undefined;
            parts.pop();
        }
        else
            parts.push(part);
    }
    return parts.length ? parts.join('/') : undefined;
}
function stableStringify(value) {
    return JSON.stringify(sortJsonValue(value));
}
function sortJsonValue(value) {
    if (Array.isArray(value))
        return value.map(sortJsonValue);
    if (!value || typeof value !== 'object')
        return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)]));
}
