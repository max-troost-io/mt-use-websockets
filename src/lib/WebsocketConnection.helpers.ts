/**
 * @fileoverview Pure helper functions for WebSocket connection management.
 *
 * These utilities support {@link WebsocketConnection} with reconnection timing,
 * message validation, heartbeat, and user notifications. All functions are
 * stateless and side-effect free except the notification helpers.
 *
 * @module WebsocketConnection.helpers
 */

import { closeSnackbar, enqueueSnackbar } from 'notistack';
import { createElement } from 'react';
import { RECONNECTION_CONFIG, WEBSOCKET_CLOSE_CODES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { IncomingWebsocketMessage } from './types';

/**
 * Calculates the wait time before attempting to reconnect based on the number of failed attempts.
 *
 * Uses a three-phase exponential backoff strategy to avoid hammering a failing server:
 * - **First phase** (attempts 0–4): 4 seconds — quick recovery for transient issues
 * - **Second phase** (attempts 5–9): 30 seconds — moderate backoff for persistent issues
 * - **Third phase** (attempts 10+): 90 seconds — long backoff to reduce load on dead endpoints
 *
 * @param tries - The number of reconnection attempts made so far
 * @returns Wait time in milliseconds before next reconnection attempt
 *
 * @see {@link RECONNECTION_CONFIG} - Phase thresholds and delay values
 * @internal
 */
export const reconnectWaitTime = (tries: number) => {
  if (tries < RECONNECTION_CONFIG.PHASE_THRESHOLDS.FIRST) {
    return RECONNECTION_CONFIG.DELAYS.FIRST_PHASE;
  }
  if (tries < RECONNECTION_CONFIG.PHASE_THRESHOLDS.SECOND) {
    return RECONNECTION_CONFIG.DELAYS.SECOND_PHASE;
  }
  return RECONNECTION_CONFIG.DELAYS.THIRD_PHASE;
};

/**
 * Gets the ping interval time in milliseconds for keeping WebSocket connections alive.
 *
 * The heartbeat sends a ping every 40 seconds. If no pong arrives within
 * {@link HEARTBEAT_CONFIG.PONG_TIMEOUT_MS}, the connection is force-closed to trigger reconnection.
 *
 * @returns The ping interval in milliseconds (40 seconds)
 *
 * @see {@link HEARTBEAT_CONFIG.PONG_TIMEOUT_MS} - Time to wait for pong before considering connection dead
 * @internal
 */
export const getPingTime = (): number => 40 * 1000;

/**
 * Type guard to validate that a parsed value is a valid incoming WebSocket message.
 *
 * Valid messages must be an object with a string `uri` property. Messages without
 * a valid structure are rejected and trigger {@link WebsocketListener.onError} with
 * type `'transport'`.
 *
 * @param value - The value to check (typically from `JSON.parse`)
 * @returns `true` if the value is a valid {@link IncomingWebsocketMessage}
 *
 * @internal
 */
export const isValidIncomingMessage = (value: unknown): value is IncomingWebsocketMessage => {
  return typeof value === 'object' && value !== null && 'uri' in value && typeof (value as Record<string, unknown>).uri === 'string';
};

/**
 * Checks if the method indicates a server-side error message.
 *
 * Server errors use methods `'error'`, `'conflict'`, or `'exception'`. These are
 * routed to {@link WebsocketListener.onMessageError} instead of `onMessage`.
 *
 * @param method - The message method to check (optional)
 * @returns `true` if the method is an error method; `false` if undefined or not an error
 *
 * @internal
 */
export const isErrorMethod = (method?: string): boolean => {
  if (!method) return false;
  const errorMethods = ['error', 'conflict', 'exception'];
  return errorMethods.includes(method);
};

/**
 * Checks if the browser reports an online network state.
 *
 * Uses `window.navigator.onLine`. Note: this can be unreliable — it may report
 * `true` when the user is on a network but has no internet (e.g. captive portal).
 *
 * @returns `true` if the browser is online; `false` in SSR or when offline
 *
 * @internal
 */
export const isBrowserOnline = (): boolean => {
  return typeof window !== 'undefined' && window.navigator.onLine;
};

/**
 * Checks if the WebSocket is ready to send and receive messages.
 *
 * Requires both browser online state and socket in {@link WebSocket.OPEN} state.
 * Use this before sending messages (e.g. heartbeat ping).
 *
 * @param socket - The WebSocket instance to check
 * @returns `true` if browser is online and socket is OPEN
 *
 * @see {@link isConnectionReady} - Less strict: also allows CONNECTING
 * @internal
 */
export const isSocketOnline = (socket?: WebSocket): boolean => {
  return typeof window !== 'undefined' && window.navigator.onLine && socket !== undefined && socket.readyState === WebSocket.OPEN;
};

/**
 * Shows a notification that reconnection will be attempted after a delay.
 *
 * Only shown when `reconnectTries > NOTIFICATION_THRESHOLD` to avoid
 * spamming users during brief network interruptions.
 *
 * @param name - Display name for the connection (e.g. pathname from URL)
 * @param reconnectTries - Number of reconnection attempts so far
 * @param waitTime - Wait time in ms before the next attempt
 *
 * @see {@link RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD}
 * @internal
 */
export const showReconnectionDelayNotification = (name: string, reconnectTries: number, waitTime: number): void => {
  if (reconnectTries > RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD) {
    enqueueSnackbar(`trying to reconnect to ${name} in ${waitTime / 1000} seconds.`, {
      key: `${name}-offline`,
      variant: 'error',
      preventDuplicate: true
    });
  }
};

/**
 * Shows a permanent error notification when max retry attempts are exceeded.
 *
 * Includes a "Retry" button that calls {@link WebsocketConnection.resetRetriesAndReconnect}.
 * Uses a stable snackbar key to prevent duplicate notifications.
 *
 * @param name - Display name for the connection
 * @param onRetry - Callback invoked when the user clicks Retry (resets retries and reconnects)
 *
 * @see {@link RECONNECTION_CONFIG.MAX_RETRY_ATTEMPTS}
 * @internal
 */
export const showMaxRetriesExceededNotification = (name: string, onRetry: () => void): void => {
  const key = `${name}-max-retries`;
  enqueueSnackbar(`Connection to ${name} failed after maximum retries.`, {
    key,
    variant: 'error',
    preventDuplicate: true,
    action: (snackbarKey) =>
      createElement(
        'button',
        {
          onClick: () => {
            onRetry();
            closeSnackbar(snackbarKey);
          },
          style: {
            marginLeft: 8,
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: 4,
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }
        },
        'Retry'
      )
  });
};

/**
 * Shows a notification that reconnection is in progress.
 *
 * Only shown when `reconnectTries > NOTIFICATION_THRESHOLD`.
 *
 * @param name - Display name for the connection
 * @param reconnectTries - Number of reconnection attempts so far
 *
 * @internal
 */
export const showReconnectingNotification = (name: string, reconnectTries: number): void => {
  if (reconnectTries > RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD) {
    enqueueSnackbar(`trying to reconnect to ${name}...`, {
      key: `${name}-reconnecting`,
      variant: 'info',
      preventDuplicate: true
    });
  }
};

/**
 * Creates a ping message for the WebSocket heartbeat mechanism.
 *
 * Format: `{ method: 'post', uri: 'ping', body: timestamp, correlation: uuid }`.
 * The server should respond with a pong; missing pong triggers reconnection.
 *
 * @returns JSON string of the ping message
 *
 * @internal
 */
export const createPingMessage = (): string => {
  return JSON.stringify({
    method: 'post',
    uri: 'ping',
    body: Date.now(),
    correlation: uuidv4()
  });
};

/**
 * Checks if the WebSocket connection is in a valid state (open or connecting).
 *
 * Used to avoid creating duplicate connections. Unlike {@link isSocketOnline},
 * this returns `true` for CONNECTING state — useful when deciding whether to
 * call `connect()`.
 *
 * @param socket - The WebSocket instance to check
 * @returns `true` if socket is OPEN or CONNECTING; `false` if undefined, CLOSING, or CLOSED
 *
 * @see {@link isSocketOnline} - Stricter: requires OPEN and browser online
 * @internal
 */
export const isConnectionReady = (socket?: WebSocket): boolean => {
  return socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING;
};

/**
 * Determines whether a WebSocket close event warrants an automatic reconnection attempt.
 *
 * **Only code 1000 (Normal Closure) does NOT trigger reconnection** — it indicates a
 * clean, intentional shutdown. All other codes trigger reconnection when listeners
 * are still registered, including:
 * - 1001 Going Away, 1011 Internal Error, 1012 Service Restart, 1013 Try Again Later
 * - 1006 Abnormal Closure (no close frame received — network/server crash)
 *
 * @param closeCode - The close event code from the WebSocket CloseEvent
 * @returns `true` if reconnection should be attempted; `false` for 1000 only
 *
 * @see {@link WEBSOCKET_CLOSE_CODES} - Close code constants
 */
export const isReconnectableCloseCode = (closeCode: number): boolean => {
  return closeCode !== WEBSOCKET_CLOSE_CODES.NORMAL_CLOSURE;
};
