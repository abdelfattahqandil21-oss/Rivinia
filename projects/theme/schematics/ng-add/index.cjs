'use strict';

const { findNodeAtLocation, parse, parseTree } = require('jsonc-parser');

const THEME_CSS = 'node_modules/@rivinia/theme/theme.css';
const FRAMEWORK_LABELS = {
  css: 'Plain CSS',
  scss: 'SCSS',
  less: 'Less',
  'tailwind-v3': 'Tailwind CSS v3',
  'tailwind-v4': 'Tailwind CSS v4',
  'bootstrap-5.3': 'Bootstrap 5.3',
};
const TOKEN_PROPERTIES = [
  ['primaryColor', '--rv-color-primary'],
  ['surfaceColor', '--rv-color-surface'],
  ['textColor', '--rv-color-text'],
  ['borderColor', '--rv-color-border'],
];

// Mirror the shipped CSS core contract. The C2 tests assert these values against
// styles/theme.css so the generator cannot silently drift from the package.
const LIGHT_COLORS = [
  ['--rv-color-primary', '#005fcc'],
  ['--rv-color-surface', '#ffffff'],
  ['--rv-color-surface-raised', '#f5f7fa'],
  ['--rv-color-text', '#101820'],
  ['--rv-color-text-muted', '#454f58'],
  ['--rv-color-border', '#767676'],
  ['--rv-color-focus', '#005fcc'],
  ['--rv-color-danger', '#dc2626'],
  ['--rv-color-success', '#16a34a'],
  ['--rv-color-info', '#2563eb'],
  ['--rv-color-warning', '#d97706'],
];
const DARK_COLORS = [
  ['--rv-color-primary', '#8ab4ff'],
  ['--rv-color-surface', '#182028'],
  ['--rv-color-surface-raised', '#202d38'],
  ['--rv-color-text', '#f5f7fa'],
  ['--rv-color-text-muted', '#c4ced8'],
  ['--rv-color-border', '#8292a1'],
  ['--rv-color-focus', '#8ab4ff'],
  ['--rv-color-danger', '#f87171'],
  ['--rv-color-success', '#4ade80'],
  ['--rv-color-info', '#60a5fa'],
  ['--rv-color-warning', '#fbbf24'],
];
const SHARED_TOKENS = [
  ['--rv-radius-sm', '0.25rem'],
  ['--rv-radius-md', '0.5rem'],
  ['--rv-radius-lg', '0.75rem'],
  ['--rv-space-1', '0.25rem'],
  ['--rv-space-2', '0.5rem'],
  ['--rv-space-3', '0.75rem'],
  ['--rv-space-4', '1rem'],
  ['--rv-font-family', "system-ui, -apple-system, 'Segoe UI', sans-serif"],
];
const SHADOWS = {
  light: '0 16px 48px rgba(0, 0, 0, 0.22)',
  dark: '0 16px 48px rgba(0, 0, 0, 0.6)',
};

function fail(message) {
  throw new Error(`[rivinia/theme] ${message}`);
}

function workspacePath(value, description) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    fail(`${description} must be a non-empty workspace-relative path.`);
  }
  const parts = value.split('/');
  if (value.startsWith('/') || parts.some((part) => part === '..' || part === '.')) {
    fail(`${description} must stay inside the selected application sourceRoot.`);
  }
  return parts.filter(Boolean).join('/');
}

function styleInput(entry) {
  return typeof entry === 'string'
    ? entry
    : entry && typeof entry.input === 'string'
      ? entry.input
      : null;
}

function isThemeCss(entry) {
  const input = styleInput(entry);
  return input === THEME_CSS || input === '@rivinia/theme/theme.css';
}

function parseWorkspace(tree) {
  const filePath = '/angular.json';
  if (!tree.exists(filePath))
    fail('No angular.json was found at the workspace root. No files were changed.');
  const content = tree.read(filePath).toString('utf8');
  const errors = [];
  const workspace = parse(content, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !workspace || typeof workspace !== 'object' || !workspace.projects) {
    fail('angular.json is malformed or has no projects object. No files were changed.');
  }
  return { content, workspace };
}

function buildTarget(project) {
  const targets = project.targets || project.architect;
  const build = targets && targets.build;
  if (!build || !build.options || !Array.isArray(build.options.styles)) return null;
  return { key: project.targets ? 'targets' : 'architect', build };
}

