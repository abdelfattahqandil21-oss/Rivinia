export type {
  RiviniaSelectController,
  RiviniaSelectMode,
  RiviniaSelectOption,
} from './lib/models/select-types';
export { RiviniaSelect } from './lib/services/rivinia-select';
export {
  RIVINIA_SELECT,
  injectRiviniaSelect,
  provideRiviniaSelect,
} from './lib/providers/select-di';

/*
 * Public API Surface of select
 */

export {
  SelectController,
  type NormalizedSelectOption,
  type SelectControllerOptions,
  type SelectLoadRequest,
  type SelectLoadState,
  type SelectLoadStatus,
  type SelectMode,
  type SelectOption,
} from './lib/select-controller';
