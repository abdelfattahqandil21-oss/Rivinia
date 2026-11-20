# Changelog

## Unreleased — local integration (not published)

- Add managed and direct `ng-template` Header/Footer slots, plus responsive scroll sections and configurable separators.
- Add optional `@rivinia/modal/actions` entry point for backend action objects. Modal core and UI no longer depend on Menu.
- Add `RiviniaActionBar` conventions for `id`/`name`/`color`/`order`, field bindings, pinned/visible controls, explicit `buttons` layout, and identity-preserving events.
- Add closeLabel to the dialog and managed host; preserve the English default and allow reactive localized accessible names.
- Synchronize dialog teardown with the exit animation event and fade the native backdrop during close.

## 1.0.4

- Update published internal dependency metadata and version-pinned documentation links for the synchronized Rivinia 1.0 patch. No public API changes.

## 1.0.3

- Correct package repository, documentation, homepage, and issue links after the GitHub repository rename.

## 1.0.2

- No package-specific consumer changes; version synchronized under the Rivinia 1.0 release group.

## 1.0.1

- Documentation: README restructured into docs/modal/ pages; stale pre-1.0 wording removed.

## 1.0.0

- First stable release of the modal lifecycle and native-dialog UI. Destroyed dialogs now release lifecycle resources safely.

## Unreleased

- Release scroll locks and exit timers when a modal dialog is destroyed while open or closing.
