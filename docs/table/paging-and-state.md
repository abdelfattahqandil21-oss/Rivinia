# Paging and state

Control paging and serialize table state.

[Back to @rivinia/table README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/table/v1.0.1/projects/table/README.md)

## Paging and state

`page`, `pageSize`, `sorting`, `filters` and `globalSearch` are writable
signals; `rows` (filtered and sorted), `pageRows` (sliced) and `total` are
read-only computeds. `table.state` is the serialisable slice — put it in the URL
and the user can share what they see; `setState()` and `resetState()` restore it.

Changing a filter, sort or search resets the page to 0. In client pagination, a
page-size change keeps the previous first visible row in view when possible
and clamps to the last known page if the new size leaves that row beyond the
result. With `manualPagination`, a page-size change resets to 0 because the
controller cannot assume that the server uses offset pagination. An explicitly
restored out-of-range page remains empty until the consumer changes it.
