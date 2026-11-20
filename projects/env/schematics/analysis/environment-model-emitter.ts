import type { ModelTypeProof } from './environment-model-proof.js';

export function emitEnvironmentModel(proof: Extract<ModelTypeProof, { kind: 'object' }>): string {
  const properties = proof.properties
    .map(
      ({ name, optional, readonly, type }) =>
        `  ${readonly ? 'readonly ' : ''}${propertyName(name)}${optional ? '?' : ''}: ${emitType(type)};`,
    )
    .join('\n');
  return `export interface EnvironmentModel {\n${properties}\n}\n`;
}

function emitType(type: ModelTypeProof): string {
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
        .map(
          ({ name, optional, readonly, type: memberType }) =>
            `${readonly ? 'readonly ' : ''}${propertyName(name)}${optional ? '?' : ''}: ${emitType(memberType)};`,
        )
        .join(' ')} }`;
  }
}

function parenthesize(type: ModelTypeProof): string {
  return type.kind === 'union' || type.kind === 'object' ? `(${emitType(type)})` : emitType(type);
}

function propertyName(name: string): string {
  return /^[$A-Z_a-z][$\w]*$/.test(name) ? name : JSON.stringify(name);
}
