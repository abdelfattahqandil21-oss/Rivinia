"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitEnvironmentModel = emitEnvironmentModel;
function emitEnvironmentModel(proof) {
    const properties = proof.properties
        .map(({ name, optional, readonly, type }) => `  ${readonly ? 'readonly ' : ''}${propertyName(name)}${optional ? '?' : ''}: ${emitType(type)};`)
        .join('\n');
    return `export interface EnvironmentModel {\n${properties}\n}\n`;
}
function emitType(type) {
    switch (type.kind) {
        case 'primitive':
            return type.name;
        case 'null':
        case 'undefined':
            return type.kind;
        case 'array':
            return type.readonly
                ? `readonly ${parenthesize(type.element)}[]`
                : `${parenthesize(type.element)}[]`;
        case 'tuple':
            return `${type.readonly ? 'readonly ' : ''}[${type.elements.map(emitType).join(', ')}]`;
        case 'union':
            return type.members.map(emitType).join(' | ');
        case 'object':
            return `{ ${type.properties
                .map(({ name, optional, readonly, type: memberType }) => `${readonly ? 'readonly ' : ''}${propertyName(name)}${optional ? '?' : ''}: ${emitType(memberType)};`)
                .join(' ')} }`;
    }
}
function parenthesize(type) {
    return type.kind === 'union' || type.kind === 'object' ? `(${emitType(type)})` : emitType(type);
}
function propertyName(name) {
    return /^[$A-Z_a-z][$\w]*$/.test(name) ? name : JSON.stringify(name);
}
