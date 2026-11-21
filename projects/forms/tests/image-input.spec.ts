import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { RiviniaImageInputComponent, type FileUploadStatus } from '../src/public-api';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = () => 'blob:avatar';
  URL.revokeObjectURL = () => undefined;
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

@Component({
  imports: [RiviniaImageInputComponent],
  template: `
    <rv-image-input
      id="default"
      label="Profile photo"
      viewer="dialog"
      [value]="avatar()"
      [uploadState]="state()"
    />

    <rv-image-input
      id="custom"
      label="الصورة الشخصية"
      viewer="dialog"
      [value]="avatar()"
      [uploadState]="state()"
      chooseLabel="اختر صورة"
      replaceLabel="استبدل الصورة"
      removeLabel="إزالة"
      viewLabel="عرض الصورة"
      closeViewLabel="إغلاق المعاينة"
      retryLabel="إعادة المحاولة"
      dropHint="أفلت الصورة هنا"
      uploadingLabel="جارٍ الرفع"
      completeLabel="تم الرفع"
      failedLabel="فشل الرفع"
      uploadProgressLabel="تقدم رفع"
    />
  `,
})
class Host {
  readonly avatar = signal<File | null>(
    new File(['a'], 'avatar.png', {
      type: 'image/png',
    }),
  );

  readonly state = signal<FileUploadStatus>({
    state: 'uploading',
    progress: 40,
  });
}

async function settle(fixture: ComponentFixture<Host>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

it('exposes localized labels for the viewer, actions and upload states', async () => {
  const fixture = TestBed.createComponent(Host);
  await settle(fixture);

  const root = fixture.nativeElement as HTMLElement;
  const inputs = root.querySelectorAll<HTMLElement>('rv-image-input');

  expect(inputs.length).toBe(2);

  const defaults = inputs[0];

  expect(defaults.textContent).toContain('Replace image');
  expect(defaults.textContent).toContain('Drag files here or choose files.');
  expect(defaults.textContent).toContain('· Uploading');

  expect(defaults.querySelector('progress')?.getAttribute('aria-label')).toBe(
    'Upload progress for avatar.png',
  );

  expect(defaults.querySelector('[aria-label="Remove avatar.png"]')).not.toBeNull();

  expect(defaults.querySelector('[aria-label="View image avatar.png"]')).not.toBeNull();

  expect(defaults.querySelector('[aria-label="Close preview"]')).not.toBeNull();

  const custom = inputs[1];

  expect(custom.textContent).toContain('استبدل الصورة');
  expect(custom.textContent).toContain('أفلت الصورة هنا');
  expect(custom.textContent).toContain('· جارٍ الرفع');

  expect(custom.querySelector('progress')?.getAttribute('aria-label')).toBe('تقدم رفع avatar.png');

  expect(custom.querySelector('[aria-label="إزالة avatar.png"]')).not.toBeNull();

  expect(custom.querySelector('[aria-label="عرض الصورة avatar.png"]')).not.toBeNull();

  expect(custom.querySelector('[aria-label="إغلاق المعاينة"]')).not.toBeNull();
});

it('forwards the retry label and falls back to the choose label when empty', async () => {
  const fixture = TestBed.createComponent(Host);
  await settle(fixture);

  const host = fixture.componentInstance;

  host.state.set({ state: 'failed' });
  await settle(fixture);

  const root = fixture.nativeElement as HTMLElement;
  const inputs = root.querySelectorAll<HTMLElement>('rv-image-input');

  expect(inputs.length).toBe(2);

  const defaults = inputs[0];
  const custom = inputs[1];

  expect(defaults.textContent).toContain('· Failed');
  expect(defaults.querySelector('.retry')?.textContent?.trim()).toBe('Try again');

  expect(custom.textContent).toContain('· فشل الرفع');
  expect(custom.querySelector('.retry')?.textContent?.trim()).toBe('إعادة المحاولة');

  host.avatar.set(null);
  await settle(fixture);

  expect(defaults.textContent).toContain('Choose image');
  expect(custom.textContent).toContain('اختر صورة');
});
