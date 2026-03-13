/**
 * @fileoverview Global TanStack stores for WebSocket connections and listeners.
 *
 * These stores enable the singleton patterns used by the hooks. Connections are
 * keyed by URL path (e.g. `/api`); listeners are keyed by API key (e.g. `voyages-list`).
 *
 * @module websocketStores
 */

import { Store } from '@tanstack/react-store';
import { WebsocketListener } from './types';
import { WebsocketConnection } from './WebsocketConnection';

/**
 * Global map of active WebSocket connections, keyed by URL path.
 *
 * One connection per key. Managed by {@link findOrCreateWebsocketConnection} and
 * {@link getExistingWebsocketConnection}.
 */
export const websocketConnections = new Store<Map<string, WebsocketConnection>>(new Map());

/**
 * Global map of active WebSocket listeners (subscription and message APIs), keyed by API key.
 *
 * One listener per key. Subscription APIs have `uri`; message APIs have `hasWaitingUri`.
 * Managed by {@link createWebsocketSubscriptionApi}, {@link createWebsocketMessageApi},
 * and {@link removeWebsocketListenerFromConnection}.
 */
export const websocketListeners = new Store<Map<string, WebsocketListener>>(new Map());


export const websocketConnectionsReconnect = () => {
  websocketConnections.state.forEach((connection) => {
    connection.reconnect();
  });
};