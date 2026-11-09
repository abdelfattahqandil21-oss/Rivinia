# Selection

Select rows using stable row identity.

[Back to @rivinia/table README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.1/projects/table/README.md)

## Selection

Ids, not array positions — so a selection survives sorting and paging, and an
action always receives the row it was rendered for. In client mode, filtering
out a row removes its selection so hidden rows do not remain in a batch action.
With `manualPagination`, the table sees only the loaded page and retains IDs
that are temporarily absent from that page. Turn selection on in the options
(`'single'` or `'multi'`); a table without it renders none of the affordance and
every method is a no-op:

```ts
createTable<Invoice>(() => ({
  columns: () => this.columns,
  data: () => this.invoices(),
  selection: { mode: 'multi' },
}));
```

```ts
table.selection.toggle(row.id);
table.selection.isSelected(row.id);
table.selection.selectAllOnPage(); // page scope, never "everything by accident"
table.selection.clear();
```

### Row identity contract

`getRowId` must return a unique, stable, non-empty string or finite number for
every row in the full active data set. Validation runs before filtering,
sorting, paging, or selection state is committed. In development, duplicate IDs
throw an error naming the ID and source row indices; invalid values name their
source index. In production, rows with ambiguous IDs remain visible, but
selection and other identity-dependent actions are disabled for those rows.
The table never substitutes an array index for an invalid ID. If rows have no
stable `id`, provide a `getRowId` backed by a persistent domain key.

### Saving and restoring selection

`table.state()` includes `selectionMode` (`'include'` or `'exclude'`) alongside
the existing `selected` and `excluded` ID arrays. This keeps an empty include
set (nothing selected) distinct from an empty exclude set (all rows in scope
selected). `setState()`, `initialState`, and `resetState()` honor the explicit
mode. When restoring an older snapshot without `selectionMode`, the table uses
the historical rule: a non-empty `excluded` array means exclude mode; otherwise
it infers include mode. That means legacy snapshots with both arrays empty
cannot recover whether “select all” or “select none” was intended.

With manual pagination, selection state retains IDs from unloaded pages, while
`selection.ids()` and `selection.count()` describe only matching rows currently
loaded in the table. Serialize `table.state()` when the full include/exclude
set is needed for an action across pages. The table cannot tell a new page of
the same query from a different tenant or query scope. When the consumer changes
that scope, call `selection.clear()` (or restore an explicit empty include
state) unless retaining the IDs is intentional.
