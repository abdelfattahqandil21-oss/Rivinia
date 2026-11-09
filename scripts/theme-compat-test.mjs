import { spawnSync } from 'node:child_process';

const configurations = [
  'plain',
  'tailwind',
  'tailwind-no-preflight',
  'tailwind-prefix',
  'bootstrap',
  'scss',
  'less',
];

function run(args, env = process.env) {
  process.stdout.write(`$ pnpm ${args.join(' ')}\n`);
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} exited with ${result.status}`);
}

run(['run', 'build:theme-compat']);
for (const configuration of configurations) {
  run(
    ['exec', 'playwright', 'test', '--config=playwright.theme-compat.config.ts', '--project=chromium'],
    { ...process.env, RV_THEME_CONFIG: configuration, PLAYWRIGHT_HTML_OPEN: 'never' },
  );
}
