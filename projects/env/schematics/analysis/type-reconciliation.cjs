"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileEnvironmentTypes = reconcileEnvironmentTypes;
const typescript_type_description_js_1 = require("./typescript-type-description.cjs");
function reconcileEnvironmentTypes(environments, maxTypeDepth = 8) {
    const propertiesByPath = new Map();
    for (const environment of environments) {
        for (const property of environment.properties) {
            const variants = propertiesByPath.get(property.path) ?? new Map();
            variants.set(environment.name, property);
            propertiesByPath.set(property.path, variants);
        }
    }
    const fields = [];
    const diagnostics = [];
    for (const [path, variants] of propertiesByPath) {
        const present = [...variants.values()];
        const unknown = present.some((property) => property.typeStatus === 'unknown' ||
            property.type.kind === 'unknown' ||
            (0, typescript_type_description_js_1.hasUnprovenStructuralObjectShape)(property.type));
        const firstSignature = present[0] ? compatibleFamily(present[0].type) : '';
        const incompatible = present.some((property) => compatibleFamily(property.type) !== firstSignature);
        const status = unknown ? 'unknown' : incompatible ? 'incompatible' : 'compatible';
        const commonType = status === 'compatible' && present[0] ? normalizeCommonType(present[0].type) : undefined;
        const presenceByEnvironment = environments.map((environment) => {
            const property = variants.get(environment.name);
            return property
                ? {
                    environment: environment.name,
                    status: 'present',
                    type: property.type,
                    typeStatus: property.typeStatus,
                    valueStatus: property.valueStatus,
                    sourceProvenance: property.sourceProvenance,
                }
                : { environment: environment.name, status: 'missing' };
        });
        fields.push({ path, status, commonType, presenceByEnvironment });
        if (unknown) {
            diagnostics.push({
                code: 'ENV_ANALYSIS_TYPE_UNKNOWN',
                severity: 'error',
                blocking: true,
                path,
                sourceLocation: present.find((property) => property.typeStatus === 'unknown' ||
                    property.type.kind === 'unknown' ||
                    (0, typescript_type_description_js_1.hasUnprovenStructuralObjectShape)(property.type))?.sourceProvenance,
                message: containsTypeDepthLimit(present.map((property) => property.type))
                    ? `Type description exceeded the configured depth budget of ${maxTypeDepth}.`
                    : 'The TypeScript checker could not prove a stable type for this property.',
                safeAction: containsTypeDepthLimit(present.map((property) => property.type))
                    ? `Reduce the inferred type depth below ${maxTypeDepth} and retry.`
                    : 'Add an explicit static type or resolve the expression before continuing.',
                resourceBudget: containsTypeDepthLimit(present.map((property) => property.type))
                    ? { kind: 'type-depth', limit: maxTypeDepth }
                    : undefined,
            });
        }
        else if (incompatible) {
            diagnostics.push({
                code: 'ENV_ANALYSIS_TYPE_CONFLICT',
                severity: 'error',
                blocking: true,
                path,
                sourceLocation: present.find((property) => compatibleFamily(property.type) !== firstSignature)?.sourceProvenance,
                message: 'Selected environments use incompatible statically inferred types at this property path.',
                safeAction: 'Review the environment-specific declarations and resolve the type decision explicitly.',
            });
        }
    }
    fields.sort((left, right) => left.path.localeCompare(right.path));
    return { fields, diagnostics };
}
function typeSignature(type) {
    return (0, typescript_type_description_js_1.getCompatibilitySignature)(type);
}
function compatibleFamily(type) {
    if (type.kind === 'union' && type.members) {
        const members = [...new Set(type.members.map(compatibleFamily))].sort();
        return members.length === 1
            ? members[0]
            : `union:${members.map((member) => `${member.length}:${member}`).join('')}`;
    }
    return typeSignature(type);
}
function normalizeCommonType(type) {
    if (type.kind === 'union' && type.members) {
        const members = [
            ...new Map(type.members.map((member) => [compatibleFamily(member), member])).values(),
        ];
        if (members.length === 1)
            return normalizeCommonType(members[0]);
        return { kind: 'union', members: members.map(normalizeCommonType) };
    }
    return type;
}
function containsTypeDepthLimit(types) {
    return types.some((type) => type.unknownReason === 'type-depth' ||
        (type.members ? containsTypeDepthLimit(type.members) : false));
}
