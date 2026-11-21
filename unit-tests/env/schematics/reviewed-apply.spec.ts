import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isSafeConsumerPath, isSafeConsumerReadPath } from '../../../projects/env/schematics/reviewed-apply.js';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('consumer path safety', () => {
  it('permits read-only pnpm links that resolve inside the workspace, but rejects writes through them', () => {
    const root = createWorkspace();
    const packageRoot = join(root, 'node_modules/.pnpm/tslib@2.9.1/node_modules/tslib');
    const linkedPackage = join(root, 'node_modules/tslib');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'index.d.ts'), 'export {};\n');
    mkdirSync(dirname(linkedPackage), { recursive: true });
    symlinkSync(
      relative(dirname(linkedPackage), packageRoot),
      linkedPackage,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    expect(isSafeConsumerReadPath(root, 'node_modules/tslib/index.d.ts')).toBe(true);
    expect(isSafeConsumerPath(root, 'node_modules/tslib/index.d.ts')).toBe(false);
  });

  it('rejects read links that escape the consumer workspace', () => {
    const root = createWorkspace();
    const outside = mkdtempSync(join(tmpdir(), 'rivinia-env-outside-'));
    temporaryRoots.push(outside);
    const outsideFile = join(outside, 'private.d.ts');
    const linkedFile = join(root, 'linked.d.ts');
    writeFileSync(outsideFile, 'export {};\n');
    symlinkSync(outsideFile, linkedFile, process.platform === 'win32' ? 'file' : undefined);

    expect(isSafeConsumerReadPath(root, 'linked.d.ts')).toBe(false);
  });

  it('allows a not-yet-created input path when its existing ancestors are safe', () => {
    const root = createWorkspace();

    expect(isSafeConsumerReadPath(root, 'src/environments/environment.ts')).toBe(true);
  });
});

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'rivinia-env-workspace-'));
  temporaryRoots.push(root);
  writeFileSync(join(root, 'angular.json'), '{"version":1}\n');
  return root;
}
