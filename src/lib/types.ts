import { WebsocketMessageApi } from './WebsocketMessageApi';
import { WebsocketSubscriptionApi } from './WebsocketSubscriptionApi';

/**
 * WebSocket connection ready states.
 *
 * Values match the WebSocket API readyState constants, with an additional
 * UNINSTANTIATED state for connections that haven't been created yet.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
 */
export enum ReadyState {
  /** Connection has not been instantiated yet */
  UNINSTANTIATED = -1,
  /** Connection is being established */
  CONNECTING = 0,
  /** Connection is open and ready to communicate */
  OPEN = 1,
  /** Connection is in the process of closing */
  CLOSING = 2,
  /** Connection is closed or couldn't be opened */
  CLOSED = 3
}

/**
 * Structure for outgoing WebSocket messages.
 *
 * Messages are sent with a method (HTTP-like), URI for routing, optional body,
 * and an automatically generated correlation ID for tracking.
 *
 * @template TMethod - The type of the HTTP method (e.g., 'subscribe', 'unsubscribe', 'post')
 * @template TUri - The type of the URI string
 * @template TBody - The type of the message body payload
 */
export interface SendMessage<TMethod = string, TUri = string, TBody = unknown> {
  /** HTTP-like method for the message (e.g., 'subscribe', 'unsubscribe', 'post') */
  method?: TMethod;
  /** URI path for routing the message to the correct handler */
  uri?: TUri;
  /** Optional message body/payload */
  body?: TBody;
  /** Correlation ID for tracking messages (automatically generated) */
  correlation?: string;
}

/**
 * Callback function for sending messages from a {@link WebsocketSubscriptionApi} to its parent {@link WebsocketConnection}.
 *
 * This callback is injected by the connection when a URI API is registered,
 * replacing the previous EventTarget/CustomEvent indirection with a direct,
 * type-safe function call.
 */
export type SendToConnectionFn = (message: SendMessage<string, string, unknown>) => void;

/**
 * Structure of incoming WebSocket messages.
 *
 * Messages must have a URI for routing to the correct handler and can include
 * an optional body with the actual message data.
 *
 * @template TBody - The type of the message body payload
 */
export interface IncomingWebsocketMessage<TBody = unknown> {
  /** URI path that identifies which handler should process this message */
  uri: string;
  /** Optional message body/payload */
  body?: TBody;
  /** HTTP-like method for the message (e.g., 'subscribe', 'unsubscribe', 'post') */
  method?: string;
}

/**
 * Error sent by the server via a message with method 'error', 'conflict', or 'exception'.
 * Contains the parsed message body for application-level error handling.
 *
 * @template TBody - The type of the error body payload
 */
export interface WebsocketServerError<TBody = unknown> {
  readonly type: 'server';
  readonly message: IncomingWebsocketMessage<TBody>;
}

/**
 * Error from the WebSocket transport layer (connection failure, network issues, etc.).
 * Contains the raw Event from the WebSocket 'error' handler.
 */
export interface WebsocketTransportError {
  readonly type: 'transport';
  readonly event: Event;
}

/**
 * Configuration options for WebSocket URI APIs.
 *
 * Subscriptions automatically subscribe when the WebSocket connection opens.
 *
 * @template TData - The type of data received from the WebSocket
 * @template TBody - The type of message body sent to the WebSocket
 */
export interface WebsocketSubscriptionOptions<TData = unknown, TBody = unknown> {
  /** The base URL of the WebSocket connection. */
  url: string;
  /** The URI path for this subscription. */
  uri: string;
  /**
   * Unique key for the URI API.
   *
   * Used to identify the URI API in the connection.
   */
  key: string;
  /** Whether this URI API is enabled (default: true). When disabled, messages are not sent. */
  enabled?: boolean;
  /** Optional body payload to send with subscription or initial message */
  body?: TBody;

  /** Optional HTTP method for custom messages sent via sendMessage */
  method?: string;
  /**
   * Callback invoked when subscription is successful.
   *
   * @param uri - The URI path that was subscribed to
   * @param body - The body that was sent with the subscription
   */
  onSubscribe?: (props: { uri: string; body?: TBody; uriApi: WebsocketSubscriptionApi<TData, TBody> }) => void;
  /**
   * Callback invoked when a message is received for this URI.
   *
   * @param data - The message data received from the WebSocket
   * @param uriApi - The URI API instance that received the message
   */
  onMessage?: (props: { data: TData; uriApi: WebsocketSubscriptionApi<TData, TBody> }) => void;
  /**
   * Callback invoked when a WebSocket error occurs.
   *
   * @param error - Discriminated error: use `error.type === 'server'` for server-sent error messages
   *                (parsed body in `error.message`), or `error.type === 'transport'` for connection failures.
   */
  onError?: (error: WebsocketTransportError) => void;

