# Organize consumer code by feature

**Status:** consumer guidance; the folder names are examples, not a required architecture.

Rivinia owns component behavior and accessible defaults. The application owns
business rules, permissions, server calls, form policy, and the number and
meaning of workflow actions. Keep a small interaction in one file when that is
clearer; split a larger workflow by responsibility when it helps the team.

## A small interaction

A one-file confirmation screen is often enough:

```text
features/delete-project/
  delete-project-dialog.component.ts
```

Keep the confirmation text, call to the application service, pending state,
and decision to close together while the flow is small. Move code only when a
second responsibility or reuse makes the boundary useful.

## A larger workflow

For a longer approval flow, an optional feature-first structure could be:

```text
features/approvals/
  domain/
    approval.types.ts
    approval.rules.ts
  application/
    approval.actions.ts
    approval.policy.ts
  data-access/
    approval.repository.ts
  forms/
    approval.form.ts
    approval.validators.ts
  ui/
    approval-dialog/
      approval-dialog.component.ts
      approval-dialog.component.html
      approval-dialog.component.css
```

The domain holds business rules independent of Angular. Application code
coordinates actions and policies; data-access owns server communication; forms
owns form construction and validation; UI renders state and connects the
pieces. These names are illustrative, and a project can choose another shape.

## Keep action policy with the consumer

The consumer determines action count, order, visibility, permissions, labels,
icons, styling, and business operations. Actions can save without closing,
open another view, or request a guarded close. Avoid making every button close
a dialog automatically. Check the current [Modal API](../modal/api.md) and
[lifecycle/guard documentation](../modal/lifecycle-and-guards.md) for the
implemented contract; an action registry or responsive overflow menu is not
implied by this organization guide.

Prefer Angular's native forms contracts before adding an adapter. Keep a
Modal's basic API independent of optional form integrations, and test a
custom adapter only when a concrete consumer case requires it.

## Useful boundaries

- Keep form validation separate from server persistence when those have
  different owners or lifecycles.
- Keep async pending, retry, cancellation, and close policy explicit.
- Surface field validation at the field; keep recoverable workflow errors in
  the workflow UI. Do not convert every failure into a Toast.
- Add an adapter only where APIs differ materially, then measure its consumer
  bundle and verify that users who do not import it pay no runtime cost.

This guide describes consumer organization only. It does not add or promise a
Rivinia API.
