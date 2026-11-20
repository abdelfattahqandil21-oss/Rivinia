import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CSS,
  MINIMUM,
  PALETTE,
  PAIRS,
  auditPalette,
  auditThemeCss,
  contrastRatio,
  formatRows,
  luminance,
  parseBlocks,
  parseHex,
} from '../check-contrast.mjs';

/**
 * The contrast gate answers one question: does the theme it ships still meet
 * the WCAG AA promise, in both schemes? The maths is tested against known
 * values and the stylesheet against the palette, so a value edited in one of
 * the two dark blocks cannot pass unnoticed.
 */

const light: Record<string, string> = {
  bg: '#ffffff',
  fg: '#101820',
  muted: '#454f58',
  border: '#767676',
  accent: '#005fcc',
  danger: '#dc2626',
  ok: '#16a34a',
  info: '#2563eb',
  warning: '#d97706',
};

const dark: Record<string, string> = {
  bg: '#182028',
  fg: '#f5f7fa',
  muted: '#c4ced8',
  border: '#8292a1',
  accent: '#8ab4ff',
  danger: '#f87171',
  ok: '#4ade80',
  info: '#60a5fa',
  warning: '#fbbf24',
};

function block(tokens: Record<string, string>, scheme: string): string {
  const names: Record<string, string> = {
    bg: 'color-surface', fg: 'color-text', muted: 'color-text-muted',
    border: 'color-border', accent: 'color-primary', danger: 'color-danger',
    ok: 'color-success', info: 'color-info', warning: 'color-warning',
  };
  const lines = Object.entries(tokens).map(([name, value]) => `    --rv-${names[name]}: ${value};`);
  return `    color-scheme: ${scheme};\n${lines.join('\n')}`;
}

/** A minimal stylesheet with the same shape as the real one. */
function stylesheet(
  overrides: { light?: Record<string, string>; dark?: Record<string, string> } = {},
): string {
  const lightTokens = { ...light, ...overrides.light };
  const darkTokens = { ...dark, ...overrides.dark };
  return `@layer rivinia-theme {
  :root,
  [data-rv-theme='light'],
  [data-rv-theme='system'] {
${block(lightTokens, 'light')}
  }
  @media (prefers-color-scheme: dark) {
    [data-rv-theme='system'] {
${block(darkTokens, 'dark')}
    }
  }
  [data-rv-theme='dark'] {
${block(darkTokens, 'dark')}
  }
}
`;
}

describe('the contract', () => {
  it('holds the documented thresholds', () => {
    // D87: 4.5:1 text, 3:1 non-text. A lower number here is a weaker promise.
    expect(MINIMUM).toEqual({ text: 4.5, indicator: 3, decorative: 3 });
  });

  it('classifies each token as D87 classifies it', () => {
    expect(PAIRS.map((pair) => `${pair.fg}:${pair.kind}`)).toEqual([
      'fg:text',
      'muted:text',
      'accent:text',
      'danger:indicator',
      'ok:indicator',
      'info:indicator',
      'warning:indicator',
      'border:decorative',
    ]);
    expect(PAIRS.every((pair) => pair.bg === 'bg')).toBe(true);
  });
});

describe('contrast maths', () => {
  it('black on white is 21:1, and the ratio is symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#5b5bd6', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#5b5bd6'),
      10,
    );
  });

  it('separates a pass from a fail at the 4.5 line', () => {
    // #767676 is the classic "just passes" grey on white; #777777 does not.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it('rejects anything that is not a six-digit hex', () => {
    expect(() => parseHex('red')).toThrow(/six-digit hex/);
    expect(() => parseHex('#fff')).toThrow(/six-digit hex/);
    expect(() => parseHex('rgba(0,0,0,.5)')).toThrow(/six-digit hex/);
    expect(parseHex('#5B5BD6')).toEqual([91, 91, 214]);
  });

  it('matches the WCAG reference luminance', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 6);
    expect(luminance('#000000')).toBeCloseTo(0, 6);
    expect(luminance('#808080')).toBeCloseTo(0.2159, 4);
  });
});

