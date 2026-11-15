"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ngAdd;
const tslib_1 = require("tslib");
const schematics_1 = require("@angular-devkit/schematics");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const reviewed_apply_js_1 = require("./reviewed-apply.cjs");
const environment_plan_apply_js_1 = require("./analysis/environment-plan-apply.cjs");
const mutation_proposal_js_1 = require("./mutation-proposal.cjs");
const reviewed_apply_js_2 = require("./reviewed-apply.cjs");
const inspect_workspace_js_1 = require("./inspect-workspace.cjs");
function ngAdd(options) {
    if (!hasReviewedWorkflowOptions(options))
        return scaffoldEnvironments(options);
    return async (tree, context) => {
        if (options.proposalFile) {
            if (!options.apply ||
                options.planFile ||
                options.reviewedDigest ||
                options.acceptConfigurationMapping ||
                options.acceptEnvironmentSemantics ||
                options.force) {
                throw new schematics_1.SchematicsException('ENV_ADD_OPTIONS_CONFLICT: proposalFile requires explicit --apply consent and cannot be combined with reviewed-plan options.');
            }
            const plan = await (0, mutation_proposal_js_1.createMutationProposalPlan)(tree, options.project, options.proposalFile);
            if (plan.status !== 'ready' || plan.conflicts.length > 0) {
                throw new schematics_1.SchematicsException(`ENV_ADD_SETUP_BLOCKED: no files were changed. ${plan.conflicts.map(({ code }) => code).join(', ') || 'Resolve the inspection diagnostics and revise proposalFile.'}`);
            }
            const acceptedDecisionIds = plan.proposedDecisions
                .filter(({ authority }) => authority === 'explicit-proposal')
                .map(({ id }) => id)
                .sort();
            const result = await (0, environment_plan_apply_js_1.applyEnvironmentPlanToTree)({
                tree,
                plan,
                approval: { reviewedDigest: plan.integrity.digest, acceptedDecisionIds },
                consumerRoot: '/',
                isPathSafe: (_root, relativePath) => (0, reviewed_apply_js_2.isSafeConsumerPath)(process.cwd(), relativePath),
                isReadPathSafe: (_root, relativePath) => (0, reviewed_apply_js_2.isSafeConsumerReadPath)(process.cwd(), relativePath),
            });
            if (!result.ok) {
                throw new schematics_1.SchematicsException(`${result.code}: automatic setup was refused without consumer file changes.`);
            }
            const created = plan.operations.filter(({ kind }) => kind === 'create-environment-file').length;
            const replacements = plan.operations.filter(({ kind }) => kind === 'add-file-replacement').length;
            context.logger.info(`ENV_FILE_CREATION_${created ? 'SUCCESS' : 'NOOP'}: ${created} file(s).`);
            context.logger.info(`ENV_CONFIGURATION_WIRING_${replacements ? 'SUCCESS' : 'NOOP'}: ${replacements} replacement(s).`);
            context.logger.warn('ENVIRONMENT_VALUES_CONSUMER_APPROVED_UNVERIFIED: proposalFile explicitly selected these source files; values were preserved verbatim, and runtime semantic correctness is not verified.');
            return result.tree;
        }
        if (!options.planFile || !options.reviewedDigest) {
            if (options.apply) {
                throw new schematics_1.SchematicsException('ENV_ADD_CHOICES_REQUIRED: --apply does not select environment sources or build configurations. Provide proposalFile with explicit choices, or a reviewed plan and digest.');
            }
            const inspected = await (0, inspect_workspace_js_1.inspectWorkspaceTree)(tree, options.project);
            const unsupportedRenderDiagnostic = inspected.diagnostics.find((diagnostic) => diagnostic.startsWith('ENV_RENDER_MODE_UNSUPPORTED:'));
            if (unsupportedRenderDiagnostic) {
                throw new schematics_1.SchematicsException(`${unsupportedRenderDiagnostic} ng add did not mutate the workspace; use read-only Inspect for this rendering mode.`);
            }
            const configuredEnvironments = inspected.plan?.operations.filter(({ environment }) => environment !== 'base');
            const baseEnvironmentPath = inspected.plan?.operations.find(({ environment }) => environment === 'base')?.sourcePath;
            if (inspected.plan &&
                !inspected.plan.inputHashes.every(({ path }) => (0, reviewed_apply_js_2.isSafeConsumerReadPath)(process.cwd(), path))) {
                throw new schematics_1.SchematicsException('ENV_PLAN_PATH_INVALID: fresh Inspect found an input path that crosses a symlink or leaves the consumer workspace; no files were changed.');
            }
            if (inspected.plan?.status === 'reviewable' &&
                configuredEnvironments?.length &&
                baseEnvironmentPath &&
                configuredEnvironments.every(({ environment, sourcePath }) => (0, reviewed_apply_js_2.isSafeConsumerPath)(process.cwd(), sourcePath) &&
                    inspected.plan.project.build?.fileReplacements.some(({ configuration, replace, with: replacement }) => replace === baseEnvironmentPath &&
                        (0, reviewed_apply_js_2.isSafeConsumerPath)(process.cwd(), replace) &&
                        replacement.endsWith(`environment.${environment}.generated.ts`) &&
                        inspected.plan.project.build.configurations.includes(configuration ?? '') &&
                        (0, reviewed_apply_js_2.isSafeConsumerPath)(process.cwd(), replacement) &&
                        tree.exists(`/${replace}`) &&
                        tree.exists(`/${replacement}`) &&
                        hasValidTypeScriptSyntax(tree.readText(`/${replacement}`), replacement)))) {
                context.logger.info('ENV_ADD_SETUP_CONFIGURED_VALUES_UNVERIFIED: fresh Inspect found matching build replacements and existing source/target files; no files changed. This no-op confirms setup structure only; it does not run a consumer build or verify environment semantics.');
                return tree;
            }
            throw new schematics_1.SchematicsException(`ENV_ADD_CHOICES_REQUIRED: provide proposalFile with explicit source and configuration choices plus --apply consent, or provide planFile and reviewedDigest for reviewed Apply.${inspected.diagnostics.length ? ` ${inspected.diagnostics.join(' ')}` : ''}`);
        }
        return (0, reviewed_apply_js_1.applyReviewedPlan)(tree, context, options);
    };
}
function hasReviewedWorkflowOptions(options) {
    return Boolean(options.proposalFile ||
        options.planFile ||
        options.reviewedDigest ||
        options.apply ||
        options.acceptConfigurationMapping ||
        options.acceptEnvironmentSemantics ||
        options.force);
}
function hasValidTypeScriptSyntax(sourceText, fileName) {
    const result = typescript_1.default.transpileModule(sourceText, {
        fileName,
        reportDiagnostics: true,
        compilerOptions: { target: typescript_1.default.ScriptTarget.Latest },
    });
    return !result.diagnostics?.some(({ category }) => category === typescript_1.default.DiagnosticCategory.Error);
}
const MODEL_FILE = `import type { BaseEnvironment } from '@rivinia/env';

/**
 * Application environment contract. Extend with your own fields
 * (apiUrl, keys, feature flags, …) — nothing else in the app should
 * import environment values except through this type.
 */
export interface AppEnvironment extends BaseEnvironment {
  /** Base URL for API calls (per-environment value below). */
  readonly apiUrl: string;
}
`;
const ALL_ENVIRONMENTS = ['dev', 'stage', 'prod'];
/** Short aliases users actually type (`prod`, `dev`, `stag`). */
const ENVIRONMENT_ALIASES = {
    dev: 'dev',
    prod: 'prod',
    stag: 'stage',
    stage: 'stage',
};
/** Output directory short names: builds/dev, builds/prod, builds/stag. */
const OUTPUT_DIR = {
    dev: 'builds/dev',
    stage: 'builds/stag',
    prod: 'builds/prod',
};
/** Public short configuration names used by `ng build --configuration`. */
const CONFIG_NAME = {
    dev: 'dev',
    stage: 'stag',
    prod: 'prod',
};
/** Existing long configuration names remain wired for compatibility. */
const LEGACY_CONFIG_NAME = {
    dev: 'development',
    stage: 'staging',
    prod: 'production',
};
const fileDefs = (sourceRoot, selected) => {
    const files = [
        { name: `${sourceRoot}/environments/environment.model.ts`, content: () => MODEL_FILE },
        // The base file is always scaffolded: it is the `replace` source for
        // prod/stag swaps (and what dev uses directly).
        {
            name: `${sourceRoot}/environments/environment.ts`,
            content: (version) => `import type { AppEnvironment } from './environment.model';\n\n` +
                `/** Development defaults. Used as-is by the \`dev\` configuration. */\n` +
                `export const environment: AppEnvironment = {\n` +
                `  production: false,\n` +
                `  version: '${version}',\n` +
                `  apiUrl: 'http://localhost:3000/api',\n` +
                `};\n`,
        },
    ];
    if (selected.includes('stage')) {
        files.push({
            name: `${sourceRoot}/environments/environment.staging.ts`,
            content: (version) => `import type { AppEnvironment } from './environment.model';\n\n` +
                `/** Staging mirrors production. Wired via the \`stag\` configuration. */\n` +
                `export const environment: AppEnvironment = {\n` +
                `  production: true,\n` +
                `  version: '${version}',\n` +
                `  apiUrl: 'https://staging.example.com/api',\n` +
                `};\n`,
        });
    }
    if (selected.includes('prod')) {
        files.push({
            name: `${sourceRoot}/environments/environment.prod.ts`,
            content: (version) => `import type { AppEnvironment } from './environment.model';\n\n` +
                `export const environment: AppEnvironment = {\n` +
                `  production: true,\n` +
                `  version: '${version}',\n` +
                `  apiUrl: 'https://api.example.com/api',\n` +
                `};\n`,
        });
    }
    return files;
};
/**
 * `ng add @rivinia/env` — scaffolds typed environment files and wires
 * dev/stag/prod configurations with file replacements.
 *
 * - Never overwrites existing files (each file skipped individually).
 * - Never removes user configuration: only ADDS missing fileReplacements
 *   (one per source file) and creates short configurations from their legacy
 *   equivalents when absent.
 * - `dev` intentionally gets no replacement (it uses `environment.ts`).
 *   Existing `development`, `staging`, and `production` configurations remain
 *   wired for compatibility.
 * - App version is snapshotted from the app's `package.json` (`0.0.0` fallback).
 */
