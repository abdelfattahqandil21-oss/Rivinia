import { NgTemplateOutlet } from '@angular/common';
import { afterRenderEffect, booleanAttribute, ChangeDetectionStrategy, Component, computed, ElementRef, input, model, output, signal, type TemplateRef, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import type { FileUploadStatus } from '../../models/file-upload-status';

@Component({
  imports: [NgTemplateOutlet],
  selector: 'rv-file-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-input.html',
  styleUrl: './file-input.css',
  host: { '[attr.id]': 'null', '(focusout)': 'onFocusOut($event)' },
})
export class RiviniaFileInputComponent implements FormValueControl<readonly File[]> {
  readonly value = model<readonly File[]>([]);
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly accept = input('');
  readonly hint = input('');
  readonly maxBytes = input<number>();
  readonly chooseLabel = input('Choose files');
  readonly retryLabel = input('Try again');
  readonly uploadIcon = input<TemplateRef<unknown>>();
  readonly removeIcon = input<TemplateRef<unknown>>();
  readonly uploadStates = input<ReadonlyMap<File, FileUploadStatus>>();
  readonly viewer = input<'none' | 'dialog' | 'external'>('none');
  readonly viewLabel = input('View image');
  readonly closeViewLabel = input('Close preview');
  readonly previousViewLabel = input('Previous');
  readonly nextViewLabel = input('Next');
  readonly viewRequested = output<File>();
  protected readonly viewedFile = signal<File | null>(null);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('imageDialog');
  readonly previewLayout = input<'thumbnail' | 'image' | 'gallery'>('thumbnail');
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly retry = output<File>();
  protected readonly blocked = computed(() => this.disabled() || this.readonly());
  protected readonly descriptions = computed(() => [
    this.variant() === 'dropzone' && this.dropHint() ? this.controlId() + '-drop-hint' : '',
    this.hint() ? this.controlId() + '-file-hint' : '',
    this.describedBy(),
  ].filter(Boolean).join(' ') || null);
  readonly variant = input<'picker' | 'dropzone'>('picker');
  readonly dropHint = input('Drag files here or choose files.');
  readonly previewImages = input(false, { transform: booleanAttribute });
  readonly rejectedFiles = output<readonly File[]>();
  protected readonly dragging = signal(false);
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly selectionMode = input<'replace' | 'append'>('replace');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly describedBy = input('');
  readonly removeLabel = input('Remove');
  readonly touch = output<void>();
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected readonly files = computed(() => this.value() ?? []);
  protected readonly previews = signal<ReadonlyMap<File, string>>(new Map());

  protected readonly viewableFiles = computed(() => this.files().filter(file => this.previews().has(file)));
  protected readonly viewingIndex = computed(() => this.viewableFiles().findIndex(file => file === this.viewedFile()));
  protected readonly viewedUrl = computed(() => {
    const file = this.viewedFile();
    return file ? this.previews().get(file) : undefined;
  });

  constructor() {
    afterRenderEffect(() => {
      const file = this.viewedFile();
      if (file && (!this.files().includes(file) || this.viewer() !== 'dialog')) {
        this.dialog()?.nativeElement.close();
      }
    });
    afterRenderEffect((onCleanup) => {
      const urls = new Map<File, string>();
      if (this.previewImages()) {
        for (const file of this.files()) {
          if (/^image\/(?:png|jpeg|gif|webp|avif|bmp)$/i.test(file.type) && !urls.has(file)) {
            urls.set(file, URL.createObjectURL(file));
          }
        }
      }
      this.previews.set(urls);
      onCleanup(() => {
        for (const url of urls.values()) URL.revokeObjectURL(url);
      });
    });
  }

  focus(options?: FocusOptions): void {
    this.picker().nativeElement.focus(options);
  }

  protected select(picker: HTMLInputElement): void {
    const files = Array.from(picker.files ?? []);
    if (!this.blocked()) this.apply(files);
    picker.value = '';
  }

  protected dragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.blocked() ? 'none' : 'copy';
    this.dragging.set(!this.blocked());
  }

  protected dragLeave(event: DragEvent): void {
    const zone = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !zone.contains(event.relatedTarget)) {
      this.dragging.set(false);
    }
  }

  protected drop(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(false);
    if (!this.blocked()) this.apply(Array.from(event.dataTransfer.files));
  }

  private apply(files: readonly File[]): void {
    const rules = this.accept().split(',').map(rule => rule.trim().toLowerCase()).filter(Boolean);
    const maxBytes = this.maxBytes();
    const accepted: File[] = [];
    const rejected: File[] = [];

    for (const file of files) {
      const matches = !rules.length || rules.some(rule => {
        if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
        if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
        return file.type.toLowerCase() === rule;
      });
      if (matches && (maxBytes === undefined || file.size <= maxBytes) && (this.multiple() || accepted.length === 0)) accepted.push(file);
      else rejected.push(file);
    }

    if (accepted.length) {
      const append = this.multiple() && this.selectionMode() === 'append';
      this.value.set(append ? [...this.files(), ...accepted] : accepted);
    }
    if (rejected.length) this.rejectedFiles.emit(rejected);
  }

  protected remove(index: number): void {
    this.value.update(files => (files ?? []).filter((_, fileIndex) => fileIndex !== index));
    this.focus();
  }

  protected openView(file: File): void {
    if (this.viewer() === 'external') {
      this.viewRequested.emit(file);
    } else if (this.viewer() === 'dialog') {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog || dialog.open) return;
      this.viewedFile.set(file);
      dialog.showModal();
    }
  }

  protected moveView(direction: -1 | 1): void {
    const file = this.viewableFiles()[this.viewingIndex() + direction];
    if (file) this.viewedFile.set(file);
  }

  protected progress(status: FileUploadStatus): number | null {
    if (status.state !== 'uploading' || status.progress === undefined || !Number.isFinite(status.progress)) return null;
    return Math.round(Math.max(0, Math.min(100, status.progress)));
  }

  protected sizeLabel(size: number): string {
    return size < 1024 ? size + ' B' : size < 1048576 ? (size / 1024).toFixed(1) + ' KB' : (size / 1048576).toFixed(1) + ' MB';
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.touch.emit();
  }
}
