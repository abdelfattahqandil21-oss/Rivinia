# Worktrees — forbidden by default

**Status: restricted exception; superseded worktree-first policy.** Owner policy on 2026-11-21 is to use **branches in the single existing Rivinia checkout**, not worktrees.

Do not execute `git worktree add`, `git worktree move`, `git worktree remove`, `git worktree prune`, or create alternative clones/workspaces because a task is complicated, because parallel work is convenient, or because older instructions recommend it.

If—and only if—the **current owner explicitly requests a named worktree operation**, check the exact requested path and branch, current `HEAD`/status, active processes, uncommitted changes, ignored outputs and ownership. Explain cross-filesystem and shared-`dist`/`node_modules` risks. Never force-remove or clean another task's output. A specific worktree permission is not permission to merge, commit, publish, or push.

Use [Git workflow](GIT-WORKFLOW.md) for branch transitions and merge approvals. The previous instructions were retained within the [dated governance migration record](../archive/repository-architecture/MIGRATION-PLAN-2026-11-03.md) as **history, not permission**.
