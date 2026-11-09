# Changelog

## Unreleased

- Preserve row selection by stable ID when `manualPagination` swaps the loaded
  page; rows outside the current slice are not treated as removed from the
  result set.
- Add optional `TableState.selectionMode` so empty include and exclude sets can
  be saved and restored without changing the existing `selected`/`excluded`
  arrays. Older states without the field retain their prior inference behavior.
- Preserve include/exclude decisions for temporarily ambiguous duplicate IDs;
  ambiguous rows remain visible but cannot be selected or activated.

## 1.0.4

- Update published internal dependency metadata and version-pinned documentation links for the synchronized Rivinia 1.0 patch. No public API changes.

## 1.0.3

- Correct package repository, documentation, homepage, and issue links after the GitHub repository rename.

## 1.0.2

- No package-specific consumer changes; version synchronized under the Rivinia 1.0 release group.

## 1.0.1

- Documentation: README restructured into docs/table/ pages; stale pre-1.0 wording removed.

## 1.0.0

- First stable release. Row identity must be unique and stable; ambiguous IDs cannot own selection or other identity-dependent state.
