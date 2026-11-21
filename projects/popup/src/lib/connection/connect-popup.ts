import type { PopupConnection, PopupConnectionOptions } from '../contracts/connection.types';
import { DismissalCoordinator } from '../dismissal/dismissal-coordinator';
import type { BrowserWindow } from '../platform/viewport';
import { PopupSession } from './popup-session';

const connections = new WeakMap<PopupConnection, PopupSession>();
const coordinators = new WeakMap<Document, DismissalCoordinator<PopupSession>>();

/** Connects an already-rendered panel to its origin until dismissed or destroyed. */
export function connectPopup(options: PopupConnectionOptions): PopupConnection {
  const document = options.origin.ownerDocument;
  const view = document.defaultView as BrowserWindow | null;
  if (!view || options.panel.ownerDocument !== document) {
    throw new TypeError('Popup origin and panel must belong to the same active document.');
  }
  if (!options.origin.isConnected || !options.panel.isConnected) {
    throw new TypeError('Popup origin and panel must be connected before creating a connection.');
  }
  if (!options.onDismiss) throw new TypeError('Popup connections require an onDismiss callback.');

  const coordinator =
    coordinators.get(document) ?? new DismissalCoordinator<PopupSession>(document, view);
  const parent =
    options.parent === 'auto'
      ? coordinator.findParent(options.origin)
      : options.parent
        ? connections.get(options.parent)
        : undefined;
  if (
    options.parent &&
    options.parent !== 'auto' &&
    (!parent?.active || parent.document !== document)
  ) {
    throw new TypeError('Popup parent must be an active connection in the same document.');
  }

  let node: PopupSession;
  const connection: PopupConnection = {
    update: (updateOptions) => node.update(updateOptions),
    destroy: () => node.destroy(),
  };
  coordinators.set(document, coordinator);
  node = new PopupSession(options, document, view, coordinator, parent);
  connections.set(connection, node);
  node.start();
  return connection;
}