function scaffoldEnvironments(options) {
    return (tree, context) => {
        const workspace = readWorkspace(tree, context, options.project);
        if (!workspace)
            return tree;
        const { name, project, angular } = workspace;
        const sourceRoot = project.sourceRoot ?? (project.root ? `${project.root}/src` : 'src');
        const version = readAppVersion(tree);
        // Empty selection (or engine default) means everything — same as --defaults.
        // Accepts arrays (prompt/programmatic) and comma strings (CLI flags), with
        // short aliases (dev/prod/stag/stage) normalized before validation.
        const rawSelected = options.environments;
        const asArray = Array.isArray(rawSelected)
            ? [...rawSelected]
            : typeof rawSelected === 'string'
                ? rawSelected.split(',')
                : [];
        const cleaned = asArray
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0)
            .map((e) => ENVIRONMENT_ALIASES[e] ?? e);
        const unknown = [...new Set(cleaned)].filter((e) => !ALL_ENVIRONMENTS.includes(e));
        if (unknown.length > 0) {
            throw new schematics_1.SchematicsException(`[rivinia/env] unknown environment(s): ${unknown.join(', ')}. ` +
                `Choose from dev, stage (stag), prod.`);
        }
        const selected = cleaned.length > 0 ? [...new Set(cleaned)] : [...ALL_ENVIRONMENTS];
        const configsSnapshot = () => JSON.stringify(project.architect?.build?.configurations ?? null);
        const configsBefore = configsSnapshot();
        let created = 0;
        for (const file of fileDefs(sourceRoot, selected)) {
            const path = `/${file.name}`;
            if (tree.exists(path)) {
                context.logger.info(`[rivinia/env] exists, skipped: ${path}`);
                continue;
            }
            tree.create(path, file.content(version));
            created++;
        }
        if (selected.includes('prod')) {
            ensureNamedConfig(tree, angular, name, 'prod', ['production'], context);
            const replacement = {
                replace: `${sourceRoot}/environments/environment.ts`,
                with: `${sourceRoot}/environments/environment.prod.ts`,
            };
            ensureReplacement(tree, angular, name, 'prod', replacement);
            ensureReplacement(tree, angular, name, 'production', replacement);
        }
        if (selected.includes('stage')) {
            ensureStaging(tree, angular, name, sourceRoot, context);
        }
        if (selected.includes('dev')) {
            ensureNamedConfig(tree, angular, name, 'dev', ['development'], context);
        }
        ensureOutputPaths(tree, angular, name, selected, context);
        if (created > 0 || configsSnapshot() !== configsBefore) {
            tree.overwrite('/angular.json', JSON.stringify(angular, null, 2) + '\n');
        }
        context.logger.info(`[rivinia/env] ${created} file(s) created, configurations wired for '${name}'.`);
        return tree;
    };
}
function readWorkspace(tree, context, requested) {
    let angular;
    try {
        const raw = tree.read('/angular.json')?.toString('utf-8');
        if (!raw)
            throw new schematics_1.SchematicsException('angular.json not found.');
        angular = JSON.parse(raw);
    }
    catch (error) {
        context.logger.warn(`[rivinia/env] cannot read angular.json (${error instanceof Error ? error.message : error}) — skipping.`);
        return null;
    }
    const names = Object.keys(angular.projects ?? {});
    if (names.length === 0) {
        context.logger.warn('[rivinia/env] no projects in angular.json — skipping.');
        return null;
    }
    // NOTE: the schema default for `project` is "" (engine-filled), so only a
    // non-empty value counts as an explicit request. (`??` alone would honor "".)
    const name = requested && requested.length > 0
        ? requested
        : angular.defaultProject && typeof angular.defaultProject === 'string'
            ? angular.defaultProject
            : names[0];
    const project = angular.projects?.[name];
    if (!project) {
        context.logger.warn(`[rivinia/env] project '${name}' not found — skipping.`);
        return null;
    }
    return { name, project, angular };
}
function readAppVersion(tree) {
    try {
        const raw = tree.read('/package.json')?.toString('utf-8');
        if (!raw)
            return '0.0.0';
        const parsed = JSON.parse(raw);
        return typeof parsed.version === 'string' && parsed.version.length > 0
            ? parsed.version
            : '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
function getConfigurations(angular, name) {
    const project = angular.projects?.[name];
    if (!project)
        throw new schematics_1.SchematicsException(`[rivinia/env] project '${name}' not found.`);
    project.architect ??= {};
    project.architect.build ??= {};
    const build = project.architect.build;
    build.configurations ??= {};
    return build.configurations;
}
function ensureReplacement(tree, angular, name, configuration, entry) {
    if (!tree.exists('/angular.json'))
        return;
    const configurations = getConfigurations(angular, name);
    const target = configurations[configuration];
    if (!target)
        return;
    const list = target['fileReplacements'];
    if (!Array.isArray(list)) {
        target['fileReplacements'] = [{ ...entry }];
        return;
    }
    const matches = list
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => typeof item === 'object' &&
        item !== null &&
        item['replace'] === entry.replace);
    if (matches.length === 0) {
        list.push({ ...entry });
        return;
    }
    const firstIndex = matches[0].index;
    list[firstIndex] = { ...entry };
    for (const { index } of matches.slice(1).reverse())
        list.splice(index, 1);
}
/**
 * Points each selected configuration at its build directory
 * (builds/dev, builds/stag, builds/prod) — but only when the app has not
 * customized `outputPath` already. Never overwrites user output locations.
 */
function ensureOutputPaths(tree, angular, name, selected, context) {
    if (!tree.exists('/angular.json'))
        return;
    const configurations = getConfigurations(angular, name);
    let touched = false;
    for (const env of selected) {
        for (const configName of [CONFIG_NAME[env], LEGACY_CONFIG_NAME[env]]) {
            const target = configurations[configName];
            if (!target || 'outputPath' in target)
                continue;
            target['outputPath'] = OUTPUT_DIR[env];
            touched = true;
        }
    }
    if (touched)
        ensureGitignore(tree, context);
}
/** Appends `/builds` to the app .gitignore once (build outputs don't commit). */
function ensureGitignore(tree, context) {
    if (!tree.exists('/.gitignore'))
        return;
    const content = tree.read('/.gitignore')?.toString('utf-8') ?? '';
    if (/(^|\n)\/*builds\/?(\n|$)/.test(content))
        return;
    tree.overwrite('/.gitignore', content.replace(/\s*$/, '\n') + '/builds\n');
    context.logger.info('[rivinia/env] added /builds to .gitignore.');
}
function ensureStaging(tree, angular, name, sourceRoot, context) {
    if (!tree.exists('/angular.json'))
        return;
    ensureNamedConfig(tree, angular, name, 'stag', ['staging', 'production'], context);
    ensureNamedConfig(tree, angular, name, 'staging', ['stag', 'production'], context);
    const replacement = {
        replace: `${sourceRoot}/environments/environment.ts`,
        with: `${sourceRoot}/environments/environment.staging.ts`,
    };
    ensureReplacement(tree, angular, name, 'stag', replacement);
    ensureReplacement(tree, angular, name, 'staging', replacement);
}
function ensureNamedConfig(tree, angular, name, configuration, fallbacks, context) {
    if (!tree.exists('/angular.json'))
        return;
    const configurations = getConfigurations(angular, name);
    if (configurations[configuration])
        return;
    const source = fallbacks
        .map((fallback) => configurations[fallback])
        .find((candidate) => candidate && typeof candidate === 'object');
    const copy = source
        ? JSON.parse(JSON.stringify(source))
        : {};
    delete copy['outputPath'];
    configurations[configuration] = copy;
    context.logger.info(`[rivinia/env] created \`${configuration}\` configuration.`);
}
