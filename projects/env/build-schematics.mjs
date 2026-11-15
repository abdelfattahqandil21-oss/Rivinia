import { execFileSync } from 'node:child_process';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

execFileSync(
  'pnpm',
  ['exec', 'tsc', '-p', 'projects/env/schematics/tsconfig.schematics.json'],
  { stdio: 'inherit' },
);

const outputRoot = 'projects/env/schematics';
const packageManifest = JSON.parse(await readFile('projects/env/package.json', 'utf8'));
const emittedFiles = await collectJavaScript(outputRoot);
if (emittedFiles.length === 0) {
  throw new Error('The env schematic build emitted no JavaScript files.');
}

for (const file of emittedFiles) {
  const source = await readFile(file, 'utf8');
  let commonJs = source;
  if (file.endsWith('/inspect-workspace.js')) {
    const versionToken = "exports.TOOL_VERSION = '__RIVINIA_ENV_PACKAGE_VERSION__';";
    if (!commonJs.includes(versionToken)) {
      throw new Error('The env package version marker was not found in inspect-workspace.');
    }
    commonJs = commonJs.replace(versionToken, `exports.TOOL_VERSION = '${packageManifest.version}';`);
  }
  commonJs = commonJs.replace(/(["'])(\.{1,2}\/[^"']+)\.js\1/g, '$1$2.cjs$1');
  const target = file.slice(0, -3) + '.cjs';
  await writeFile(target, commonJs);
  await unlink(file);
}

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScript(path)));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}
