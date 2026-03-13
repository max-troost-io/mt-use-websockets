/**
 * @fileoverview Helper functions for WebSocket connection and listener management.
 *
 * These functions implement the singleton patterns for connections (per URL key)
 * and listeners (per API key). Used by the React hooks in WebsocketHook.ts.
 *
 * @module websocketStores.helpers
 */

import { WebsocketListener, WebsocketMessageOptions, WebsocketSubscriptionOptions } from './types';
import { WebsocketConnection } from './WebsocketConnection';
import { WebsocketMessageApi } from './WebsocketMessageApi';
import { WebsocketSubscriptionApi } from './WebsocketSubscriptionApi';
import { websocketConnections, websocketListeners } from './websocketStores';

/**
 * Finds an existing WebSocket connection or creates a new one for the given key.
 *
 * Implements a singleton pattern: only one connection exists per key. The key is
 * typically the base URL path (e.g. `/api`). The connection is created lazily;
 * the actual WebSocket is established when a listener is added via
 * {@link WebsocketConnection#addListener}.
 *
 * @param key - Unique key identifying the connection (e.g. base URL path like `/api`)
 * @param url - Full WebSocket URL (e.g. `wss://region.example.com/api?user=...`)
 * @returns Existing or newly created {@link WebsocketConnection}
 */
export const findOrCreateWebsocketConnection = (key: string, url: string): WebsocketConnection => {
  const existingSocket = getExistingWebsocketConnection(key);

  if (existingSocket) {
    return existingSocket;
  }

  const websocket = new WebsocketConnection(url);
  websocketConnections.setState((prev) => new Map(prev).set(key, websocket));
  return websocket;
};

/**
 * Retrieves an existing WebSocket connection for the given key.
 *
 * @param key - Key identifying the connection (must match key used in {@link findOrCreateWebsocketConnection})
 * @returns The {@link WebsocketConnection} if it exists, or `undefined`
 */
export const getExistingWebsocketConnection = (key: string): WebsocketConnection | undefined => {
  return websocketConnections.state.get(key);
};

/**
 * Retrieves a WebSocket subscription API by its unique key across all connections.
 *
 * Searches the global {@link websocketListeners} store. Use when you need to access
 * a subscription API created elsewhere (e.g. by a parent component) without a
 * direct reference.
 *
 * @template TData - The type of data in the store's `message` field
 * @param key - Unique key (must match key used when creating the subscription)
 * @returns The {@link WebsocketSubscriptionApi} if found, or `undefined`
 *
 * @example
 * ```typescript
 * const voyageApi = getWebsocketUriApiByKey<Voyage[]>('voyages-list');
 * if (voyageApi) {
 *   const data = useStore(voyageApi.store, (s) => s.message);
 *   voyageApi.sendMessage({ method: 'refresh' });
 * }
 * ```
 *
 * @see {@link WebsocketConnection#getUriApiByKey} - Get from a specific connection
 * @see {@link useWebsocketSubscriptionByKey} - React hook for store access
 */
export const getWebsocketUriApiByKey = <TData = unknown>(key: string): WebsocketSubscriptionApi<TData, any> | undefined => {
  const listener = websocketListeners.state.get(key);
  if (listener && 'uri' in listener) {
    return listener as WebsocketSubscriptionApi<TData, any>;
  }
  return undefined;
};

/**
 * Creates a WebSocket subscription API or returns the existing one for the given key.
 *
 * Singleton per key: multiple components with the same key share one instance.
 * The instance is stored in {@link websocketListeners} and must be registered
 * with a connection via {@link WebsocketConnection#addListener}.
 *
 * @template TData - The type of data received from the WebSocket
 * @param key - Unique key for this subscription API
 * @param options - Configuration options
 * @returns Existing or newly created {@link WebsocketSubscriptionApi}
 *
 * @see {@link getWebsocketUriApiByKey} - Check for existing instance
 */
export const createWebsocketSubscriptionApi = <TData = unknown>(
  key: string,
  options: WebsocketSubscriptionOptions<TData, any>
): WebsocketSubscriptionApi<TData, any> => {
  const existingUriApi = getWebsocketUriApiByKey<TData>(key);
  if (existingUriApi) {
    return existingUriApi;
  }
  const uriApi = new WebsocketSubscriptionApi(options);
  websocketListeners.setState((prev) => new Map(prev).set(key, uriApi));
  return uriApi;
};

/**
 * Retrieves a WebSocket Message API by its unique key across all connections.
 *
 * Searches the global {@link websocketListeners} store. Message APIs are identified
 * by the presence of {@link WebsocketListener.hasWaitingUri}.
 *
 * @template TData - The type of data received in the response
 * @template TBody - The type of message body sent
 * @param key - Unique key for the Message API
 * @returns The {@link WebsocketMessageApi} if found, or `undefined`
 */
export const getWebsocketMessageApiByKey = (key: string): WebsocketMessageApi | undefined => {
  const listener = websocketListeners.state.get(key);
  if (listener && 'hasWaitingUri' in listener) {
    return listener as WebsocketMessageApi;
  }
  return undefined;
};

/**
 * Creates a WebSocket Message API or returns the existing one for the given key.
 *
 * Singleton per key: multiple components with the same key share one instance.
 *
 * @template TData - The type of data received in the response
 * @template TBody - The type of message body sent
 * @param key - Unique key for this Message API
 * @param options - Configuration options
 * @returns Existing or newly created {@link WebsocketMessageApi}
 */
export const createWebsocketMessageApi = (key: string, options: WebsocketMessageOptions): WebsocketMessageApi => {
  const existing = getWebsocketMessageApiByKey(key);
  if (existing) {
    return existing;
  }
  const messageApi = new WebsocketMessageApi(options);
  websocketListeners.setState((prev) => new Map(prev).set(key, messageApi));
  return messageApi;
};

/**
 * Removes a WebSocket listener from its connection and from the global store.
 *
 * Calls {@link WebsocketConnection#removeListener} and deletes the listener from
 * {@link websocketListeners}. Call when the last hook unmounts or when the listener
 * is disabled (via `enabled=false`).
 *
 * @param listener - The listener (subscription or message API) to remove
 */
export const removeWebsocketListenerFromConnection = (listener: WebsocketListener): void => {
  const connection = getExistingWebsocketConnection(listener.url);
  connection?.removeListener(listener);
  websocketListeners.setState((prev) => {
    const next = new Map(prev);
    next.delete(listener.key);
    return next;
  });
};
