# Rivinia Forms foundation

Private Angular 22 pilot. The public import surface for a packed local consumer is `@rivinia/forms`.

| Export | Use |
| --- | --- |
| `RiviniaInputDirective` | Add the `rv-input` styling hook to a native input or textarea. Native attributes and Angular forms binding stay on that element. |
| `RiviniaFormFieldComponent` | Present an optional label, persistent description, and hint or error. Set `reserveMessageSpace` to reserve a line. |
| `RiviniaDecimalInputComponent` | Edit and commit an exact, nullable decimal string with digits and separators from a locale. |

```html
<rv-form-field controlId="amount" label="Amount" hint="Enter a decimal amount.">
  <rv-decimal-input controlId="amount" [formControl]="amount" describedBy="amount-message" />
</rv-form-field>
```

Use the same unique `controlId` on the wrapper and the native control (or decimal component). Connect descriptions with `aria-describedby` on native inputs or `describedBy` on the decimal component. A description uses `<id>-description`. Error and hint use the same `<id>-message` ID. Supply IDs only for messages present in the DOM.

The decimal component accepts `[formField]`, `[formControl]`, `[(ngModel)]` or `[(value)]`. Choose one value owner. The model is an ASCII decimal string such as `'12.30'` or `null`. Blur or Enter attempts to commit. Clearing commits `null`. Escape restores the last value if there are unsaved edits. Incomplete and invalid drafts stay visible and emit `draftRejected` on the first failed commit. For this pilot applications own submit blocking and error messages for rejected drafts. Grouping, rounding and currency adornments are outside the decimal input contract.

Styles read local `--rv-input-*` and `--rv-field-*` overrides, then Rivinia semantic theme tokens, then standalone CSS system colors. Scope overrides on a containing element. Import `@rivinia/forms/input.css` once from your global stylesheet for styled native controls. Place `rvInput` directly on the native input or textarea. Add a regular label with matching `for` and `id`. The stylesheet uses the `rivinia-forms` cascade layer so application overrides can be scoped without increasing specificity. Built-in controls include their own styles.

Run `pnpm exec ng test forms --watch=false` and `pnpm exec ng build forms`.

## Password and OTP

`RiviniaPasswordComponent` renders `rv-password` with a native password input and a reveal button. Set `autocomplete="new-password"` for registration. Pass an optional custom icon template; its implicit value is the reveal state. Keep the template decorative because the button owns the accessible name.

```html
<ng-template #visibility let-revealed>
  <span aria-hidden="true">{{ revealed ? '◉' : '○' }}</span>
</ng-template>
<rv-form-field controlId="secret" label="Password">
  <rv-password controlId="secret" [icon]="visibility" [formField]="fields.password" />
</rv-form-field>
```

`RiviniaOtpComponent` renders `rv-otp` with a native input per slot and a single combined Angular value. It defaults to six digits, preserves leading zeroes, and normalizes Arabic and Persian digits. Use `autofocus` to focus the first available slot on mount. Typing advances focus and pasting a full code fills the group. Use `[length]` (1–12) and `alphabet="alphanumeric"` for other codes. `completed` carries no code payload and leaves verification and submission to the application. Pair both controls with a native label via `controlId`.

## Phone and numeric masks

`rv-phone` uses a native `tel` input and preserves the entered string. The consumer handles country selection, validation and conversion to E.164. Phone metadata is not required.

```html
<rv-form-field controlId="phone" label="Phone number">
  <rv-phone controlId="phone" [formControl]="phone" />
</rv-form-field>
<rv-form-field controlId="reference" label="Reference">
  <rv-mask controlId="reference" mask="##-####" [formControl]="reference" />
</rv-form-field>
```

`rv-mask` uses `#` for digit slots and inserts non-digit literals between digits. For example, it displays `01-2345` for a form value of `'012345'`. Arabic and Persian digits normalize to ASCII. Applications supply a mask without literal digits and validate minimum length as needed. A pattern with no slots or with literal digits falls back to unformatted digits. A model value should contain only digits within the configured capacity.


