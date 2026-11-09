import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const configurations = [
  'plain',
  'tailwind',
  'tailwind-no-preflight',
  'tailwind-prefix',
  'bootstrap',
  'scss',
  'less',
];

function run(args) {
  process.stdout.write(`$ pnpm ${args.join(' ')}\n`);
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} exited with ${result.status}`);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile() && !entry.name.endsWith('.map')) files.push(path);
  }
  return files.sort();
}

async function treeFingerprint(directory) {
  const files = await filesUnder(directory);
  const hash = createHash('sha256');
  for (const path of files) {
    hash.update(relative(directory, path)).update('\0').update(await readFile(path));
  }
  return { sha256: hash.digest('hex'), files: files.length };
}

async function existingHarnessFingerprints() {
  return {
    menu: await treeFingerprint(resolve(root, 'dist/menu-e2e/browser')),
    i18n: await treeFingerprint(resolve(root, 'dist/i18n-e2e-csr/browser')),
  };
}

for (const script of ['build:popup', 'build:select', 'build:datepicker', 'build:theme']) {
  run(['run', script]);
}

run(['exec', 'ng', 'build', 'menu-e2e']);
run(['exec', 'ng', 'build', 'i18n-e2e', '--configuration', 'csr']);
const beforeExisting = await existingHarnessFingerprints();

for (const configuration of configurations) {
  run([
    'exec',
    'ng',
    'build',
    'theme-compat-e2e',
    '--configuration',
    `production,${configuration}`,
  ]);
}

run(['exec', 'ng', 'build', 'menu-e2e']);
run(['exec', 'ng', 'build', 'i18n-e2e', '--configuration', 'csr']);
const afterExisting = await existingHarnessFingerprints();

if (JSON.stringify(beforeExisting) !== JSON.stringify(afterExisting)) {
  throw new Error(
    `Existing E2E outputs changed while building the isolated fixture.\nBefore: ${JSON.stringify(beforeExisting)}\nAfter: ${JSON.stringify(afterExisting)}`,
  );
}

const report = spawnSync('node', ['scripts/theme-compat-size.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (report.error) throw report.error;
if (report.status !== 0) throw new Error(`theme-compat-size.mjs exited with ${report.status}`);

const reportPath = resolve(root, 'dist/theme-compat-e2e/isolation-report.json');
const existingReport = JSON.parse(await readFile(reportPath, 'utf8'));
existingReport.harnessIsolation = { before: beforeExisting, after: afterExisting, identical: true };
await writeFile(reportPath, `${JSON.stringify(existingReport, null, 2)}\n`);
console.log('Isolation verified: menu-e2e and i18n-e2e emitted files are byte-identical before and after the CSS matrix.');
