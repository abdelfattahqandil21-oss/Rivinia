# @rivinia/table

[![npm version](https://img.shields.io/npm/v/@rivinia/table.svg)](https://www.npmjs.com/package/@rivinia/table)
[![license](https://img.shields.io/npm/l/@rivinia/table.svg)](https://www.npmjs.com/package/@rivinia/table)

A headless Angular table controller with typed columns, spans, selection, and optional grid UI.

Package version: **1.0.4**

```ts
import { Component } from '@angular/core';
import { createTable, tableColumn } from '@rivinia/table';
import { RvTable } from '@rivinia/table/ui';
@Component({ imports: [RvTable], template: '<rv-table aria-label="Invoices" [columns]="table.visibleColumns()" [rows]="table.pageRows()" />' })
export class InvoicesPage {
  readonly table = createTable<Invoice>(() => ({
    columns: () => [tableColumn<Invoice>().accessor('number', { header: 'Invoice' })],
    data: () => this.invoices(),
  }));
}
```

## Why @rivinia/table

- The signal pipeline is headless and testable without rendering a grid.
- Typed columns, spans, paging, filters, sorting, and selection share one model.
- The optional grid renders the model and can be replaced with custom markup.

## Install

```bash
npm install @rivinia/table
```

## Quick start

1. Install the package and import `createTable` and `tableColumn`.
2. Create the controller in an Angular injection context.
3. Render `<rv-table>` with its columns and rows.

## Two ways to use it

| Ready-made UI | Headless controller |
| --- | --- |
| `@rivinia/table/ui` | `@rivinia/table` |

The UI and controller are independent; use either or combine them.

## Compatibility

| Angular | Node | Browser verification |
| --- | --- | --- |
| `^22.0.0` | `^22.22.3 or ^24.15.0 or >=26.0.0` | Chromium and Firefox; native Safari not verified |

## Go further

| Topic | Read |
| --- | --- |
| Overview | [Overview](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/overview.md) |
| Install | [Install](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/installation.md) |
| Quick start | [Quick start](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/quick-start.md) |
| Columns | [Columns](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/columns.md) |
| Row and column spans | [Row and column spans](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/spans.md) |
| Selection | [Selection](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/selection.md) |
| Paging and state | [Paging and state](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/paging-and-state.md) |
| Ready-made UI | [Ready-made UI](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/ready-made-ui.md) |
| Theming | [Theming](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/theming.md) |
| Accessibility | [Accessibility](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/accessibility.md) |
| Scope and limits | [Scope and limits](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.4/docs/table/scope-and-limits.md) |

## Grouped headers

Set a column's `headerPath` to group descriptors in outer-to-inner order.
Each group has an `id` and `label`. Use consistent labels for the same path.
The grid merges adjacent visible columns with the same group path. A group
split by column reordering renders as separate segments. Body spans remain
independent and leaf headers keep their existing keyboard and sort behavior.

## Editing and pagination primitives

`createTableCellEditing<V>()` stores a single active draft and committed
local changes keyed by stable row and column IDs. Consumers compose inputs
with `RvTableCell`, apply the edits when projecting data, and own persistence.
Acknowledging a revision removes only that exact change. Use `conflictsWith`
when comparing an edited cell against refreshed source data.

`tablePageItems(page, pageCount)` produces zero-based page items and gaps
for a custom pager. An unknown total (`-1`) yields only the current page.

## Row actions

Use `tableActionColumn<Row>()` from `@rivinia/table/ui` to define a
non-sortable column. Its `actions(row)` factory returns stable IDs, labels,
and optional visibility, disabled, pending, tooltip, tone, and placement.
Use `placement: 'overflow'` for secondary actions in the native disclosure.

Bind `(rowAction)` to receive `rowId`, `row`, `data`, `actionId`, and
`columnId`. The app owns the effect of that action. A projected
`RvTableCell` template for the same column takes precedence.

## Expanded row details

Import `RvTableRowDetail` from `@rivinia/table/ui` and project one
`<ng-template rvTableRowDetail let-row>` into the table. The template receives
the row as its implicit value and its source record through `let-data="data"`.
The table renders the disclosure in the first available cell. Use
`[(expandedRows)]` to own the expanded row IDs and `expandLabel` /
`collapseLabel` to localize the controls. A detail row spans the entire grid.
A disclosure is available only at boundaries that do not cross a vertical
body span. While details are present, ARIA row positions describe the displayed
page including its detail rows.

## Pinned columns

Use `pinned: 'start'` or `pinned: 'end'` on contiguous visible columns
at the corresponding edge. Pinning keeps the supplied order. Pinned columns
use fixed widths (use a CSS length) and logical insets, so start and end
follow the table direction. A group header or merged cell that crosses a
pin boundary scrolls as one cell.

## Column resizing and CSV

Set `resizable: true` on a column to enable its resize handle. Drag the handle
or focus it and use the horizontal arrow keys (Shift uses a larger step).
Home restores the declared width. Optional `[(columnWidths)]` stores pixel
overrides keyed by column ID. Resized columns use a fixed track.

Pass the exact rows and column readers to `exportTableCsv` from the core
entry point. It escapes CSV fields and prefixes formula-like text. The app
chooses the export scope, ordering and download behavior.

## Cards and stack

Import `RiviniaTableRecordsComponent` from `@rivinia/table/ui` alongside
the grid. Pass the same controller's `pageRows()`, a `recordTemplate` whose
implicit value is the `TableRow`, and mode `cards` or `stack`. The renderer
uses article semantics and shares the table's surface, text, border and
radius tokens. Record-specific tokens control minimum width, gap and padding.
Keep selection, drafts, page and sort state in the consuming controller or
parent so those values survive a renderer change.

## Optional pagination and external toolbar

Import `RiviniaTablePagerComponent` from `@rivinia/table/ui`. Bind
`[(page)]="table.page"`, `[(pageSize)]="table.pageSize"` and
`[pageCount]="table.pageCount()"`. For unknown totals, pass -1 and supply
`hasNext` from the application. Use `pageSizes` and `labels` to customize it.

Keep toolbar markup in the consuming application. It can sit inside the
same container as the grid or anywhere on the page. Bind the search box to
`table.globalSearch` and controls to controller signals. Custom cell
templates are clipped to their track; use wrapping or an overlay when a
control needs more room.
