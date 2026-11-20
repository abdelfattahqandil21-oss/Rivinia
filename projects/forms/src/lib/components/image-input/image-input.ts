import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, model, output, type TemplateRef, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { RiviniaFileInputComponent } from '../file-input/file-input';
import type { FileUploadStatus } from '../../models/file-upload-status';

@Component({
  selector: 'rv-image-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RiviniaFileInputComponent],
  templateUrl: './image-input.html',
  host: { '[attr.id]': 'null' },
})
export class RiviniaImageInputComponent implements FormValueControl<File | null> {
  readonly value = model<File | null>(null);
  readonly controlId = input.required<string>({ alias: 'id' });
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly accept = input('image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp');
  readonly maxBytes = input<number>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly uploadIcon = input<TemplateRef<unknown>>();
  readonly removeIcon = input<TemplateRef<unknown>>();
  readonly viewer = input<'none' | 'dialog' | 'external'>('none');
  readonly viewRequested = output<File>();
  readonly uploadState = input<FileUploadStatus>();
  readonly chooseLabel = input('Choose image');
  readonly replaceLabel = input('Replace image');
  readonly rejectedFiles = output<readonly File[]>();
  readonly retry = output<File>();
  readonly touch = output<void>();

  protected readonly files = computed(() => {
    const file = this.value();
    return file ? [file] : [];
  });
  protected readonly states = computed(() => {
    const file = this.value();
    const state = this.uploadState();
    return file && state ? new Map([[file, state]]) : undefined;
  });
  private readonly picker = viewChild.required(RiviniaFileInputComponent);

  focus(options?: FocusOptions): void {
    this.picker().focus(options);
  }
}
