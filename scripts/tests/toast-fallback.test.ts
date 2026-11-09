import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(
  process.cwd(),
  'projects/toast/ui/src/lib/components/toast-list/toast-list.css',
);

describe('Toast rich-color CSS fallback', () => {
  it('keeps static pairs outside a positive color-mix feature query', () => {
    const root = postcss.parse(readFileSync(cssPath, 'utf8'), { from: cssPath });
    const statuses = ['success', 'error', 'info', 'warning'];
    const supports = root.nodes.filter(
      (node): node is postcss.AtRule => node.type === 'atrule' && node.name === 'supports',
    );
    expect(supports).toHaveLength(1);
    expect(supports[0].params).toMatch(/background:\s*color-mix\(/);

    for (const status of statuses) {
      const selector = `.rv-toasts[data-rich-colors='true'] .rv-toast[data-kind='${status}']`;
      const fallbackBackgrounds: string[] = [];
      const enhancedBackgrounds: string[] = [];

      root.walkRules(selector, (rule) => {
        let ancestor: postcss.Container | undefined = rule.parent ?? undefined;
        let insideSupports = false;
        while (ancestor) {
          if (ancestor.type === 'atrule' && ancestor.name === 'supports') insideSupports = true;
          ancestor = ancestor.parent ?? undefined;
        }

        rule.walkDecls('background', (declaration) => {
          if (declaration.value.includes('color-mix(')) {
            expect(insideSupports).toBe(true);
            enhancedBackgrounds.push(declaration.value);
          } else if (!insideSupports) {
            fallbackBackgrounds.push(declaration.value);
          }
        });
      });

      expect(fallbackBackgrounds, `${status} static fallback`).toHaveLength(1);
      expect(enhancedBackgrounds, `${status} enhancement`).toHaveLength(1);
    }
  });
});
