# Documentation ownership and editing contract

## Canonical locations

- `docs/<library>/README.md`: navigation for that library's **current** topic guides, with links to the package README and source API; all 12 current library directories have an index.
- `projects/<library>/README.md` and `src/public-api.ts`: authoritative **implemented API** and package installation contract. Do not mirror API declarations inside `docs/` and silently let them drift.
- `projects/<library>/specifications/`: package-owned design records (status must distinguish proposal / approved / implemented). Cross-library candidate backlog is [future roadmap](FUTURE-LIBRARY-ROADMAP.md).
- `docs/engineering/`: active repository policies, tests, tooling, developer workflows; root `AGENTS.md` and owner instructions take precedence.
- `docs/decisions/DNNN-*`: **append-only historical records**; do not relocate, renumber, overwrite history or rewrite old facts as newly approved. New decisions are separate numbered files and indexed in `decisions/README.md`.
- `docs/releases/`: historical or candidate release documentation; *never* publishing authorization.
- `docs/testing/` and `docs/a11y-snapshots/`: current verification method and dated evidence. A 2026 snapshot is not proof of 2027 support.
- `docs/archive/`: superseded RFCs, dated audit reports and old implementation plans. These are not current instructions.

## File rules

1. Use one topic and accountable owner per page; avoid empty one-line navigation folders. Create a library index before scattering its topics across unrelated root folders.
2. Use **relative Markdown links** for intra-repo paths. When moving a page, fix both inbound and outbound links, including references in scripts, `AGENTS.md`, skills, package READMEs and CI. This docs-only replacement cannot itself validate unavailable repository files.
3. Preserve code examples as **examples** unless built against a specific project version/tarball; label version-specific claims. Prefer commands from current root `package.json`.
4. No secrets, tokens, credentials, personal data, raw private task logs, or mutable npm registry snapshots disguised as evergreen policy.
5. Make policies clear: **active / approved target / proposed / historical**. An unperformed test is not reported as passing.
6. Check local Markdown links, then run the repository's actual docs/governance checks on the installed tree. Audit link changes created by deleted pointer paths before committing.

## Compatibility notes

`docs/browser-support.md` and `docs/README-TEMPLATE.md` remain narrow compatibility pointers because immutable decisions D089 and D090 refer to their original paths. Their content is not the canonical guide. The former `docs/repository-architecture`, `docs/research`, `docs/guides`, and redirect-only `docs/specifications` folders were consolidated; see the [archive index](../archive/README.md) and replacement migration report.
