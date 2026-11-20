import type { ModelSignal, OutputEmitterRef } from '@angular/core';

export interface RiviniaPickerApplied<T> {
  readonly value: T | null;
  readonly changed: boolean;
}

export function confirmPickerValue<T>(
  model: ModelSignal<T | null>,
  applied: OutputEmitterRef<RiviniaPickerApplied<T>>,
  value: T | null,
  changed: boolean,
  afterWrite?: () => void,
): void {
  if (changed) model.set(value);
  afterWrite?.();
  applied.emit({ value, changed });
}
