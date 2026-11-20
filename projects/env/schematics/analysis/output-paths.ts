import type { DiscoveredTarget } from './workspace-discovery.js';

export type OutputPathCollision =
  | { readonly kind: 'none' }
  | { readonly kind: 'collision'; readonly path: string }
  | { readonly kind: 'unknown' };

export function findEffectiveOutputPathCollision(
  target: DiscoveredTarget | undefined,
  configurationStack: readonly string[],
  destination: string,
): OutputPathCollision {
  if (!target) return { kind: 'unknown' };
  let outputPath: unknown;
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

export function findOtherProjectOutputPathCollision(
  targets: readonly { readonly projectName: string; readonly target?: DiscoveredTarget }[],
  selectedProject: string,
  destination: string,
): OutputPathCollision {
  for (const { projectName, target } of targets) {
    if (projectName === selectedProject || !target) continue;
    const layers = [target.options, ...Object.values(target.configurationsByName)];
    for (const options of layers) {
      if (!options || !Object.prototype.hasOwnProperty.call(options, 'outputPath')) continue;
      const result = testOutputPath(options['outputPath'], destination);
      if (result.kind !== 'none') return result;
    }
  }
  return { kind: 'none' };
}

function testOutputPath(outputPath: unknown, destination: string): OutputPathCollision {
  const roots = outputRoots(outputPath);
  if (!roots) return { kind: 'unknown' };
  for (const root of roots) {
    if (destination === root || destination.startsWith(`${root}/`)) {
      return { kind: 'collision', path: destination };
    }
  }
  return { kind: 'none' };
}

function outputRoots(value: unknown): readonly string[] | undefined {
  if (typeof value === 'string') return safeRoot(value) ? [normalize(value)] : undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !['base', 'browser', 'server', 'media'].includes(key))) {
    return undefined;
  }
  const base = object['base'];
  if (typeof base !== 'string' || !safeRoot(base)) return undefined;
  const root = normalize(base);
  const roots = [root];
  for (const key of ['browser', 'server', 'media']) {
    const segment = object[key];
    if (segment === undefined) continue;
    if (typeof segment !== 'string' || !safeRoot(segment)) return undefined;
    roots.push(normalize(`${root}/${segment}`));
  }
  return roots;
}

function safeRoot(value: string): boolean {
  return (
    !!value &&
    !value.startsWith('/') &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).some((part) => part === '..' || part === '.')
  );
}

function normalize(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0)
    .join('/');
}
