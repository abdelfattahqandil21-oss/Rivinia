# Ready-made UI

Render a modal with the optional UI entry point.

[Back to @rivinia/modal README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/modal/v1.0.1/projects/modal/README.md)

## Ready-made UI

`@rivinia/modal/ui` is optional. It provides a native `<dialog>` component
(`RiviniaModalDialog`) for UI-only use and `RiviniaModalHost` to render
manager-owned modals. The host passes dismissal intents to the manager before
closing, so guards and promise results remain coordinated.

For a UI-only dialog, import the standalone component and bind its `open`
model. This mode has no manager, guards, or `ModalHandle` promise:

```ts
import { Component } from '@angular/core';
import { RiviniaModalDialog } from '@rivinia/modal/ui';

@Component({
  imports: [RiviniaModalDialog],
  templateUrl: './preview-dialog.component.html',
})
export class PreviewDialog {
  open = false;
}
```

```html
<!-- src/app/preview-dialog.component.html -->
<button type="button" (click)="open = true">Preview</button>
<rv-modal-dialog #dialog [(open)]="open" title="Preview">
  <p>Dialog content.</p>
  <button type="button" (click)="dialog.confirm(true)">Continue</button>
  <button type="button" (click)="dialog.cancel('cancelled')">Cancel</button>
</rv-modal-dialog>
```

`RiviniaModalDialog` accepts `open`, `title`, `description`, `ariaLabel`,
`size`, `position`, `animation`, `closeOnEscape`, `backdrop`, and
`showCloseButton`; its `open` model supports `[(open)]`. In UI-only mode it
emits `confirmed`, `dismissed`, and `cancelled`. In managed use, the host
accepts the required `modal` manager input plus `size`, `showCloseButton`,
and `titleOf` overrides; observe the manager's `ModalHandle.result` instead
of the dialog outputs.
`RvModalHeader` and `RvModalFooter` mark custom slots. Direct projection can
keep using elements; `ng-template` slots also work in direct dialogs and in
content rendered by `RiviniaModalHost`. The host keeps the content component or
template mounted and renders its registered header/footer templates in the
dialog sections, so Forms and other body state are not recreated.

```html
<rv-modal-dialog title="Edit user">
  <form><!-- body content scrolls independently --></form>
  <ng-template rvModalFooter>
    <button type="button" (click)="save()">Save</button>
  </ng-template>
</rv-modal-dialog>
```

For a managed template or component, import `RvModalHeader` / `RvModalFooter`
where the marker is declared. A template header keeps the configured close
button beside the custom content; a custom header element fully replaces the
default title and close button. Use `[showCloseButton]="false"` to hide the
default close control. Footer is optional and has no business buttons by
default. Header and footer separators use `--rv-modal-section-divider` with a
fallback.

Optional action rendering is available from `@rivinia/modal/actions`, keeping
`@rivinia/modal` and `@rivinia/modal/ui` free of a Menu import. This optional
entry point uses `@rivinia/menu` for its More menu.

The action bar reads LTRA-style backend objects directly by default (`id`,
`name`, `color`, and `order`). Override individual field names or use typed
accessors only when a backend differs. The emitted value is the original
object reference. The consumer owns API calls and updates `disabled` or
`loading` through its state accessor.

```ts
import { RiviniaActionBar } from '@rivinia/modal/actions';

type WorkflowAction = {
  id: number;
  name: string;
  color?: string;
  order?: number;
};

readonly actions: readonly WorkflowAction[] = data.buttons;
readonly actionTone = (item: WorkflowAction) =>
  item.color === 'success' ? 'success' as const : 'neutral' as const;
readonly actionState = (item: WorkflowAction) => ({
  loading: this.pendingActionId() === item.id,
});
```

```html
<rv-action-bar
  [items]="actions"
  layout="adaptive"
  [toneOf]="actionTone"
  [stateOf]="actionState"
  (activated)="submitAction($event)"
/>
```

`layout="buttons"` keeps all visible actions as buttons and never creates a
More menu. `layout="more"` puts unpinned actions in More. `layout="adaptive"`
uses width, placement, pinning, and priority to decide which actions remain
inline. The initial implementation supports fields/accessors, appearance,
tone, color, placement, pinned and visible predicates, priority, disabled and
loading state, and identity-preserving events. Import `RiviniaActionTemplate`
from the same optional entry point for custom button and More-item content:

```ts
import { RiviniaActionBar, RiviniaActionTemplate } from '@rivinia/modal/actions';
```

```html
<rv-action-bar [items]="actions" layout="buttons" (activated)="submitAction($event)">
  <ng-template rvActionTemplate let-action let-activate="activate">
    <span>{{ action.name }}</span>
    <span aria-hidden="true">→</span>
  </ng-template>
</rv-action-bar>
```

The supplied template is rendered inside the library-owned button/menu item;
the library retains roles, keyboard behavior, and the accessible label.

The native dialog provides focus containment and restores focus to its
invoker. The UI includes scroll locking, reduced-motion support, RTL-aware
logical positions, and responsive bottom-sheet styling below 640px for
center/top/bottom placements. The UI exposes size, position, animation,
backdrop, Escape, and close-button inputs. During server rendering it remains
closed and opens on the client after hydration. Theme it with CSS custom
properties such as `--rv-modal-bg`, `--rv-modal-fg`, `--rv-modal-border`,
`--rv-modal-radius`, and `--rv-modal-width-md`.
