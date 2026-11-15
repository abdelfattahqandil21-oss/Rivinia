"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEffectiveOutputPathCollision = findEffectiveOutputPathCollision;
exports.findOtherProjectOutputPathCollision = findOtherProjectOutputPathCollision;
function findEffectiveOutputPathCollision(target, configurationStack, destination) {
    if (!target)
        return { kind: 'unknown' };
    let outputPath;
    let configured = false;
    for (const layer of [null, ...configurationStack]) {
        const options = layer === null ? target.options : target.configurationsByName[layer];
        if (options && Object.prototype.hasOwnProperty.call(options, 'outputPath')) {
            configured = true;
            outputPath = options['outputPath'];
        }
    }
    return configured ? testOutputPath(outputPath, destination) : { kind: 'none' };
}
function findOtherProjectOutputPathCollision(targets, selectedProject, destination) {
    for (const { projectName, target } of targets) {
        if (projectName === selectedProject || !target)
            continue;
        const layers = [target.options, ...Object.values(target.configurationsByName)];
        for (const options of layers) {
            if (!options || !Object.prototype.hasOwnProperty.call(options, 'outputPath'))
                continue;
            const result = testOutputPath(options['outputPath'], destination);
            if (result.kind !== 'none')
                return result;
        }
    }
    return { kind: 'none' };
}
function testOutputPath(outputPath, destination) {
    const roots = outputRoots(outputPath);
    if (!roots)
        return { kind: 'unknown' };
    for (const root of roots) {
        if (destination === root || destination.startsWith(`${root}/`)) {
            return { kind: 'collision', path: destination };
        }
    }
    return { kind: 'none' };
}
function outputRoots(value) {
    if (typeof value === 'string')
        return safeRoot(value) ? [normalize(value)] : undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const object = value;
    if (Object.keys(object).some((key) => !['base', 'browser', 'server', 'media'].includes(key))) {
        return undefined;
    }
    const base = object['base'];
    if (typeof base !== 'string' || !safeRoot(base))
        return undefined;
    const root = normalize(base);
    const roots = [root];
    for (const key of ['browser', 'server', 'media']) {
        const segment = object[key];
        if (segment === undefined)
            continue;
        if (typeof segment !== 'string' || !safeRoot(segment))
            return undefined;
        roots.push(normalize(`${root}/${segment}`));
    }
    return roots;
}
function safeRoot(value) {
    return (!!value &&
        !value.startsWith('/') &&
        !/^[a-zA-Z]:/.test(value) &&
        !value.split(/[\\/]/).some((part) => part === '..' || part === '.'));
}
function normalize(value) {
    return value
        .replace(/\\/g, '/')
        .split('/')
        .filter((segment) => segment.length > 0)
        .join('/');
}
