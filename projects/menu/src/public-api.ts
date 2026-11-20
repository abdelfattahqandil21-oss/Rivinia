export type {
  RiviniaMenuController,
  RiviniaMenuItemData,
  RiviniaMenuFocus,
  RiviniaMenuItem,
  RiviniaMenuPlacement,
} from './lib/models/menu-types';
export { RiviniaMenu } from './lib/services/rivinia-menu';

/** Headless controller; this entry point has no DOM or Popup runtime dependency. */
export {
  MenuController,
  type MenuActivation,
  type MenuActivationSource,
  type MenuEdge,
  type MenuItem,
  type MenuItemDefinition,
  type MenuItemId,
  type MenuItemKind,
  type MenuMovement,
  type MenuTypeaheadOptions,
} from './lib/menu-controller';
