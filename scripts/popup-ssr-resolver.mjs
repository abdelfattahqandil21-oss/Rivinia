/**
 * Resolve hook for `check-popup-ssr.mjs`: maps the built overlay FESM imports
 * onto local `dist/` output, so Node can import them without aliases installed
 * in `node_modules`. Kept separate because a module hook must be registered
 * before the imports it governs.
 */
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(fileURLToPath(import.meta.url), '../..');

const MAP = {
  '@rivinia/select': 'dist/select/fesm2022/rivinia-select.mjs',
  '@rivinia/select/ui': 'dist/select/fesm2022/rivinia-select-ui.mjs',
  '@rivinia/menu': 'dist/menu/fesm2022/rivinia-menu.mjs',
  '@rivinia/menu/ui': 'dist/menu/fesm2022/rivinia-menu-ui.mjs',
  '@rivinia/modal': 'dist/modal/fesm2022/rivinia-modal.mjs',
  '@rivinia/modal/ui': 'dist/modal/fesm2022/rivinia-modal-ui.mjs',
  '@rivinia/popup': 'dist/popup/fesm2022/rivinia-popup.mjs',
  '@rivinia/toast': 'dist/toast/fesm2022/rivinia-toast.mjs',
  '@rivinia/toast/ui': 'dist/toast/fesm2022/rivinia-toast-ui.mjs',
};

export function resolve(specifier, context, next) {
  const target = MAP[specifier];
  if (!target) return next(specifier, context);
  const absolute = resolvePath(ROOT, target);
  if (!existsSync(absolute)) {
    throw new Error(
      `${specifier} is not built. Expected ${absolute}\nBuild it first: pnpm build:select && pnpm build:menu`,
    );
  }
  return { url: `file://${absolute}`, format: 'module', shortCircuit: true };
}
