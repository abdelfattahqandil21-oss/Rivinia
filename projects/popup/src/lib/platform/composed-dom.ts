export function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as Document | ShadowRoot;
  return 'host' in root ? root.host : null;
}

export function composedContains(ancestor: Element, descendant: Element): boolean {
  for (let current: Element | null = descendant; current; current = composedParent(current)) {
    if (current === ancestor) return true;
  }
  return false;
}

export function pathContains(path: readonly EventTarget[], element: Element): boolean {
  return path.includes(element);
}
