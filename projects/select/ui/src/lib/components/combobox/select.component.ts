import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  SelectInputDirective,
  SelectListDirective,
  SelectOptionDirective,
  SelectRootDirective,
  SelectStatusDirective,
  type SelectKey,
} from '@rivinia/select/headless';
import { SelectPanelDirective } from './select-panel.directive';

const DEFAULT_ROW_SIZE = 40;
const DEFAULT_OVERSCAN = 3;
const DEFAULT_WINDOW_SIZE = 12;
const VIRTUALIZE_AFTER = 80;

interface OptionWindow {
  readonly start: number;
  readonly end: number;
}

@Component({
  selector: 'rv-select-combobox',
  standalone: true,
  imports: [
    SelectInputDirective,
    SelectListDirective,
    SelectOptionDirective,
    SelectPanelDirective,
    SelectStatusDirective,
  ],
  hostDirectives: [
    {
      directive: SelectRootDirective,
      inputs: [
        'rvSelectRootId',
        'rvSelectMode',
        'rvSelectDisabled',
        'rvSelectKeyOf',
        'rvSelectOptions',
        'rvSelectAppearance',
        'rvSelectVariant',
        'rvSelectSize',
        'rvSelectShape',
        'rvSelectDensity',
        'value',
        'disabled',
        'readonly',
        'invalid',
        'touched',
        'dirty',
        'required',
      ],
      outputs: [
        'valueChange',
        'touch',
        'touchedChange',
        'rvSelectValueChange',
        'rvSelectQueryChange',
        'rvSelectTouched',
        'rvSelectActiveOptionChange',
        'rvSelectPanelReady',
        'rvSelectReachEnd',
      ],
    },
  ],
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.css', './select-theme.css'],
})
export class RiviniaSelectComboboxComponent {
  protected readonly root = inject(SelectRootDirective);
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly optionRows = viewChildren(SelectOptionDirective);
  readonly placeholder = input('Choose an option');
  readonly labelText = input.required<string>();
  readonly loading = input(false);
  readonly loadingLabel = input('Loading options');
  readonly noOptionsLabel = input('No options available.');
  readonly noResultsLabel = input('No matching options.');
  readonly rvSelectVirtualScroll = input(true);
  readonly rvSelectVirtualItemSize = input(DEFAULT_ROW_SIZE);
  readonly rvSelectVirtualOverscan = input(DEFAULT_OVERSCAN);
  readonly value = this.root.value;
  readonly disabled = this.root.disabled;
  readonly readonly = this.root.readonly;
  readonly invalid = this.root.invalid;
  readonly touched = this.root.touched;
  readonly dirty = this.root.dirty;
  readonly required = this.root.required;
  readonly touch = this.root.touch;
  readonly visibleOptions = this.root.visibleOptions;
  readonly range = signal<OptionWindow>({ start: 0, end: DEFAULT_WINDOW_SIZE });
  readonly renderedOptions = computed(() => {
    const options = this.visibleOptions();
    const window = this.currentWindow(options.length);
    return options.slice(window.start, window.end);
  });
  readonly topSpacer = computed(() => {
    const options = this.visibleOptions();
    return this.currentWindow(options.length).start * this.rvSelectVirtualItemSize();
  });
  readonly bottomSpacer = computed(() => {
    const options = this.visibleOptions();
    const window = this.currentWindow(options.length);
    return Math.max(0, options.length - window.end) * this.rvSelectVirtualItemSize();
  });
  readonly empty = computed(
    () => this.root.isOpen() && !this.loading() && this.visibleOptions().length === 0,
  );

  constructor() {
    effect(() => {
      this.root.setRenderedOptionKeys(
        this.optionRows().map((option) => option.rvSelectOptionKey()),
      );
    });
    effect(() => {
      const options = this.visibleOptions();
      const activeKey = this.root.activeKey();
      const key = activeKey;
      const itemSize = this.rvSelectVirtualItemSize();
      const overscan = this.rvSelectVirtualOverscan();
      const enabled = this.rvSelectVirtualScroll();
      const index = options.findIndex((option) => option.key === key);
      const isOpen = this.root.isOpen();
      if (!isOpen || index < 0) return;
      const current = untracked(() => this.range());
      const panel = this.panelRef()?.nativeElement;
      if (
        enabled &&
        options.length > VIRTUALIZE_AFTER &&
        (index < current.start || index >= current.end)
      ) {
        const viewportRows = panel
          ? Math.max(1, Math.ceil(panel.clientHeight / itemSize))
          : DEFAULT_WINDOW_SIZE;
        const start = Math.max(0, index - overscan);
        this.range.set({
          start,
          end: Math.min(options.length, start + viewportRows + overscan * 2),
        });
      }
      panel?.ownerDocument.defaultView?.requestAnimationFrame(() => {
        const element = this.panelRef()?.nativeElement;
        if (!element || !this.root.isOpen()) return;
        const activeTop = index * itemSize;
        const activeBottom = activeTop + itemSize;
        if (activeTop < element.scrollTop) element.scrollTop = activeTop;
        else if (activeBottom > element.scrollTop + element.clientHeight) {
          element.scrollTop = activeBottom - element.clientHeight;
        }
      });
    });
    effect(() => {
      const options = this.visibleOptions();
      const current = this.range();
      if (current.end > options.length && options.length > 0) {
        this.range.set({ start: 0, end: Math.min(options.length, DEFAULT_WINDOW_SIZE) });
      }
    });
  }

  onPanelScroll(event: Event): void {
    const panel = event.currentTarget as HTMLElement;
    const options = this.visibleOptions();
    const itemSize = Math.max(1, this.rvSelectVirtualItemSize());
    if (!this.rvSelectVirtualScroll() || options.length <= VIRTUALIZE_AFTER) {
      this.range.set({ start: 0, end: options.length });
      return;
    }
    const first = Math.floor(panel.scrollTop / itemSize);
    const start = Math.max(0, first - this.rvSelectVirtualOverscan());
    const visibleCount = Math.ceil(panel.clientHeight / itemSize);
    const end = Math.min(options.length, first + visibleCount + this.rvSelectVirtualOverscan() + 1);
    this.range.set({ start, end });
  }

  optionPosition(index: number): number {
    return this.currentWindow(this.visibleOptions().length).start + index + 1;
  }

  optionId(key: SelectKey): string | undefined {
    return this.root.optionId(key);
  }

  private currentWindow(count: number): OptionWindow {
    if (!this.rvSelectVirtualScroll() || count <= VIRTUALIZE_AFTER) {
      return { start: 0, end: count };
    }
    const current = this.range();
    const end = Math.min(count, Math.max(current.end, DEFAULT_WINDOW_SIZE));
    const start = Math.min(current.start, Math.max(0, end - DEFAULT_WINDOW_SIZE));
    return { start, end };
  }

}
