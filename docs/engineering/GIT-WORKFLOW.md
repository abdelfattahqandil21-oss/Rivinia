# Git workflow — single checkout, branch-owned tasks

**Status: binding owner-approved workflow (2026-11-21).**

## Non-negotiable rules

- Work only in the **existing Rivinia checkout** unless the owner explicitly authorizes another location. **Never create, move, prune, remove, or duplicate worktrees or clones as an implicit task setup.** A worktree requires an explicit request naming that operation.
- Use an ordinary task branch in the existing checkout. Inspect `git status --short --branch`, `git rev-parse HEAD`, and current branch before any write. Do not silently switch branch when it contains work.
- `main` is the **real integration target**, never an agent's default development branch. Owner must **personally review changes and verification** then directly authorize the specific merge to `main`.
- No automatic `git commit`, `git push`, force-push, rebase, cherry-pick, amend, squash, branch deletion, tag, version bump, release, or merge. Each requires scoped owner permission. A general “continue” is not merge/publish approval.
- Preserve uncommitted, untracked, and ignored work. Do not `git clean`, `git reset --hard`, force-remove a worktree, overwrite a user's changes or quietly rewrite Git history.
- Use one logical reviewed change per Conventional Commit. Show changed paths and `git diff --check`; show staged diff/stat before an approved commit.
- For review handoff state repo path, branch, base/HEAD, staged/unstaged/untracked changes, commands with pass/fail/not-run, and whether any history/network operation occurred.

## Recommended non-destructive preflight

```sh
pwd
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --check
```

Creating a task branch is **also an explicit context transition**: report the proposed name and confirm scope/owner before changing branches. A branch does not authorize changing an unrelated package.

## Historical process

A worktree-first workflow existed in early November and is preserved only as a historical audit under `docs/archive/`. It is **superseded** and must not be followed by default. See [explicit exceptions](WORKTREES.md), [decision D105](../decisions/D105-branches-only-and-centralized-test-ownership.md), and the current root `AGENTS.md`.
