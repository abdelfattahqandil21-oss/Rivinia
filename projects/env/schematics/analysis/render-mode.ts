import type { DiscoveredTarget } from './workspace-discovery.js';

const RENDER_MODE_OPTIONS = ['server', 'ssr', 'prerender', 'outputMode'] as const;

export function getUnsupportedRenderModes(
  build: DiscoveredTarget | undefined,
  configurationStacks?: readonly (readonly string[])[],
): readonly string[] {
  if (!build) return [];

  const stacks = configurationStacks ?? [
    ...(build.defaultConfiguration ? [[build.defaultConfiguration]] : [[]]),
    ...build.configurations.map((configuration) => [configuration]),
  ];
  const modes = new Set<string>();
  for (const stack of stacks) {
    const options = effectiveRenderOptions(build, stack);
    const server = options['server'];
    if (server === false || server === undefined) {
      // The application builder explicitly allows server: false.
    } else if (typeof server === 'string' && server.length > 0) modes.add('server');
    else modes.add('server (unrecognized)');

    addBooleanOrObjectMode(modes, 'ssr', options['ssr']);
    addBooleanOrObjectMode(modes, 'prerender', options['prerender']);

    const outputMode = options['outputMode'];
    if (outputMode === undefined) {
      // No output mode means the builder default.
    } else if (typeof outputMode === 'string' && outputMode.length > 0) {
      modes.add(`outputMode=${outputMode}`);
    } else modes.add('outputMode (unrecognized)');
  }
  return [...modes].sort();
}

function effectiveRenderOptions(
  build: DiscoveredTarget,
  stack: readonly string[],
): Readonly<Record<string, unknown>> {
  const effective: Record<string, unknown> = {};
  for (const option of RENDER_MODE_OPTIONS) {
    if (Object.hasOwn(build.options, option)) effective[option] = build.options[option];
  }
  for (const configuration of stack) {
    const layer = build.configurationsByName[configuration];
    if (!layer) continue;
    for (const option of RENDER_MODE_OPTIONS) {
      if (Object.hasOwn(layer, option)) effective[option] = layer[option];
    }
  }
  return effective;
}

function addBooleanOrObjectMode(modes: Set<string>, name: string, value: unknown): void {
  if (value === undefined || value === false) return;
  if (value === true || isRecord(value)) {
    modes.add(name);
    return;
  }
  modes.add(`${name} (unrecognized)`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
