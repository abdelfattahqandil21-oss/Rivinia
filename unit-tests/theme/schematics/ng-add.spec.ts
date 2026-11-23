import { EmptyTree } from '@angular-devkit/schematics';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { parse as parseJsonc } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';

/** Contract tests exercise the shipped .cjs entry, not an imaginary TS implementation. */
const COLLECTION = new URL('../../../projects/theme/schematics/collection.json', import.meta.url).pathname;
const THEME = 'node_modules/@rivinia/theme/theme.css';
const TOKEN = 'src/theme.tokens.css';

type App = { projectType: string; root: string; sourceRoot: string; architect: {
  build: { options: { styles: Array<string | { input: string; inject?: boolean }> } }
}};

function app(sourceRoot = 'src', styles: App['architect']['build']['options']['styles'] = ['src/styles.css']): App {
  return { projectType: 'application', root: '', sourceRoot, architect: { build: { options: { styles } } } };
}

function tree(config?: Record<string, unknown>, otherFiles: Record<string, string> = {}): UnitTestTree {
  const t = new EmptyTree();
  t.create('/angular.json', JSON.stringify(config ?? { version: 1, projects: { demo: app() } }, null, 2));
  for (const [path, contents] of Object.entries(otherFiles)) t.create(path, contents);
  return new UnitTestTree(t);
}

async function run(options: Record<string, unknown> = {}, base = tree()): Promise<UnitTestTree> {
  const runner = new SchematicTestRunner('rivinia-theme', COLLECTION);
  return runner.runSchematic('ng-add', options, base);
}

function styles(t: UnitTestTree, project = 'demo'): Array<string | { input: string; inject?: boolean }> {
  const cfg = parseJsonc(t.readContent('/angular.json'));
  return cfg.projects[project].architect.build.options.styles;
}

function styleInput(s: string | { input: string }) { return typeof s === 'string' ? s : s.input; }

function occurrences(s: string[], value: string): number {
  return s.filter((i) => i === value).length;
}