Set `[state]` to `entry`, `checking`, `success` or `failure` to use the built-in verification presentation. Set it back to `entry` to retry. Clear the bound value before retry if desired. The application controls the verification request, retry and timing. Use `checkingLabel`, `successLabel` and `failureLabel` to localize announcements. The transition uses the same `[length]` as the editor. Style it with `--rv-otp-width`, `--rv-otp-gap`, `--rv-otp-gather-duration`, `--rv-otp-result-duration` and the status color tokens. Reduced-motion preferences are respected.


## Native text fields

Import the standalone directive and the shared stylesheet. Use native `type`, `autocomplete`, `maxlength`, `readonly`, and `disabled`. The `rvInputVariant` input accepts `filled` (default), `outlined`, and `minimal`. The minimal variant uses a bottom border in its resting state. All variants share a visible inset focus indicator.

```html
<label for="summary">Summary</label>
<textarea rvInput rvInputVariant="outlined" id="summary" rows="4" maxlength="240"></textarea>
```

### Floating labels and leading icons

```html
<div class="rv-floating-field">
  <input rvInput rvInputVariant="minimal" id="name" placeholder=" " />
  <label for="name">Name</label>
</div>

<label for="search">Search</label>
<div class="rv-icon-field">
  <rv-input-icon name="search" />
  <input rvInput id="search" type="search" />
</div>
```

The space placeholder lets CSS distinguish an empty value. The real label stays associated with the input and floats on focus or while a value is present. To replace the built-in icon, use any decorative SVG or icon component in a `<span class="rv-input-icon" aria-hidden="true">`. Import your icon package in the application.

Text fields get an icon only when supplied in `.rv-icon-field`. For specialized controls, `rv-phone` supplies a phone icon and accepts a replacement `TemplateRef` via `[icon]`. Pass `[icon]="null"` to hide it. Password's visibility icon uses its existing `[icon]` template input.

## Ready-made text input

Import `RiviniaTextInputComponent` for `<rv-input>`. It includes the label, native editor, variants and an optional leading icon template. Email supplies a default Mail icon. Pass `[icon]="null"` to hide it. Other types have no automatic icon.

```html
<ng-template #userIcon><svg lucideUser></svg></ng-template>
<rv-input id="username" label="Username" name="username" variant="outlined"
  autocomplete="username" autocapitalize="off" [icon]="userIcon" required
  formControlName="username" />
```

Use one binding per instance: `formControlName` or `[formControl]`, `[formField]`, `[(ngModel)]`, or standalone `[(value)]`. The native input owns the supplied ID. Use `describedBy` to link help or error messages. The existing `rvInput` directive remains available for custom markup.

## Choice controls and buttons

- `rv-radio-group` takes `name`, `label` and `options`. Give each group a unique native name and each option a unique value. It supports `stacked` and `inline` variants and a nullable string value.
- `rv-toggle` defaults to a switch. Set `variant="checkbox"` for a native checkbox presentation. Use `[(checked)]` for standalone state or bind one Angular Forms control. `indeterminate` applies only to the checkbox variant.
- Add `rvButton` to a native button and import `@rivinia/forms/input.css`. Choose `rvButtonVariant="primary|secondary|ghost|danger"`. Keep the native `type="button"` or `type="submit"`, click handler and `disabled` behavior.

## Range

Import `RiviniaRangeComponent` for `rv-range`. It uses a native single-thumb slider with `min`, `max` and `step`, and emits a number. Supply an initial value within the bounds and on the step grid. Use `[valueText]` to expose a formatted value and unit to assistive technologies. Set `[showValue]="false"` to omit the visible readout.

```html
<rv-range id="volume" label="Volume" [min]="0" [max]="100" [step]="5"
  [(value)]="volume" [valueText]="volume() + '%'" />
```

### Range interval

Use `rv-range-interval` for a numeric pair `[lower, upper]`. The two native sliders have separate tracks and accessible labels. Set the interval and both bounds on the same step grid. User edits cannot cross the other endpoint.

### File picker

`rv-file-input` emits the chosen `readonly File[]`; a new selection replaces the list. Pass `accept` and optional `multiple`, and remove files with the built-in actions. Read or upload from the Angular form value. The native picker resets after selection to support picking the same file again; native form submission does not include that retained list. The application owns file validation and uploading.

