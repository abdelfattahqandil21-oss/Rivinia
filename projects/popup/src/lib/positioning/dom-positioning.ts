import { composedParent } from '../platform/composed-dom';
import type { BrowserWindow } from '../platform/viewport';

export interface InlineProperty {
  readonly value: string;
  readonly priority: string;
}

export function readInline(style: CSSStyleDeclaration, property: string): InlineProperty {
  return { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) };
}

export function restoreInline(
  style: CSSStyleDeclaration,
  property: string,
  original: InlineProperty,
): void {
  if (original.value) style.setProperty(property, original.value, original.priority);
  else style.removeProperty(property);
}

function fixedContainingBlock(panel: HTMLElement, view: BrowserWindow): HTMLElement | null {
  if (
    typeof view.HTMLElement.prototype.showPopover === 'function' &&
    panel.matches(':popover-open')
  ) {
    return null;
  }
  for (let ancestor = composedParent(panel); ancestor; ancestor = composedParent(ancestor)) {
    const style = view.getComputedStyle(ancestor);
    const contain = style.contain.split(/\s+/);
    const willChange = style.willChange.split(/,\s*/);
    const translate = style.getPropertyValue('translate');
    const scale = style.getPropertyValue('scale');
    if (
      style.transform !== 'none' ||
      // Independent translate establishes a fixed containing block too.
      (translate.length > 0 && translate !== 'none') ||
      // Independent scale also establishes a fixed containing block.
      (scale.length > 0 && scale !== 'none') ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      (style.getPropertyValue('backdrop-filter') !== '' &&
        style.getPropertyValue('backdrop-filter') !== 'none') ||
      contain.some((value) => ['layout', 'paint', 'strict', 'content'].includes(value)) ||
      willChange.some((value) => ['transform', 'perspective', 'filter', 'contain'].includes(value))
    ) {
      return ancestor as HTMLElement;
    }
  }
  return null;
}

export function inFixedContainingBlock(
  panel: HTMLElement,
  view: BrowserWindow,
  position: { readonly left: number; readonly top: number },
): { readonly left: number; readonly top: number } {
  const containingBlock = fixedContainingBlock(panel, view);
  if (!containingBlock) return position;

  const rect = containingBlock.getBoundingClientRect();
  const scaleX = containingBlock.offsetWidth ? rect.width / containingBlock.offsetWidth : 1;
  const scaleY = containingBlock.offsetHeight ? rect.height / containingBlock.offsetHeight : 1;
  if (scaleX <= 0 || scaleY <= 0) return position;
  return {
    left: (position.left - rect.left) / scaleX - containingBlock.clientLeft,
    top: (position.top - rect.top) / scaleY - containingBlock.clientTop,
  };
}
