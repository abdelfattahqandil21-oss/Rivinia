export type TablePageItem =
  | { readonly kind: 'page'; readonly index: number }
  | { readonly kind: 'gap'; readonly after: number };

/** Page indices are zero-based. Unknown totals display only the current page. */
export function tablePageItems(
  page: number,
  pageCount: number,
  siblings = 1,
): readonly TablePageItem[] {
  if (!Number.isSafeInteger(page) || page < 0) return [];
  if (pageCount === -1) return [{ kind: 'page', index: page }];
  if (!Number.isSafeInteger(pageCount) || pageCount <= 0) return [];
  const current = Math.min(page, pageCount - 1);
  const radius = Number.isSafeInteger(siblings) ? Math.min(5, Math.max(0, siblings)) : 1;
  const first = Math.max(0, current - radius);
  const last = Math.min(pageCount - 1, current + radius);
  const pages = new Set([0, pageCount - 1]);
  for (let index = first; index <= last; index++) pages.add(index);

  const items: TablePageItem[] = [];
  let previous = -1;
  for (const index of [...pages].sort((a, b) => a - b)) {
    if (index === previous + 2) items.push({ kind: 'page', index: previous + 1 });
    else if (index > previous + 2) items.push({ kind: 'gap', after: previous });
    items.push({ kind: 'page', index });
    previous = index;
  }
  return items;
}