Set `variant="dropzone"` to enable drag and drop while keeping the keyboard-accessible native picker. The same `accept` rules and `multiple` limit apply to both entry paths. `rejectedFiles` reports files that did not match or exceeded the single-file limit. MIME and filename matching is for feedback at selection time; applications still own validation.

Use `previewImages` to show local thumbnails for common raster image types. The component creates object URLs only in the browser and revokes them on removal, replacement or destruction. SVG and other file types display their filenames. Previewing does not upload files.

### Currency, percent and units

Use `prefix` and `suffix` to show units around the decimal editor. For example, `prefix="EGP"` displays Egyptian pounds and `suffix="%"` displays a percentage. Both keep the existing exact decimal string value. With the percentage example, entering `12.5` yields `'12.5'`; convert to a fraction in the consumer when required. Include the unit in the field label or description so it is announced when the editor receives focus. Adornments leave currency conversion, rounding and grouping policy to the application.

### Optional phone country selector

Supply `[countries]` and `[(country)]` to show a native country selector. Each option has a stable `code`, a display `label` and a `dialCode`. The control emits the selected code separately from the typed phone string. Changing the country preserves the typed digits. The application decides how to validate or serialize the country and number. Set `countryLabel` for a localized accessible name.

## Ready-made textarea

Import `RiviniaTextareaComponent` for `<rv-textarea>`. Set `rows`, optional `[maxLength]` and `showCount`. The counter follows native string length semantics (UTF-16 code units) and is linked to the native textarea as a description. Unlike a live status, it does not announce on every keystroke. All three input variants are available. Bind through Angular Forms or `[(value)]`.

```html
<rv-textarea id="notes" label="Notes" variant="outlined" [rows]="4"
  [maxLength]="240" showCount [(value)]="notes" />
```

### Password feedback

Set `showCapsLock` to enable the keyboard-specific hint. The hint clears when the editor loses focus. Set `[strength]` to a consumer-calculated score from 0 to 4 and optionally pass `strengthText`. Leave it unset to omit the meter. Strength policy and password confirmation belong to the application.

### Field message precedence

`rv-form-field` can show one message under its projected control. Supply message text via `error`, `pending`, `warning`, `success` or `hint` in that precedence order. The `description` remains visible independently. All message types keep the same `<controlId>-message` ID. The application sets `aria-invalid` on the actual control for errors and can use its own live region when announcements are needed.

Set `autoGrow` to let the textarea grow from `[rows]` up to `[maxRows]` (default 8). Wrapped and explicit lines count toward the height; the textarea scrolls after reaching the cap. Browsers without CSS `field-sizing` retain the native starting rows and resize handle.

## Saved payment method

Import `RiviniaSavedCardComponent` for `<rv-saved-card [card]="paymentMethod" />`. Pass the provider's display metadata: brand, four trailing digits, and optional expiry month and year. The component displays only valid four-digit suffixes and valid expiry dates. `endingLabel` and `expiryLabel` are localizable. For card collection, mount provider-hosted fields in the application. This display component handles no card secrets, transactions, or network requests.

### Hosted payment fields

Import `RiviniaHostedPaymentComponent` and project the mount target for your payment provider. The target remains mounted across `loading`, `ready`, and `error`; it is hidden until ready. Initialize the provider on the mounted target and drive `[state]` from its callbacks. The component emits `retry` and leaves teardown, payment submission, and provider configuration to the application. Set `retryLabel=""` to omit the retry action.

```html
<rv-hosted-payment [state]="paymentState()" (retry)="retryProvider()">
  <div #providerMount></div>
</rv-hosted-payment>
```

Set `showSteppers` and an ASCII decimal `increment` (default `'1'`) to display increase and decrease actions. An empty value steps from zero. An invalid or incomplete draft is left in place and reported instead of being overwritten. The actions use exact decimal arithmetic and retain the larger precision of the typed value and increment. Localize their names with `incrementLabel` and `decrementLabel`.

