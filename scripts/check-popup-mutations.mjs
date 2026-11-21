/**
 * Rebuild Popup, its consumers and the browser fixture for the clean control.
 * Consumers import Popup as a peer, so mutants rebuild Popup and the fixture.
 * Each mutant must fail exactly the named conformance cases.
 * Restore mutated source and rebuild the clean fixture before exiting.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COORDINATOR = 'projects/popup/src/lib/dismissal/dismissal-coordinator.ts';
const SESSION = 'projects/popup/src/lib/connection/popup-session.ts';
const SUITE = 'e2e/popup/conformance.spec.ts';
const HOSTS = ['select popup', 'menu panel', 'menu panel with a projected field'];

function hostCases(...titles) {
  return HOSTS.flatMap((host) => titles.map((title) => `popup conformance: ${host} › ${title}`));
}

const MUTANTS = [
  {
    label: 'width changes no longer dismiss',
    file: COORDINATOR,
    from: "if (changed && node.options.closeOnWidthChange) this.dismissTree(node, 'resize');",
    to: 'if (changed && node.options.closeOnWidthChange) node.schedule();',
    expect: hostCases('a width change closes it while focus remains inside the panel'),
  },
  {
    label: 'fully clipped origins no longer dismiss',
    file: SESSION,
    from: 'if (clippedOrigin(this.origin, viewport)) {',
    to: 'if (clippedOrigin(this.origin, viewport) && !this.origin.isConnected) {',
    expect: hostCases('scrolling the trigger completely out of view closes it'),
  },
  {
    label: 'cleanup leaves the pointerdown listener registered',
    file: COORDINATOR,
    from: "    this.document.removeEventListener('pointerdown', this.onPointerDown, true);",
    to: '',
    expect: hostCases(
      'closing cancels pending positioning work and removes every listener',
      'destroying the open panel removes every global listener',
    ),
  },
];

function run(cmd, args, label, options = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: options.env ?? process.env,
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!output.trim()) throw new Error(`${label} failed with no output: ${error.message}`);
    return { code: error.status ?? 1, output };
  }
}

/**
 * Red marks from the reporter's per-test lines, as `describe › test` titles.
 * Matching titles rather than counts is what makes an unexpected failure — a
 * build that did not land, a fixture that moved — show up as a mismatch instead
 * of quietly counting as a kill.
 *
 * The `✘` is the `list` reporter's glyph, which is what `playwright.config.ts`
 * selects. Measured: `--reporter=line` prints the same tests with no `✘` at all,
 * so a run forced onto another reporter would report every mutant as surviving.
 * The harness never overrides the reporter, and this script's own tests use the
 * captured `list` shape.
 */
export function failingCases(output) {
  const titles = output
    .split('\n')
    .filter((line) => line.includes('✘'))
    .map((line) =>
      line
        .replace(/^.*?conformance\.spec\.ts:\d+:\d+ › /, '')
        .replace(/\s*\([\d.]+m?s\)\s*$/, '')
        .trim(),
    )
    .filter((title) => title.length > 0);
  return [...new Set(titles)].sort();
}

export function failingChecks(output) {
  return [
    ...new Set(
      output
        .split('\n')
        .filter((line) => line.trim().startsWith('FAIL'))
        .map((line) =>
          line
            .trim()
            .replace(/^FAIL\s+/, '')
            .split(' — ')[0]
            .trim(),
        ),
    ),
  ].sort();
}

function assertMutationSourcesClean() {
  const files = [...new Set(MUTANTS.map((mutant) => mutant.file))];
  const output = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...files],
    { encoding: 'utf8' },
  ).trim();

  if (output) {
    throw new Error(
      `Refusing to mutate uncommitted Popup source files:\n${output}\n` +
      'Mutation testing requires a deliberately clean source baseline.',
    );
  }
}

function buildFixture({ buildConsumers = false } = {}) {
  const projects = buildConsumers ? ['popup', 'select', 'menu', 'menu-e2e'] : ['popup', 'menu-e2e'];
  for (const project of projects) {
    const { code, output } = run('pnpm', ['exec', 'ng', 'build', project], `${project} build`);
    if (code !== 0) throw new Error(`${project} build failed:\n${output}`);
  }
}

function observe() {
  const { code, output } = run(
    'pnpm',
    ['exec', 'playwright', 'test', SUITE, '--project=chromium'],
    'conformance suite',
  );
  return { code, output, failed: failingCases(output) };
}

// The run itself is for a direct invocation only: `scripts/tests` imports the
// two reporter parsers out of this file, and an import must not rebuild the
// libraries or rewrite a source file on its way through the mutants.
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const results = [];
  let aborted = null;
  let ranMutant = false;

  try {
    assertMutationSourcesClean();
    buildFixture({ buildConsumers: true });
    const control = observe();
    if (control.code !== 0 || control.failed.length) {
      throw new Error(`the clean suite is not green: ${control.failed.join(' | ') || control.output.slice(-400)}`);
    }
    const summary = control.output.split('\n').find((line) => line.includes('passed'));
    console.log(`control: the clean suite is green — ${(summary ?? '').trim()}`);

    for (const mutant of MUTANTS) {
      const source = readFileSync(mutant.file, 'utf8');
      const occurrences = source.split(mutant.from).length - 1;
      if (occurrences !== 1) {
        throw new Error(`${mutant.label}: its anchor occurs ${occurrences} times in ${mutant.file}`);
      }

      ranMutant = true;
      try {
        writeFileSync(mutant.file, source.replace(mutant.from, mutant.to));
        buildFixture();
        const { code, failed } = observe();
        const missing = mutant.expect.filter((name) => !failed.includes(name));
        const extra = failed.filter((name) => !mutant.expect.includes(name));
        const killed = code !== 0 && missing.length === 0 && extra.length === 0;
        results.push({ label: mutant.label, killed, missing, extra });
        console.log(
          `${killed ? 'KILLED  ' : 'SURVIVED'} ${mutant.label} — red: ${failed.join(' | ') || 'nothing'}`,
        );
      } finally {
        writeFileSync(mutant.file, source);
      }
    }
  } catch (error) {
    aborted = error instanceof Error ? error.message : String(error);
  } finally {
    if (ranMutant) {
      try {
        buildFixture();
      } catch (error) {
        const cleanError = `clean fixture rebuild failed: ${error instanceof Error ? error.message : String(error)}`;
        aborted = aborted ? `${aborted}\n${cleanError}` : cleanError;
      }
    }
  }

  const survivors = results.filter((result) => !result.killed);
  console.log(
    `\ncheck:popup-mutations — ${results.length} of ${MUTANTS.length} mutants run, ${results.length - survivors.length} killed exactly as expected.`,
  );
  for (const result of survivors) {
    const why = result.missing.length
      ? `expected red, stayed green: ${result.missing.join(' | ')}`
      : result.extra.length
        ? `also red, unexpectedly: ${result.extra.join(' | ')}`
        : 'the harness exited 0';
    console.log(`  SURVIVED ${result.label} — ${why}`);
  }
  if (aborted) {
    console.log(`check:popup-mutations ABORTED: ${aborted}`);
    process.exit(1);
  }
  if (survivors.length || results.length !== MUTANTS.length) {
    console.log(`check:popup-mutations FAILED (${survivors.length} surviving mutants).`);
    process.exit(1);
  }
  console.log('check:popup-mutations passed.');
}
