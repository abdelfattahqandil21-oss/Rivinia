import { createHash } from 'node:crypto';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

const root = process.cwd();
const outputRoot = resolve(root, 'dist/theme-compat-e2e');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const configurations = [
  'plain',
  'tailwind',
  'tailwind-no-preflight',
  'tailwind-prefix',
  'bootstrap',
  'scss',
  'less',
];

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

function byteMetrics(files) {
  const contents = files.map(({ data }) => data);
  return {
    raw: contents.reduce((sum, data) => sum + data.length, 0),
    gzip: contents.reduce((sum, data) => sum + gzipSync(data, { level: 9 }).length, 0),
    brotli: contents.reduce(
      (sum, data) =>
        sum +
        brotliCompressSync(data, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
        }).length,
      0,
    ),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  versions: {
    node: process.version,
    pnpm: packageJson.packageManager,
    angularBuild: packageJson.devDependencies['@angular/build'],
    tailwindcss: packageJson.devDependencies.tailwindcss,
    tailwindPostcss: packageJson.devDependencies['@tailwindcss/postcss'],
    postcss: packageJson.devDependencies.postcss,
    bootstrap: packageJson.devDependencies.bootstrap,
    sass: packageJson.devDependencies.sass,
    less: packageJson.devDependencies.less,
  },
  configurations: {},
};
let commonMainJavascriptHash;

for (const sourceFile of [
  'projects/theme-compat-e2e/src/styles/token-overrides.css',
  'projects/theme-compat-e2e/src/styles/custom.scss',
  'projects/theme-compat-e2e/src/styles/custom.less',
]) {
  const source = await readFile(resolve(root, sourceFile), 'utf8');
  if (/::ng-deep|!important|\.rv-[\w-]+/.test(source)) {
    throw new Error(`${sourceFile} uses a prohibited deep selector, important override, or internal Rivinia selector.`);
  }
}

for (const configuration of configurations) {
  const directory = join(outputRoot, configuration, 'browser');
  const allPaths = await filesUnder(directory);
  const assets = [];
  for (const path of allPaths.filter((candidate) => /\.(?:css|js)$/.test(candidate))) {
    const data = await readFile(path);
    assets.push({
      name: relative(directory, path),
      extension: path.endsWith('.css') ? 'css' : 'js',
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      data,
    });
  }

  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const linkedNames = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+\.(?:css|js))"/g)].map((match) => basename(match[1])),
  );
  const initialAssets = assets.filter((asset) => linkedNames.has(basename(asset.name)));
  const cssText = assets
    .filter((asset) => asset.extension === 'css')
    .map((asset) => asset.data.toString('utf8'))
    .join('\n');
  const jsText = assets
    .filter((asset) => asset.extension === 'js')
    .map((asset) => asset.data.toString('utf8'))
    .join('\n');
  const allText = `${cssText}\n${jsText}`;
  const bootstrapSelectors = /\.btn(?:\s*\{|[,.:#\[])/.test(allText);
  const preflight = allText.includes(
    '*,:after,:before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0;padding:0;border:0 solid}',
  );
  const tailwindUtility = /\.bg-rv-bg\s*\{/.test(allText);
  const prefixedUtility =
    /\.tw\\:bg-rv-bg\s*\{/.test(allText) || /\.tw\\\\:bg-rv-bg\s*\{/.test(allText);
  const themeLayerCount = allText.split('@layer rivinia-theme').length - 1;
  const cssAssets = assets.filter((asset) => asset.extension === 'css');
  const duplicateCss = cssAssets
    .map((asset) => asset.sha256)
    .filter((hash, index, hashes) => hashes.indexOf(hash) !== index);
  const shouldUseTailwind = configuration.startsWith('tailwind');
  const shouldUseBootstrap = configuration === 'bootstrap';
  const shouldUsePreflight = configuration === 'tailwind' || configuration === 'tailwind-prefix';
  const shouldUsePrefix = configuration === 'tailwind-prefix';

  const checks = {
    themeLayerOnce: themeLayerCount === 1,
    noDuplicateCssAssets: duplicateCss.length === 0,
    bootstrapStack: bootstrapSelectors === shouldUseBootstrap,
    tailwindPreflight: preflight === shouldUsePreflight,
    tailwindUtilities: shouldUsePrefix ? prefixedUtility && !tailwindUtility : tailwindUtility === shouldUseTailwind,
    prefixedUtilities: prefixedUtility === shouldUsePrefix,
    componentCssIncludedInJs: jsText.includes('rv-datepicker-trigger'),
  };
  const mainJs = assets.find((asset) => /^main.*\.js$/.test(basename(asset.name)));
  if (!mainJs) throw new Error(`${configuration} did not emit the expected application main JavaScript bundle.`);
  if (commonMainJavascriptHash && commonMainJavascriptHash !== mainJs.sha256) {
    throw new Error(`${configuration} emitted a different Angular main bundle; component parity was not preserved.`);
  }
  commonMainJavascriptHash = mainJs.sha256;

  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(
      `${configuration} isolation assertion failed: ${JSON.stringify({
        checks,
        themeLayerCount,
        bootstrapSelectors,
        preflight,
        tailwindUtility,
        prefixedUtility,
        duplicateCss,
      })}`,
    );
  }

  report.configurations[configuration] = {
    output: relative(root, directory),
    assets: assets.map(({ name, extension, bytes, sha256 }) => ({ name, extension, bytes, sha256 })),
    initial: byteMetrics(initialAssets),
    allEmitted: byteMetrics(assets),
    cssAssets: cssAssets.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })),
    cssEmbeddedInJavascript: checks.componentCssIncludedInJs,
    unreferencedJsCssCandidates: assets
      .filter((asset) => !linkedNames.has(basename(asset.name)))
      .map(({ name, extension, bytes }) => ({ name, extension, bytes })),
    isolation: { ...checks, themeLayerCount },
  };
}
report.sharedAngularMainBundleSha256 = commonMainJavascriptHash;

await writeFile(resolve(outputRoot, 'isolation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, result] of Object.entries(report.configurations)) {
  const size = result.initial;
  console.log(
    `${name.padEnd(22)} initial raw/gzip/brotli ${size.raw}/${size.gzip}/${size.brotli} B; emitted CSS ${result.cssAssets.reduce((sum, asset) => sum + asset.bytes, 0)} B; component CSS in JS ${result.cssEmbeddedInJavascript}`,
  );
}
console.log(`Isolation assertions passed for ${configurations.length} independent production outputs.`);