  /**
   * A callback function called when an error occurs with a subscription or message.
   *
   * @param event - The error event object.
   */
  onMessageError?: (error: WebsocketServerError<TBody>) => void;
  /**
   * Callback invoked when the WebSocket connection closes.
   *
   * @param event - The close event from the WebSocket connection
   */
  onClose?: (event: CloseEvent) => void;
}

/**
 * Configuration options for WebSocket Message API.
 *
 * Message API is for request/response style communication: send a message to any URI
 * and optionally wait for a response. No subscription support.
 *
 * @template TData - The type of data received in the response
 * @template TBody - The type of message body sent to the WebSocket
 */
export interface WebsocketMessageOptions {
  /** The base URL of the WebSocket connection. */
  url: string;
  /**
   * Unique key for the Message API.
   *
   * Used to identify the API in the connection.
   */
  key: string;
  /** Whether this Message API is enabled (default: true). When disabled, messages are not sent. */
  enabled?: boolean;
  /**
   * Default timeout in ms when waiting for a response.
   *
   * Can be overridden per sendMessage call.
   */
  responseTimeoutMs?: number;
  /**
   * Callback invoked when a WebSocket transport error occurs.
   */
  onError?: (error: WebsocketTransportError) => void;
  /**
   * Callback invoked when a server error message is received.
   */
  onMessageError?: (error: WebsocketServerError) => void;
  /**
   * Callback invoked when the WebSocket connection closes.
   */
  onClose?: (event: CloseEvent) => void;
}

/**
 * Options for WebsocketMessageApi.sendMessage.
 */
export interface SendMessageOptions {
  /** Timeout in ms when waiting for a response. Overrides the default from options. */
  timeout?: number;
}

/**
 * Common interface for WebSocket listeners registered with {@link WebsocketConnection}.
 *
 * Both {@link WebsocketSubscriptionApi} and {@link WebsocketMessageApi} implement this interface,
 * allowing the connection to treat them uniformly via {@link addListener} / {@link removeListener}.
 *
 * - **Subscription listeners**: Have `uri`, `onOpen`, `onMessage` — route by URI match
 * - **Message listeners**: Have `hasWaitingUri`, `deliverMessage` — route by pending URI
 */
export interface WebsocketListener {
  readonly key: string;
  readonly url: string;
  readonly isEnabled: boolean;
  setSendToConnection(callback: SendToConnectionFn | null): void;
  onError(error: WebsocketTransportError): void;
  onMessageError(error: WebsocketServerError<unknown>): void;
  onClose(event: CloseEvent): void;
  reset(): void;
  /** Subscription listeners: fixed URI for this endpoint */
  readonly uri?: string;
  /** Subscription listeners: called when connection opens */
  onOpen?(): void;
  /** Subscription listeners: called when a message is received for this URI */
  onMessage?(data: unknown): void;
  /** Message listeners: returns true if waiting for a response for the given URI */
  hasWaitingUri?(uri: string): boolean;
  /** Message listeners: delivers a response for a pending request */
  deliverMessage?(uri: string, data: unknown): void;
}

export type WebsocketMessageApiPublic = Pick<
  WebsocketMessageApi,
  'sendMessage' | 'sendMessageNoWait' | 'reset' | 'url' | 'key' | 'isEnabled'
>;

export type WebsocketSubscriptionApiPublic<TData = unknown, TBody = unknown> = Pick<
  WebsocketSubscriptionApi<TData, TBody>,
  'reset' | 'url' | 'key' | 'isEnabled' | 'store'
>;

export interface WebsocketSubscriptionStore<TData = unknown> {
  message: TData | undefined;
  subscribed: boolean;
  /**
   * Whether a subscription has been sent but no response received yet.
   *
   * - `true`: A subscribe message was sent and we are waiting for the first (or next) message.
   * - `false`: No subscription is active, the connection is closed, or we have already received a response.
   *
   * Use this to show loading/placeholder UI while waiting for initial data after subscribing.
   */
  pendingSubscription: boolean;
  subscribedAt: number | undefined;
  receivedAt: number | undefined;
  connected: boolean;
  messageError: WebsocketTransportError | undefined;
  serverError: WebsocketServerError<unknown> | undefined;
}

/** Creates the initial state for a WebsocketSubscriptionStore. */
export function createInitialWebsocketSubscriptionStore<TData = unknown>(): WebsocketSubscriptionStore<TData> {
  return {
    message: undefined,
    subscribed: false,
    pendingSubscription: false,
    subscribedAt: undefined,
    receivedAt: undefined,
    connected: false,
    messageError: undefined,
    serverError: undefined
  };
}
