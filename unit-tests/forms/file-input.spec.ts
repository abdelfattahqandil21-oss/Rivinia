import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { RiviniaFileInputComponent, type FileUploadStatus } from '../../projects/forms/src/public-api';

@Component({
  imports: [RiviniaFileInputComponent],
  template: `
    <rv-file-input id="files" label="Files" [value]="files()" [uploadStates]="states()" />

    <rv-file-input
      id="custom"
      label="Custom"
      variant="dropzone"
      [value]="files()"
      [uploadStates]="states()"
      chooseLabel="Attach"
      removeLabel="Delete"
      retryLabel="Retry"
      dropHint="Drop here"
      uploadingLabel="Sending"
      completeLabel="Sent"
      failedLabel="Broken"
      uploadProgressLabel="Sending progress for"
    />
  `,
})
class Host {
  readonly files = signal<readonly File[]>([
    new File(['a'], 'uploading.pdf', {
      type: 'application/pdf',
    }),
    new File(['b'], 'complete.pdf', {
      type: 'application/pdf',
    }),
    new File(['c'], 'failed.pdf', {
      type: 'application/pdf',
    }),
  ]);

  readonly states = signal<ReadonlyMap<File, FileUploadStatus>>(
    new Map([
      [this.files()[0], { state: 'uploading', progress: 58 }],
      [this.files()[1], { state: 'complete' }],
      [this.files()[2], { state: 'failed' }],
    ]),
  );
}

it('localizes upload status text and the progress label', async () => {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();

  const root = fixture.nativeElement as HTMLElement;
  const inputs = root.querySelectorAll<HTMLElement>('rv-file-input');

  expect(inputs.length).toBe(2);

  const defaults = inputs[0];

  expect(defaults.textContent).toContain('· Uploading');
  expect(defaults.textContent).toContain('· Complete');
  expect(defaults.textContent).toContain('· Failed');

  expect(defaults.querySelector('progress')?.getAttribute('aria-label')).toBe(
    'Upload progress for uploading.pdf',
  );

  const custom = inputs[1];

  expect(custom.textContent).toContain('· Sending');
  expect(custom.textContent).toContain('· Sent');
  expect(custom.textContent).toContain('· Broken');

  expect(custom.querySelector('progress')?.getAttribute('aria-label')).toBe(
    'Sending progress for uploading.pdf',
  );

  expect(custom.querySelector('.retry')?.textContent?.trim()).toBe('Retry');

  expect(custom.querySelector('.drop-action strong')?.textContent?.trim()).toBe('Attach');

  expect(
    custom.querySelector('.drop-action')?.parentElement?.querySelector('p')?.textContent?.trim(),
  ).toBe('Drop here');

  expect(custom.querySelector('[aria-label="Delete failed.pdf"]')).not.toBeNull();
});

it('keeps a consumer-provided upload message ahead of the localized status', async () => {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();

  fixture.componentInstance.states.set(
    new Map([
      [
        fixture.componentInstance.files()[0],
        {
          state: 'uploading',
          progress: 10,
          message: 'Scanning',
        },
      ],
    ]),
  );

  await fixture.whenStable();

  const root = fixture.nativeElement as HTMLElement;
  const files = root.querySelector<HTMLElement>('rv-file-input');

  expect(files).not.toBeNull();
  expect(files!.textContent).toContain('· Scanning');
  expect(files!.textContent).not.toContain('· Uploading');
});
