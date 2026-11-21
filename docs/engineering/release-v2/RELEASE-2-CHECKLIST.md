# Rivinia unified v2 release gates

Plan: agree 11-library scope, versions, dependency graph, rollback and acceptance criteria.

Design: public APIs, architecture, APF exports, migration guides, SSR and headless/UI contracts.

Build: all 11 packages compile in partial-Ivy mode; package peers, schematics, styles, changelogs and docs.

Test: unit, E2E Chromium/Firefox/WebKit, accessibility, RTL, nested overlays, SSR, mobile, package-tarball consumer, gzip/brotli consumer deltas; investigate skips.

Deploy: sign off all 11 first; unify internal dependency ranges and version; inspect all tarballs; publish to official npm with --tag next only after explicit approval; verify registry tags and installs.

Maintain: track regressions, dependency updates, migration support, release monitoring and patch policy.

References: https://angular.dev/tools/libraries/angular-package-format ; https://angular.dev/reference/versions ; https://docs.npmjs.com/cli/v11/commands/npm-dist-tag
