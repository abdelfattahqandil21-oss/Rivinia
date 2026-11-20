# Composed Forms controls and virtualized combobox

## Composed Forms controls (unreleased major integration)

The additive `@rivinia/select/headless` entry exports `SelectRootDirective`,
`SelectInputDirective`, `SelectListDirective`, `SelectOptionDirective`, and
`SelectStatusDirective`. `SelectController` is exported from `@rivinia/select`.
Options use `{ key, value, label, disabled?, group? }`; object values require
`rvSelectKeyOf`. The root supports a direct Angular Forms CVA and a `value`
model for Signal Forms. Bind only one Forms system to each root.

```html
<section rvSelectRoot rvSelectRootId="city" [rvSelectOptions]="cities" [formControl]="cityControl">
  <label for="city-combobox">City</label>
  <input rvSelectInput />
  <div rvSelectList>
    @for (option of cities; track option.key) {
      <div rvSelectOption [rvSelectOptionKey]="option.key"
        [rvSelectOptionValue]="option.value" [rvSelectOptionLabel]="option.label">
        {{ option.label }}
      </div>
    }
  </div>
</section>
```

The consumer owns panel visibility and styling in this low-level example. Import
`SelectPanelDirective` from `@rivinia/select/ui` for a Popup-managed panel. The existing ready-made component continues to provide `optionTemplate`
and `listTemplate`. Its `RiviniaSelect` facade now delegates selection and filtering to
`SelectController`. The facade preserves ID values and removal pruning; the generic
controller preserves unloaded object selections. The existing ready-made component retains its FormValueControl integration and
menu-style interaction. The combobox presentation below uses the same selection
engine through the headless Forms root. The incoming controller retains the primary package's
accent-insensitive and Arabic-normalized search behavior.

### Virtualized combobox

`RiviniaSelectComboboxComponent` from `@rivinia/select/ui` provides an input with
`role="combobox"`, a listbox, native Angular `animate.enter`/`animate.leave`, a
loading state, and fixed-row virtual rendering above 80 options. Its own styles are
included and scoped; no extra global stylesheet is required for this presentation.
Theme tokens are inherited without a Theme runtime dependency.

```html
<rv-select-combobox
  rvSelectRootId="cities"
  labelText="City"
  [rvSelectOptions]="cityOptions"
  [formControl]="cityControl"
  rvSelectAppearance="outline"
  rvSelectVariant="premium"
/>
```

Options are `{ key, value, label, disabled?, group? }`. Bind `rvSelectKeyOf` for
object values. Reactive Forms, ngModel and Signal Forms bind to the host through
its composed root; do not bind two Forms systems to one control. The selected value
is displayed independently of the search query. Reopening starts at the selected
option; pointer scroll remains free to move away from that active option. The panel
tracks input width and closes after its input is fully clipped. Escape discards an
uncommitted single-value search. Multi-value queries survive close/picks.

Configure `rvSelectVirtualItemSize` (40px by default) and
`rvSelectVirtualOverscan` (3 rows), or disable fixed-row windowing with
`[rvSelectVirtualScroll]="false"`. Input appearance accepts surface/outline/plain/primary;
size and density accept compact/comfortable/spacious; shape accepts square/rounded/pill.
`loading` and `loadingLabel` show a non-option live status with decorative premium
skeletons. Reduced-motion and forced-colors styles are included.

The existing `<rv-select>` keeps its original menu-style focus and row/list
TemplateRef customization. The combobox maintains focus in its input and exposes
`aria-activedescendant`; it therefore uses a distinct selector rather than silently
changing existing keyboard semantics. For fully custom combobox markup use the
headless directives plus `SelectPanelDirective`. The combobox requires native Popover
support; the original component retains its fallback for older engines.