describe('Theme V2 ng-add — packaged schematic contract', () => {
  it('registers CSS before consumer tokens, and never modifies unrelated app styles', async () => {
    const t = await run();
    expect(styles(t).map(styleInput)).toEqual([THEME, 'src/styles.css', TOKEN]);
    expect(t.exists('/' + TOKEN)).toBe(true);
    expect(t.readContent('/' + TOKEN)).toContain('Consumer-owned Rivinia Theme overrides');
    expect(t.files).toEqual(expect.arrayContaining(['/angular.json', '/' + TOKEN]));
  });

  it('running twice is byte-for-byte idempotent', async () => {
    const first = await run();
    const previous = first.readContent('/angular.json');
    const previousTokens = first.readContent('/' + TOKEN);
    const second = await run({}, first);
    expect(second.readContent('/angular.json')).toBe(previous);
    expect(second.readContent('/' + TOKEN)).toBe(previousTokens);
    expect(occurrences(styles(second).map(styleInput), THEME)).toBe(1);
    expect(occurrences(styles(second).map(styleInput), TOKEN)).toBe(1);
  });

  it('requires explicit --project with multiple supported Angular applications', async () => {
    const t = tree({ version: 1, projects: { first: app('first/src'), second: app('second/src') } });
    const before = t.readContent('/angular.json');
    await expect(run({}, t)).rejects.toThrow(/multiple Angular applications/i);
    expect(t.readContent('/angular.json')).toBe(before);
    expect(t.files).toEqual(['/angular.json']);
  });

  it('configures only the selected application', async () => {
    const base = tree({ version: 1, projects: {
      first: app('first/src', ['first/src/styles.css']),
      second: app('second/src', ['second/src/styles.scss']),
    } });
    const t = await run({ project: 'second' }, base);
    expect(styles(t, 'first')).toEqual(['first/src/styles.css']);
    expect(styles(t, 'second').map(styleInput)).toEqual([THEME, 'second/src/styles.scss', 'second/src/theme.tokens.css']);
    expect(t.exists('/second/src/theme.tokens.css')).toBe(true);
    expect(t.exists('/first/src/theme.tokens.css')).toBe(false);
  });

  it('preserves existing consumer token file exactly', async () => {
    const custom = ':root { --rv-color-primary: rebeccapurple; }\n';
    const t = await run({}, tree(undefined, { ['/' + TOKEN]: custom }));
    expect(t.readContent('/' + TOKEN)).toBe(custom);
    expect(styles(t).map(styleInput)).toEqual([THEME, 'src/styles.css', TOKEN]);
  });

  it('preserves existing theme entry without duplicating it', async () => {
    const t = await run({}, tree({ version: 1, projects: { demo: app('src', ['src/styles.css', THEME]) } }));
    expect(occurrences(styles(t).map(styleInput), THEME)).toBe(1);
    expect(occurrences(styles(t).map(styleInput), TOKEN)).toBe(1);
  });

  it('rejects existing duplicate theme entries without editing inputs', async () => {
    const t = tree({ version: 1, projects: { demo: app('src', [THEME, THEME]) } });
    const prior = t.readContent('/angular.json');
    await expect(run({}, t)).rejects.toThrow(/duplicate/i);
    expect(t.readContent('/angular.json')).toBe(prior);
    expect(t.exists('/' + TOKEN)).toBe(false);
  });

  it('rejects inject:false theme entry without editing inputs', async () => {
    const t = tree({ version: 1, projects: { demo: app('src', [{ input: THEME, inject: false }]) } });
    await expect(run({}, t)).rejects.toThrow(/inject:false/);
    expect(t.exists('/' + TOKEN)).toBe(false);
  });

  it('rejects invalid token path traversal and leaves source files unchanged', async () => {
    const t = tree();
    await expect(run({ tokensPath: '../escape.css' }, t)).rejects.toThrow(/sourceRoot|workspace-relative/);
    expect(t.exists('/' + TOKEN)).toBe(false);
    expect(styles(t)).toEqual(['src/styles.css']);
  });

  it('rejects invalid colour without any Tree writes', async () => {
    const t = tree();
    await expect(run({ primaryColor: 'javascript:alert(1)' }, t)).rejects.toThrow();
    expect(t.exists('/' + TOKEN)).toBe(false);
    expect(styles(t)).toEqual(['src/styles.css']);
  });

  it('honors explicit color overrides and the requested CSS scope', async () => {
    const t = await run({ scope: 'dark', primaryColor: '#123456', textColor: '#fff' });
    const css = t.readContent('/' + TOKEN);
    expect(css).toContain("[data-rv-theme='dark']");
    expect(css).toContain('--rv-color-primary: #123456;');
    expect(css).toContain('--rv-color-text: #fff;');
    expect(css).toContain('Consumer-owned Rivinia Theme overrides');
  });

  it('preserves package.json and never auto-installs frameworks', async () => {
    const content = JSON.stringify({ dependencies: { bootstrap: '^5.3.8', tailwindcss: '^4.3.5' } });
    const t = await run({}, tree(undefined, { '/package.json': content }));
    expect(t.readContent('/package.json')).toBe(content);
    expect(t.files).toEqual(expect.arrayContaining(['/package.json']));
  });

  it('handles JSONC with comments and trailing commas without deleting user comments', async () => {
    const content = `{
  "version": 1,
  "projects": {
    "demo": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "architect": { "build": { "options": {
        "styles": [
          "src/styles.css", // preserve this comment
        ],
      } } }
    }
  }
}
`;
    const base = new EmptyTree();
    base.create('/angular.json', content);
    const t = await run({}, new UnitTestTree(base));
    const result = t.readContent('/angular.json');
    expect(result).toContain('// preserve this comment');
    expect(styles(t).map(styleInput)).toEqual([THEME, 'src/styles.css', TOKEN]);
  });

  it('rejects malformed workspace before file creation', async () => {
    const original = '{ invalid json';
    const t = new EmptyTree();
    t.create('/angular.json', original);
    const base = new UnitTestTree(t);
    await expect(run({}, base)).rejects.toThrow(/malformed/i);
    expect(base.readContent('/angular.json')).toBe(original);
    expect(base.files).toEqual(['/angular.json']);
  });
});
