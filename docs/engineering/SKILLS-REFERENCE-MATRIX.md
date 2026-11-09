# Rivinia skills reference matrix

Discovery paths were checked against the [Codex skills documentation](https://developers.openai.com/codex/skills)
and [OpenCode skills documentation](https://opencode.ai/docs/skills) on
2026-11-03. “SEMANTICS VERIFIED” means path, metadata, or invocation behavior
was observed; it does not prove the skill's advice is correct for every task.

| Skill | Source and owner | Agents | Task | Discovery / invocation | Compatibility requirements | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| `rivinia-playbook` | Repository-owned | Codex, OpenCode | Routing all non-trivial Rivinia work | `.agents/skills`; Codex `$rivinia-playbook`, OpenCode native `skill` tool ID; description permits implicit selection | Root `AGENTS.md`, decisions and task instructions take precedence | **PARTIALLY VERIFIED** — explicit load succeeded in both; Codex did not auto-load in a no-explicit-skill probe, so root policy requires explicit invocation; API task did not load release skill |
| `rivinia-release` | Repository-owned | Codex, OpenCode | Package release gates | `.agents/skills`; explicit Codex `$rivinia-release` or OpenCode native `skill` tool ID; no implicit invocation | `release-groups.json`, exact package versions, immutable docs/tags, test evidence, owner approval | **SEMANTICS VERIFIED** — explicit load succeeded in both; OpenCode CLI `@rivinia-release` alone did not load the hidden skill, so use the native tool; probes did not publish |
| `codebase-design` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Architecture, API, seams | Global skill metadata; explicit or agent-selected | General-purpose; repository API rules override | **PARTIALLY VERIFIED** — body and references inspected locally; not installed by repository |
| `domain-modeling` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Domain language, glossary, ADRs | Global skill metadata; explicit or agent-selected | General-purpose; use Rivinia `docs/DECISIONS.md` conventions | **PARTIALLY VERIFIED** — instructions and referenced templates inspected; not repository-pinned |
| `tdd` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Behavior changes and tests | Global skill metadata; explicit or agent-selected | Repo test seams, authorization and package gates govern | **PARTIALLY VERIFIED** — instructions inspected; follow user authorization for test additions |
| `test-verification` | User-level and OpenCode global `~/.config/opencode/skills/` | Codex, OpenCode when present | Evidence and final test reporting | Global skill metadata; explicit or agent-selected | Must report actual project commands and unavailable gates | **PARTIALLY VERIFIED** — checklist inspected; examples are generic and not Rivinia commands |
| `diagnosing-bugs` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Reproducible bug diagnosis | Global skill metadata; explicit or agent-selected | Follow project safety and test requirements; do not claim cause without evidence | **PARTIALLY VERIFIED** — workflow inspected; requires a red-capable repro before hypotheses |
| `code-review` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Branch or WIP review | Global skill metadata; explicit invocation | Requires a fixed point/spec and two parallel reviewers; use only when authorized | **PARTIALLY VERIFIED** — process inspected; delegation prerequisite recorded |
| `writing-for-agents` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Edit `AGENTS.md`, `SKILL.md`, agent docs | Global skill metadata; explicit or agent-selected | Read its `SKILL-MECHANICS.md` before authoring skills | **PARTIALLY VERIFIED** — relevant instructions inspected; authoring reference still governs detailed mechanics |
| `impeccable` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Rivinia component UI/a11y/design work | Global skill metadata; explicit or agent-selected | Run its context launcher and scoped references; repository UI/build gates still apply | **PARTIALLY VERIFIED** — metadata, setup and workflow inspected; launcher not run |
| `playwright-cli` | User-level `~/.agents/skills/`; personal installation | Codex, OpenCode when present | Repeatable browser automation | Global skill metadata; explicit or agent-selected | CLI and browser availability; use repo's Playwright config and real-engine rules | **PARTIALLY VERIFIED** — instructions inspected; no browser test run for this documentation task |
| `desktop-browsers` | User-level `~/.agents/skills/`, also linked into OpenCode global skills | Codex, OpenCode | Real-browser evidence | Global skill metadata; explicit or agent-selected | Host engine versions/dependencies; never assert unavailable Firefox/WebKit | **PARTIALLY VERIFIED** — local instructions inspected; no browser launch needed |
| `find-skills` | User-level Vercel ecosystem skill | Codex; OpenCode only if installed | External skill search | Explicit invocation; `npx skills find <query>` | Review source, maintenance, dependencies and compatibility; never install without approval | **SEMANTICS VERIFIED** — instructions read and Angular/accessibility/Playwright searches run; no skill installed |
| `opencode` | Not found in the inspected local skill roots | Not available as a skill in this host snapshot | OpenCode configuration and feature research | Use official OpenCode documentation and CLI help; do not assume a skill exists | No package metadata; verify current runtime behavior | **SEMANTICS VERIFIED** — absent from the inspected skill files and active catalog; official docs and CLI help used |
| `openai-docs` | Codex system skill | Codex | Codex/runtime documentation | System skill metadata; explicit or agent-selected | OpenAI topics only; cite official docs | **PARTIALLY VERIFIED** — current official Codex docs were used; full skill invocation was unnecessary |
| `skill-creator`, `skill-installer` | Codex system skills | Codex | Create a new skill / install a skill | System skill metadata; explicit invocation | Installer is outside scope without owner approval; creator not needed for this relocation | **SEMANTICS VERIFIED** — system manifests present; neither was invoked |
| `angular-developer` | External `angular/skills`, Angular team | Codex/OpenCode compatible format, not installed | Angular architecture and implementation | `npx skills add https://github.com/angular/skills --skill angular-developer` (not run) | It asks to inspect Angular version; still needs review against this repo's Angular 22.2.3 and rules | **PARTIALLY VERIFIED** — official source reviewed; not installed or runtime-tested |
| `angular-component` | External `analogjs/angular-skills` | Generic skills format | Angular components | Search result only; deprecated source | Explicitly deprecated; do not use | **SEMANTICS VERIFIED** — source says unmaintained and redirects to Angular-owned skills |
| Plugin-managed skills | Codex/OpenCode plugin packages; plugin owns source | Agent and app dependent | Connector-specific workflows | Discover only through the installed plugin; never reference cache paths | Requires the owning plugin/tool connection; no Rivinia package compatibility implied | **PARTIALLY VERIFIED** — source class identified; none selected as a Rivinia dependency |
| `git-guardrails-claude-code` | User-level third-party Claude Code hook skill | Claude Code only | Claude Code git hooks | Claude-specific hook setup | Incompatible with current Codex/OpenCode execution | **SEMANTICS VERIFIED** — skill's stated target inspected; rejected |

General-purpose skills do not receive package version metadata. Any future
consumer skill must follow [`AI-SKILLS.md`](AI-SKILLS.md) and declare exact
package compatibility metadata. Metadata validation is not API compatibility
proof; examples still need exact-version package and clean-consumer builds.

## Repository package maintainer skills

These package-scoped skills live in `.agents/skills/`, are discovered in the
same repository path as the playbook, and link to the package's current source
of truth. Each has a maintainer compatibility sidecar with the exact 1.0.4
baseline; the sidecar is traceability metadata, not evidence that every
checklist item is implemented. Skills deliberately separate current exports
from proposals and future candidates.

At the reviewed HEAD, Menu, Popup and Select have local source changes after
their 1.0.4 release tag, while their public entry-point files remain unchanged.
The skills target the current repository source; their tag references identify
the last published documentation and do not imply those local behavior changes
were published.

| Skill | Package scope | Primary API anchor | Package docs |
| --- | --- | --- | --- |
| `rivinia-datepicker` | `@rivinia/datepicker` | `projects/datepicker/src/public-api.ts`, `projects/datepicker/ui/src/public-api.ts` | [`docs/datepicker/`](../datepicker/) |
| `rivinia-env` | `@rivinia/env` | `projects/env/src/public-api.ts`, schematics collection | [`docs/env/`](../env/) |
| `rivinia-http` | `@rivinia/http` | `projects/http/src/public-api.ts` | [`docs/http/`](../http/) |
| `rivinia-i18n` | `@rivinia/i18n` | `projects/i18n/src/public-api.ts`, `/ui`, `/select` | [`docs/i18n/`](../i18n/) |
| `rivinia-menu` | `@rivinia/menu` | `projects/menu/src/public-api.ts`, `projects/menu/ui/src/public-api.ts` | [`docs/menu/`](../menu/) |
| `rivinia-modal` | `@rivinia/modal` | `projects/modal/src/public-api.ts`, `projects/modal/ui/src/public-api.ts` | [`docs/modal/`](../modal/) |
| `rivinia-popup` | `@rivinia/popup` | `projects/popup/src/public-api.ts` | `projects/popup/README.md` |
| `rivinia-select` | `@rivinia/select` | `projects/select/src/public-api.ts`, `projects/select/ui/src/public-api.ts` | [`docs/select/`](../select/) |
| `rivinia-table` | `@rivinia/table` | `projects/table/src/public-api.ts`, `projects/table/ui/src/public-api.ts` | [`docs/table/`](../table/) |
| `rivinia-theme` | `@rivinia/theme` | CSS exports in `projects/theme/package.json`; TypeScript entry intentionally exports nothing | [`docs/theme/`](../theme/) |
| `rivinia-toast` | `@rivinia/toast` | `projects/toast/src/public-api.ts`, `projects/toast/ui/src/public-api.ts` | [`docs/toast/`](../toast/) |

Their common workflow and boundaries come from root [`AGENTS.md`](../../AGENTS.md)
and [`rivinia-playbook`](../../.agents/skills/rivinia-playbook/SKILL.md), rather
than repeated copies of generic instructions. Run `pnpm check:skills` to check
frontmatter, compatibility sidecars, package identities, version references
and repository paths.
