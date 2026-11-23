import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EmptyTree } from '@angular-devkit/schematics';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { describe, expect, it } from 'vitest';

const collection = fileURLToPath(new URL('../../../projects/theme/schematics/collection.json', import.meta.url));
const themeSource = readFileSync(fileURLToPath(new URL('../../../projects/theme/styles/theme.css', import.meta.url)), 'utf8');

async function generated(options: Record<string, unknown> = {}): Promise<string> {
  const base = new EmptyTree();
  base.create('/angular.json', JSON.stringify({
    version: 1,
    projects: { demo: { projectType: 'application', root: '', sourceRoot: 'src',
      architect: { build: { options: { styles: ['src/styles.css'] } } },
    } },
  }));
  const runner = new SchematicTestRunner('rivinia-theme', collection);
  const output = await runner.runSchematic('ng-add', options, new UnitTestTree(base));
  return output.readContent('/src/theme.tokens.css');
}

function tokens(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--rv-[a-z\d-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  expect(close).toBeGreaterThan(open);
  return tokens(css.slice(open + 1, close));
}

const shippedLight = block(themeSource, ':root,');
const shippedDark = block(themeSource, "[data-rv-theme='dark']");
const expectedDark = new Map([...shippedLight, ...shippedDark]);

function assertPalette(css: string, selector: string, expected: Map<string, string>) {
  const actual = block(css, selector);
  expect(actual.size).toBe(expected.size);
  for (const [name, value] of expected) expect(actual.get(name), `${selector} ${name}`).toBe(value);
}

describe('Theme V2 generated consumer token defaults', () => {
  it('generates all 20 shipped semantic/shape/space/type/elevation defaults', async () => {
    const css = await generated();
    expect(shippedLight.size).toBe(20);
    assertPalette(css, ':root,', shippedLight);
  });

  it('generates a full dark palette, including inherited core shape tokens', async () => {
    const css = await generated();
    assertPalette(css, "[data-rv-theme='dark']", expectedDark);
  });

  it('generates OS-dark system palette after the system light palette', async () => {
    const css = await generated();
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect((css.match(/\[data-rv-theme='system'\]/g) ?? []).length).toBe(2);
    assertPalette(css.slice(css.indexOf('@media (prefers-color-scheme: dark)')), "[data-rv-theme='system']", expectedDark);
  });

  it('keeps generated defaults inside a later layer, without unlayered declarations by default', async () => {
    const css = await generated();
    expect(css).toContain('@layer rivinia-theme, rivinia-consumer-tokens;');
    expect(css).toContain('@layer rivinia-consumer-tokens {');
    const afterLayer = css.slice(css.lastIndexOf('}\n') + 2);
    expect(afterLayer.trim()).toBe('');
  });

  it('explicit dark-only override is unlayered and leaves light/system defaults alone', async () => {
    const css = await generated({ scope: 'dark', primaryColor: '#123456', textColor: '#fff' });
    expect(css).toContain("[data-rv-theme='dark'] {\n  --rv-color-primary: #123456;\n  --rv-color-text: #fff;\n}");
    assertPalette(css, ':root,', shippedLight);
    assertPalette(css, "[data-rv-theme='dark']", expectedDark);
  });

  it('default root scope preserves the pre-existing override option contract', async () => {
    const css = await generated({ primaryColor: '#123456' });
    expect(css).toContain(':root {\n  --rv-color-primary: #123456;\n}');
    expect(css).toContain('A root override also applies when the root is in dark/system mode');
  });

  it('system-only overrides are separate from the layered light and dark defaults', async () => {
    const css = await generated({ scope: 'system', borderColor: '#123456' });
    expect(css).toContain("[data-rv-theme='system'] {\n  --rv-color-border: #123456;\n}");
    expect(css).not.toContain('  --rv-color-primary: #123456;');
  });
});
