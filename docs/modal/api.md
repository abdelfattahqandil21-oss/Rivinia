# API reference

Find the public entry points, symbols, and exports.

[Back to @rivinia/modal README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/modal/v1.0.1/projects/modal/README.md)

## Public core exports

The core entry point exports:

- `provideRiviniaModal()` and `injectRiviniaModal()` for configuration and
  injection, plus `RiviniaModal` for direct manager APIs.
- `StackStrategy`, `QueueStrategy`, and the `ModalStrategy` contract.
- `RiviniaModalConfig`, `ModalPreset`, `ModalHandle`, `ModalResult`,
  `ModalContent`, `ModalOpenOptions`, `ModalUpdate`, `ModalInstance`,
  `ModalTemplateContext`, `ModalContext`, `ModalGuard`,
  `ModalDismissPolicy`, `ModalDismissOrigin`, `ModalOverflowPolicy`,
  `ModalStatus`, `ModalDiagnostic`, and `DescendantPolicy`.
- `RIVINIA_MODAL_CONTEXT` for dynamic modal components.

`RiviniaModal` exposes readonly `active`, `queued`, `closing`, `visible`, and
`top` signals, along with `openModal`, `close`, `dismiss`, `cancel`,
`requestDismiss`, `update`, `confirmClosed`, `dismissAll`, `findByRef`,
`useStrategy`, and diagnostics helpers. Inspect the signal values by calling
them, for example `manager.top()`.

The `@rivinia/modal/ui` entry point exports `RiviniaModalDialog`,
`RiviniaModalHost`, `RiviniaModalHostManager`, `RiviniaModalScrollLock`,
`RvModalHeader`, and `RvModalFooter`, plus the `RiviniaModalAnimation`,
`RiviniaModalBackdrop`, `RiviniaModalPosition`, `RiviniaModalSize`, and
`RiviniaModalUiOptions` types.

Optional backend action rendering is exported from `@rivinia/modal/actions`:
`RiviniaActionBar`, `RiviniaActionTemplate`, and the
`RiviniaActionAppearance`, `RiviniaActionLayout`, `RiviniaActionPlacement`,
`RiviniaActionState`, `RiviniaActionTone`, and
`RiviniaActionTemplateContext` contracts. The package declares `@rivinia/menu`
as an optional peer. Plain Modal consumers do not install or import Menu;
consumers of Actions provide it. The bar defaults to `id`, `name`, `color`,
and `order` fields, with typed field-name inputs or accessors for other shapes.
Activation emits the original object reference and never calls APIs or closes
the modal.


## License

MIT.