describe('auditThemeCss', () => {
  it('accepts a stylesheet that carries the palette in all three blocks', () => {
    const report = auditThemeCss(stylesheet());
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('reports a token edited in one block', () => {
    const report = auditThemeCss(stylesheet({ light: { muted: '#999999' } }));
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toMatch(
      /light: --rv-color-text-muted is #999999, the palette says #454f58/,
    );
  });

  it('reports a dark value that lands in only one of the two dark blocks', () => {
    const css = stylesheet().replace(
      `  [data-rv-theme='dark'] {\n${block(dark, 'dark')}`,
      `  [data-rv-theme='dark'] {\n${block({ ...dark, muted: '#808080' }, 'dark')}`,
    );
    const report = auditThemeCss(css);
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toMatch(/the two dark blocks disagree \(--rv-color-text-muted\)/);
  });

  it('reports a missing block', () => {
    const css = stylesheet().replace(/\[data-rv-theme='dark'\] \{[\s\S]*?\n  \}\n/, '');
    const report = auditThemeCss(css);
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toMatch(/no `\[data-rv-theme="dark"\]` block/);
  });

  it('reports a canonical block declared twice', () => {
    // findBlock reads the first; the browser applies the last.
    const css = `${stylesheet()}\n:root, [data-rv-theme='light'], [data-rv-theme='system'] { --rv-color-surface: #ffffff; }\n`;
    const report = auditThemeCss(css);
    expect(report.problems.join('\n')).toMatch(/declares `:root, \[data-rv-theme="light"\], \[data-rv-theme="system"\]` 2 times/);
  });

  it('reports a block that lost its color-scheme', () => {
    const report = auditThemeCss(stylesheet().replace('    color-scheme: light;\n', ''));
    expect(report.problems.join('\n')).toMatch(/must declare `color-scheme: light`/);
  });

  it('reports a token that is missing from both dark blocks', () => {
    const report = auditThemeCss(stylesheet().replace(/ *--rv-color-success: [^\n]*\n/g, ''));
    expect(report.problems.join('\n')).toMatch(/dark: --rv-color-success is not declared in the dark block/);
  });

  it('fails a palette whose dark muted grey drops under 4.5:1', () => {
    // Palette-level, so the drift check does not answer first.
    const report = auditPalette({ light, dark: { ...dark, muted: '#666666' } });
    expect(report.problems.join('\n')).toMatch(/dark: --rv-color-text-muted .* below 4.5:1/);
  });

  it('measures the decorative border without failing on it', () => {
    const report = auditThemeCss(stylesheet());
    const border = report.rows.find((row) => row.pair.fg === 'border' && row.scheme === 'light');
    expect(border?.enforced).toBe(false);
    expect(border?.ratio).toBeLessThan(3);
    expect(report.ok).toBe(true);
  });

  it('prints one line per pair with the verdict', () => {
    const report = auditThemeCss(stylesheet());
    const text = formatRows(report.rows);
    expect(text.split('\n')).toHaveLength(report.rows.length);
    expect(text).toMatch(
      /text +--rv-color-text on --rv-color-surface +#101820 on #ffffff +17\.\d+:1 \(min 4\.5\) +pass/,
    );
    expect(text).toMatch(/decorative --rv-color-border on --rv-color-surface .*recommended 3\) +info/);
  });
});

describe('the shipped stylesheet', () => {
  it('passes the gate', () => {
    const report = auditThemeCss(readFileSync(DEFAULT_CSS, 'utf8'));
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('declares every palette token in the light and the attribute dark block', () => {
    // Read from the file, not from PALETTE: the gate must cover what ships.
    const blocks = parseBlocks(readFileSync(DEFAULT_CSS, 'utf8'));
    const declared = {
      light: blocks.find((block) => block.selector === ':root, [data-rv-theme="light"], [data-rv-theme="system"]' && block.media === null),
      dark: blocks.find(
        (block) => block.selector === '[data-rv-theme="dark"]' && block.media === null,
      ),
    };
    expect(declared.light, 'a light/system token scope block').toBeDefined();
    expect(declared.dark, 'a dark token scope block').toBeDefined();
    const names: Record<string, string> = {
      bg: 'color-surface', fg: 'color-text', muted: 'color-text-muted',
      border: 'color-border', accent: 'color-primary', danger: 'color-danger',
      ok: 'color-success', info: 'color-info', warning: 'color-warning',
    };
    for (const scheme of ['light', 'dark'] as const) {
      for (const token of Object.keys(PALETTE[scheme])) {
        const name = `--rv-${names[token]}`;
        expect(declared[scheme]?.declarations.get(name), `${scheme} ${name}`).toBe(PALETTE[scheme][token]);
      }
    }
  });

  it('is the file the theme actually builds from', () => {
    expect(DEFAULT_CSS.endsWith(join('projects', 'theme', 'styles', 'theme.css'))).toBe(true);
  });
});
