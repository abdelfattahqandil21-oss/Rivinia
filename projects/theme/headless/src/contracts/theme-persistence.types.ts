export interface RiviniaThemePersistenceOptions {
  /** Persist the selected mode to localStorage. Disabled unless explicitly enabled. */
  readonly persist?: boolean;
  /** Key used when persistence is enabled. Defaults to `rivinia-theme-mode`. */
  readonly storageKey?: string;
}
