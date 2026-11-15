## 2026-11-14 — D101: Theme adopts one V2-named token contract

**Status:** Owner-approved; implementation complete locally, release verification pending
**Area:** Theme / packages

### Decision

The existing Theme package and the V2 Theme design converge into one package
contract. V2 semantic token names are canonical across the package and all
Rivinia UI consumers. The contract includes the V2 color, radius, and spacing
tokens, with the existing semantic status colors, font family, and medium shadow
as first-class extensions under the same naming scheme. Focus indicators use
`--rv-color-focus`; brand and selected states use `--rv-color-primary`.

There are no V1 global-token aliases. Every maintained package stylesheet,
adapter, schematic, example, and consumer document migrates to the canonical
names. Package-local tokens remain supported and may fall back to the shared
semantic tokens.

The CSS contract stays usable without Angular. The optional Angular runtime,
toggle UI, motion support, and schematic integrate into the same Theme package
without changing the shared CSS contract or introducing reverse package
dependencies. Nested `data-rv-theme` scopes remain supported.

### Consequences

- Removing the V1 token names is a breaking change. It belongs in the next
  approved major synchronized release; this decision does not authorize a
  version change, tag, or publication.
- Bootstrap and Tailwind adapters map to the same canonical tokens.
- Existing consumer overrides must migrate their variable names.
- The exact package build, package checks, consumer proof, and UI/browser checks
  remain release gates.
