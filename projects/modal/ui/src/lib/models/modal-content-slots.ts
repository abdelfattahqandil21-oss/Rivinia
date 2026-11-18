import { InjectionToken, TemplateRef, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';

export type ModalContentSlotName = 'header' | 'footer';

export interface ModalContentSlotRegistry {
  register(name: ModalContentSlotName, template: TemplateRef<unknown>): () => void;
}

export interface ModalContentSlots {
  readonly header: WritableSignal<TemplateRef<unknown> | null>;
  readonly footer: WritableSignal<TemplateRef<unknown> | null>;
  readonly registry: ModalContentSlotRegistry;
}

/** Private bridge between a managed content injector and the modal host's slots. */
export const MODAL_CONTENT_SLOT_REGISTRY = new InjectionToken<ModalContentSlotRegistry>(
  'RIVINIA_MODAL_CONTENT_SLOT_REGISTRY',
);

export function createModalContentSlots(): ModalContentSlots {
  const header = signal<TemplateRef<unknown> | null>(null);
  const footer = signal<TemplateRef<unknown> | null>(null);
  const templates: Record<ModalContentSlotName, TemplateRef<unknown>[]> = {
    header: [],
    footer: [],
  };
  const slots = { header, footer };

  return {
    ...slots,
    registry: {
      register(name, template) {
        const registered = templates[name];
        registered.push(template);
        slots[name].set(template);

        return () => {
          const index = registered.lastIndexOf(template);
          if (index < 0) return;
          registered.splice(index, 1);
          slots[name].set(registered.at(-1) ?? null);
        };
      },
    },
  };
}