function selectApplication(workspace, requestedName) {
  const applications = Object.entries(workspace.projects)
    .filter(
      ([, project]) => project && project.projectType === 'application' && buildTarget(project),
    )
    .map(([name, project]) => ({ name, project }));

  if (requestedName) {
    const selected = applications.find((application) => application.name === requestedName);
    if (!selected)
      fail(
        `Project "${requestedName}" is not an Angular application with a supported build styles array. No files were changed.`,
      );
    return selected;
  }
  if (applications.length === 0)
    fail('No Angular application with build.options.styles was found. No files were changed.');
  if (applications.length > 1) {
    fail(
      `This workspace has multiple Angular applications (${applications.map(({ name }) => name).join(', ')}). Re-run with --project=<name>. No files were changed.`,
    );
  }
  return applications[0];
}

function detectIntegrations(tree, styles) {
  const found = new Set();
  for (const entry of styles) {
    const input = styleInput(entry) || '';
    if (/\.scss(?:$|[?#])/.test(input)) found.add('scss');
    if (/\.less(?:$|[?#])/.test(input)) found.add('less');
    if (/\.css(?:$|[?#])/.test(input)) found.add('css');
  }
  const manifestPath = '/package.json';
  if (tree.exists(manifestPath)) {
    try {
      const manifest = JSON.parse(tree.read(manifestPath).toString('utf8'));
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
      if (dependencies.bootstrap) {
        found.add(
          /(?:^|[^\d])5\.3(?:\.|$)/.test(String(dependencies.bootstrap))
            ? 'bootstrap-5.3'
            : 'bootstrap-unknown',
        );
      }
      if (dependencies.tailwindcss) {
        const version = String(dependencies.tailwindcss);
        if (/(?:^|[^\d])4(?:\.|$)/.test(version)) found.add('tailwind-v4');
        else if (/(?:^|[^\d])3(?:\.|$)/.test(version)) found.add('tailwind-v3');
        else found.add('tailwind-unknown');
      }
    } catch {
      found.add('manifest-unknown');
    }
  }
  return [...found].sort();
}

function renderTokenBlock(selectors, mode, indent) {
  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const entries = [
    ...colors,
    ...SHARED_TOKENS.filter(([name]) => name !== '--rv-font-family'),
    ['--rv-shadow-md', SHADOWS[mode]],
    ...SHARED_TOKENS.filter(([name]) => name === '--rv-font-family'),
  ];
  const prefix = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  return `${prefix}${selectors} {\n${inner}color-scheme: ${mode};\n${entries
    .map(([name, value]) => `${inner}${name}: ${value};`)
    .join('\n')}\n${prefix}}`;
}

function tokenStyles(options) {
  const selectors = {
    root: ':root',
    light: "[data-rv-theme='light']",
    dark: "[data-rv-theme='dark']",
    system: "[data-rv-theme='system']",
  };
  const scope = options.scope || 'root';
  const selector = selectors[scope];
  if (!selector) fail('scope must be root, light, dark or system. No files were changed.');
  const declarations = TOKEN_PROPERTIES.filter(([key]) => options[key]).map(
    ([key, token]) => `  ${token}: ${options[key]};`,
  );

  // The complete shipped defaults live in a dedicated layer, stronger than
  // rivinia-theme but weaker than ordinary unlayered consumer rules. This keeps
  // pre-existing app token overrides effective even when this file is appended
  // to angular.json's styles array. Dark and system modes are mirrored exactly.
  const defaults = [
    renderTokenBlock(":root,\n  [data-rv-theme='light'],\n  [data-rv-theme='system']", 'light', 2),
    renderTokenBlock("[data-rv-theme='dark']", 'dark', 2),
    "  @media (prefers-color-scheme: dark) {\n" +
      renderTokenBlock("[data-rv-theme='system']", 'dark', 4) +
      '\n  }',
  ].join('\n\n');
  const scopedOverride = declarations.length
    ? `\n/* Explicit overrides are unlayered and beat framework/default tokens.\n` +
      `   A root override also applies when the root is in dark/system mode; use\n` +
      `   --scope=dark or --scope=system for mode-specific customizations. */\n` +
      `${selector} {\n${declarations.join('\n')}\n}\n`
    : '';
  return `/* Consumer-owned Rivinia Theme overrides. Created once; never overwritten.\n` +
    ` * Full editable V2 core defaults follow, including light/dark/system.\n` +
    ` * The extra layer preserves existing unlayered app/custom framework rules.\n` +
    ` * To make an unconditional consumer override, add an ordinary rule below\n` +
    ` * this layer (or pass a supported colour option to ng add).\n` +
    ` * Check contrast after changing any semantic colour.\n` +
    ` */\n` +
    `@layer rivinia-theme, rivinia-consumer-tokens;\n` +
    `@layer rivinia-consumer-tokens {\n${defaults}\n}\n${scopedOverride}`;
}
function addArrayItem(content, path, index, value) {
  const errors = [];
  const root = parseTree(content, errors, { allowTrailingComma: true, disallowComments: false });
  const node = root && findNodeAtLocation(root, path);
  if (errors.length || !node || node.type !== 'array')
    fail('The selected styles array could not be edited safely. No files were changed.');

  const children = node.children || [];
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const arrayEnd = node.offset + node.length - 1;
  if (children.length > 0 && index === 0) {
    const first = children[0];
    const lineStart =
      Math.max(
        content.lastIndexOf('\n', first.offset - 1),
        content.lastIndexOf('\r', first.offset - 1),
      ) + 1;
    const indent = content.slice(lineStart, first.offset);
    const insertion =
      indent.trim() === ''
        ? `${JSON.stringify(value)},${eol}${indent}`
        : `${JSON.stringify(value)}, `;
    return content.slice(0, first.offset) + insertion + content.slice(first.offset);
  }

  if (index !== children.length)
    fail('The selected styles array changed unexpectedly. No files were changed.');
  if (children.length === 0) {
    const inside = content.slice(node.offset + 1, arrayEnd);
    const closingLine = content.slice(
      Math.max(content.lastIndexOf('\n', arrayEnd - 1), content.lastIndexOf('\r', arrayEnd - 1)) +
        1,
      arrayEnd,
    );
    const closeIndent = closingLine.trim() === '' ? closingLine : '';
    const multiline = inside.includes('\n') || inside.includes('\r');
    const childIndent = `${closeIndent}  `;
    const insertion = multiline
      ? `${eol}${childIndent}${JSON.stringify(value)}${eol}${closeIndent}`
      : ` ${JSON.stringify(value)} `;
    return content.slice(0, node.offset + 1) + insertion + content.slice(arrayEnd);
  }

  const last = children[children.length - 1];
  const between = content.slice(last.offset + last.length, arrayEnd);
  const hasTrailingComma = hasTrailingCommaToken(between);
  const insertionOffset = arrayEnd + (hasTrailingComma ? 0 : 1);
  const lastLineStart =
    Math.max(
      content.lastIndexOf('\n', last.offset - 1),
      content.lastIndexOf('\r', last.offset - 1),
    ) + 1;
  const linePrefix = content.slice(lastLineStart, last.offset);
  const closingLineStart =
    Math.max(content.lastIndexOf('\n', arrayEnd - 1), content.lastIndexOf('\r', arrayEnd - 1)) + 1;
  const closeIndent = content.slice(closingLineStart, arrayEnd);
  const multiline =
    content.slice(node.offset, arrayEnd).includes('\n') ||
    content.slice(node.offset, arrayEnd).includes('\r');

  // Place any required comma immediately after the last value so trailing comments stay comments.
  let updated = content;
  if (!hasTrailingComma) {
    updated =
      content.slice(0, last.offset + last.length) + ',' + content.slice(last.offset + last.length);
  }
  const childIndent = linePrefix.trim() === '' ? linePrefix : `${closeIndent}  `;
  const addition = multiline
    ? `${eol}${childIndent}${JSON.stringify(value)}${hasTrailingComma ? ',' : ''}${eol}${closeIndent}`
    : ` ${JSON.stringify(value)}${hasTrailingComma ? ',' : ''} `;
  return updated.slice(0, insertionOffset) + addition + updated.slice(insertionOffset);
}

function hasTrailingCommaToken(trivia) {
  let remaining = trivia;
  while (remaining.length > 0) {
    remaining = remaining.replace(/^\s+/, '');
    if (remaining.startsWith('//')) {
      const newline = remaining.search(/[\r\n]/);
      if (newline < 0) return false;
      remaining = remaining.slice(newline + 1);
      continue;
    }
    if (remaining.startsWith('/*')) {
      const end = remaining.indexOf('*/', 2);
      if (end < 0) return false;
      remaining = remaining.slice(end + 2);
      continue;
    }
    return remaining.startsWith(',');
  }
  return false;
}

function ngAdd(options = {}) {
  return (tree, context) => {
    const { content, workspace } = parseWorkspace(tree);
    const { name, project } = selectApplication(workspace, options.project);
    const target = buildTarget(project);
    const styles = target.build.options.styles;
    const sourceRoot = workspacePath(
      project.sourceRoot || `${project.root || ''}/src`.replace(/^\//, ''),
      'The application sourceRoot',
    );
    const tokenFile = workspacePath(options.tokensPath || 'theme.tokens.css', 'tokensPath');
    if (!tokenFile.endsWith('.css'))
      fail(
        'tokensPath must end in .css so the generated consumer overrides remain plain CSS. No files were changed.',
      );
    const tokenEntry = `${sourceRoot}/${tokenFile}`;
    const tokenFilePath = `/${tokenEntry}`;
    const tokenFileExisted = tree.exists(tokenFilePath);
    const tokenRefCount = styles.filter((entry) => styleInput(entry) === tokenEntry).length;
    const themeRefCount = styles.filter(isThemeCss).length;

    if (themeRefCount > 1 || tokenRefCount > 1) {
      fail(
        'The selected application has duplicate Theme or token stylesheet entries. Resolve the duplicate manually; no files were changed.',
      );
    }
    if (
      styles.some(
        (entry) =>
          styleInput(entry) === tokenEntry && typeof entry === 'object' && entry.inject === false,
      )
    ) {
      fail(
        'The selected token stylesheet is configured with inject:false. Resolve that conflict manually; no files were changed.',
      );
    }
    if (
      styles.some(
        (entry) => isThemeCss(entry) && typeof entry === 'object' && entry.inject === false,
      )
    ) {
      fail(
        'The existing Theme stylesheet is configured with inject:false. Resolve that conflict manually; no files were changed.',
      );
    }
    if (tree.exists(tokenFilePath) && !tree.read(tokenFilePath)) {
      fail(
        'The selected tokensPath conflicts with an existing non-file path. Choose another tokensPath; no files were changed.',
      );
    }

    const integration = options.integration || 'auto';
    const detected = detectIntegrations(tree, styles);
    const chosen =
      integration === 'auto' ? detected.filter((value) => FRAMEWORK_LABELS[value]) : [integration];
    const requestedFramework = chosen.length === 1 ? FRAMEWORK_LABELS[chosen[0]] : null;
    const requestedTokens = TOKEN_PROPERTIES.filter(([key]) => options[key]);
    if (
      requestedTokens.some(
        ([key]) =>
          !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(options[key]),
      )
    ) {
      fail(
        'Color overrides must be hexadecimal #RGB, #RGBA, #RRGGBB, or #RRGGBBAA values. No files were changed.',
      );
    }

    let updatedConfig = content;
    const targetPath = ['projects', name, target.key, 'build', 'options', 'styles'];
    if (themeRefCount === 0) updatedConfig = addArrayItem(updatedConfig, targetPath, 0, THEME_CSS);
    if (tokenRefCount === 0) {
      const refreshedErrors = [];
      const refreshed = parse(updatedConfig, refreshedErrors, {
        allowTrailingComma: true,
        disallowComments: false,
      });
      if (refreshedErrors.length)
        fail('angular.json could not be safely updated. No files were changed.');
      const refreshedTarget = buildTarget(refreshed.projects[name]);
      updatedConfig = addArrayItem(
        updatedConfig,
        targetPath,
        refreshedTarget.build.options.styles.length,
        tokenEntry,
      );
    }

    // All validation completes before the first Tree write, so conflicts cannot leave partial setup.
    if (!tokenFileExisted) tree.create(tokenFilePath, tokenStyles(options));
    if (updatedConfig !== content) tree.overwrite('/angular.json', updatedConfig);

    const frameworkSummary =
      integration === 'auto'
        ? requestedFramework ||
          (detected.length
            ? `detected stacks: ${detected.join(', ')}`
            : 'CSS core; no framework was detected')
        : `${FRAMEWORK_LABELS[integration]} recipe`;
    context.logger.info(
      `[rivinia/theme] Configured ${name}; ${frameworkSummary}. Framework packages and configuration were left unchanged.`,
    );
    if (themeRefCount)
      context.logger.info(
        '[rivinia/theme] Theme CSS was already registered; its position was preserved.',
      );
    if (tokenFileExisted && tokenRefCount)
      context.logger.info(
        '[rivinia/theme] Existing token file and stylesheet entry were preserved.',
      );
    else if (tokenFileExisted)
      context.logger.info('[rivinia/theme] Existing token file was preserved and registered.');
    else
      context.logger.info(
        `[rivinia/theme] Created ${tokenEntry}; edit it to customize Theme tokens.`,
      );
    return tree;
  };
}

module.exports = { ngAdd };
