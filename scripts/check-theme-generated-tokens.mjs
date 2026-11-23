#!/usr/bin/env node
/**
 * Browser proof for the actual ng-add-generated consumer token stylesheet.
 * No Angular app build is needed; the test runs the shipped .cjs schematic,
 * then checks computed CSS values in Chromium/Firefox.
 * Run: node scripts/check-theme-generated-tokens.mjs [chromium|firefox]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmptyTree } from '@angular-devkit/schematics';
// Angular DevKit's `testing` subpath is a CommonJS directory entry;
// Node's native ESM loader does not support directory imports.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SchematicTestRunner, UnitTestTree } = require('@angular-devkit/schematics/testing');
import { chromium, firefox } from '@playwright/test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const collection = resolve(root, 'projects/theme/schematics/collection.json');
const source = readFileSync(resolve(root, 'projects/theme/styles/theme.css'), 'utf8');
const requested = process.argv[2];
if (requested && !['chromium', 'firefox'].includes(requested)) {
  console.error('Usage: node scripts/check-theme-generated-tokens.mjs [chromium|firefox]');
  process.exit(2);
}
const browsers = requested ? [requested] : ['chromium', 'firefox'];

async function generated(options = {}) {
  const tree = new EmptyTree();
  tree.create('/angular.json', JSON.stringify({ version: 1, projects: {
    demo: { projectType: 'application', sourceRoot: 'src',
      architect: { build: { options: { styles: ['src/styles.css'] } } } },
  } }));
  const runner = new SchematicTestRunner('rv-theme-browser-proof', collection);
  const result = await runner.runSchematic('ng-add', options, new UnitTestTree(tree));
  return result.readContent('/src/theme.tokens.css');
}

function assert(name, actual, expected) {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}; got ${actual}`);
  console.log(`PASS ${name} — ${actual}`);
}
async function setMode(page, mode, preference = 'light') {
  await page.emulateMedia({ colorScheme: preference });
  await page.evaluate((value) => {
    if (value) document.documentElement.setAttribute('data-rv-theme', value);
    else document.documentElement.removeAttribute('data-rv-theme');
  }, mode);
}
async function token(page, selector, name) {
  return page.locator(selector).evaluate((element, property) =>
    getComputedStyle(element).getPropertyValue(property).trim(), name);
}

let checks = 0;
for (const engine of browsers) {
  const browser = await (engine === 'firefox' ? firefox : chromium).launch();
  try {
    const page = await browser.newPage();
    const defaults = await generated();
    // Test unlayered existing app rules BEFORE the generated stylesheet:
    // these must not be erased by the new complete core defaults.
    await page.setContent(`<style>${source}</style><style>:root { --rv-color-primary: #aa33cc; }</style><style>${defaults}</style><div id="nested" data-rv-theme="light">nested</div>`);
    await setMode(page, '', 'light');
    assert(`${engine} root default surface`, await token(page, 'html', '--rv-color-surface'), '#ffffff'); checks++;
    assert(`${engine} existing unlayered app override survives`, await token(page, 'html', '--rv-color-primary'), '#aa33cc'); checks++;
    await setMode(page, 'dark', 'light');
    assert(`${engine} explicit dark surface`, await token(page, 'html', '--rv-color-surface'), '#182028'); checks++;
    assert(`${engine} nested light in dark`, await token(page, '#nested', '--rv-color-surface'), '#ffffff'); checks++;
    await setMode(page, 'system', 'dark');
    assert(`${engine} system OS dark surface`, await token(page, 'html', '--rv-color-surface'), '#182028'); checks++;
    await setMode(page, 'system', 'light');
    assert(`${engine} system OS light surface`, await token(page, 'html', '--rv-color-surface'), '#ffffff'); checks++;

    const overridden = await generated({ scope: 'dark', primaryColor: '#123456' });
    await page.setContent(`<style>${source}</style><style>${overridden}</style><div id="nested" data-rv-theme="light">nested</div>`);
    await setMode(page, 'dark');
    assert(`${engine} dark-only explicit override`, await token(page, 'html', '--rv-color-primary'), '#123456'); checks++;
    await setMode(page, 'light');
    assert(`${engine} dark-only override does not leak into light`, await token(page, 'html', '--rv-color-primary'), '#005fcc'); checks++;
    await setMode(page, 'system', 'dark');
    assert(`${engine} dark-only override does not leak into system`, await token(page, 'html', '--rv-color-primary'), '#8ab4ff'); checks++;
    await page.close();
  } finally {
    await browser.close();
  }
}
console.log(`${checks}/${checks} generated-tokens browser assertions PASS`);