Set `clearable` on `rv-input` to show a clear action when it holds editable text. Clearing emits an empty string and returns focus to the native input. Set `clearLabel` for translated accessible text and `[clearIcon]` for a decorative icon template. Ready-made search inputs show the Search icon by default; pass `[icon]="null"` to omit it.

Ready-made `rv-input` accepts `description`, `hint`, `error`, `pendingText`, `warning`, `success` and `reserveMessageSpace` directly. It uses the same precedence as `rv-form-field` and links rendered messages to the native input. Use `describedBy` for extra external IDs. An explicit error marks the input as invalid. Angular validators and the timing of displayed errors remain application decisions.


Supply `[currencies]` and `[(currency)]` to put a currency selector inside the price field. Each option has a `code` and `symbol`. The selected symbol appears before the amount unless `prefix` overrides it. Selecting a currency preserves the amount and emits the currency code independently. The application owns conversion and decimal precision policy.

### Using Rivinia Select inside phone and price fields

Install the optional `@rivinia/select` peer in the application when using this integration. Import its UI separately and project an `rv-select` template via `[countrySelect]` or `[currencySelect]`. The template is given a `disabled` context reflecting disabled or read-only state. Bind the selector to the same country or currency state. Import `@rivinia/forms/input.css` for the embedded trigger style. Use `rv-form-field` for an accessible label and visible hint on the number editor. Plain Forms imports do not import Select at runtime.

### Ready-made phone with Rivinia Select

Install the optional Select peer and import `RiviniaSelectPhoneComponent` from `@rivinia/forms/select`. Its selector is `rv-phone`. Import this version instead of the base Phone in a consumer component that uses the integrated picker. It owns the label, hint, error, picker and country row template. The base Phone still supports native or custom picker composition.

```html
<rv-phone id="mobile" label="Mobile number" hint="Choose a country code."
  [countries]="countries" [(country)]="country" [(value)]="number" />
```

If you explicitly request `countryPicker="select"` on the base Phone without a `countrySelect` template, development builds report a configuration error in the console. Import the integrated Phone from `@rivinia/forms/select` and install its `@rivinia/select` peer. An unresolved Select import in that secondary entry point is a build-time dependency error and occurs before runtime diagnostics can execute.

### Upload presentation

`rv-file-input` models a `readonly File[]`; with `multiple` omitted, it accepts at most one file. Use `rv-image-input` for a single `File | null` with a larger preview and replace/remove actions. Both implement Angular's `FormValueControl`. Use one binding per field: `[formField]`, `[formControl]`/`formControlName` (including FormBuilder controls), `[(ngModel)]`, or `[(value)]`.

```html
<rv-file-input id="attachments" label="Attachments" variant="dropzone" multiple
  accept=".pdf,image/*" hint="PDF or image, up to 5 MB per file."
  [maxBytes]="5242880" [uploadStates]="uploadStates()" (retry)="retryUpload($event)"
  formControlName="attachments" />
<rv-image-input id="avatar" label="Profile photo" hint="PNG or JPEG, up to 2 MB."
  accept="image/png,image/jpeg" [maxBytes]="2097152" [(value)]="avatar" />
```

Supply optional decorative templates with `[uploadIcon]` and `[removeIcon]`. Drive progress, completion and failure with a `ReadonlyMap<File, FileUploadStatus>` keyed by the original file objects, or pass `[uploadState]` to the image picker. Publish a new map when states change. `retry` emits the file; the application owns requests and retry policy. `accept` and `maxBytes` provide client-side selection feedback. For a single image, set `--rv-image-input-fit` to `contain` or `cover` to control its preview without editing the file.

### Image galleries and larger previews

Use `previewImages previewLayout="gallery" multiple` on `rv-file-input` to present an array as responsive image tiles. `rv-image-input` supplies the dedicated large preview for one file. Add `viewer="dialog"` to either for a native full-size preview with navigation for arrays. Use `viewer="external"` and `(viewRequested)` to open your own viewer, such as Rivinia Modal, from the selected File. Neither path introduces a Modal dependency into Forms.

Use `multiple selectionMode="append"` to add each batch from the picker or dropzone to the existing array. The default `replace` replaces the array. A single-file field always replaces its selection.
