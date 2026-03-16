import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  reconnectWaitTime,
  getPingTime,
  isValidIncomingMessage,
  isBrowserOnline,
  isReconnectableCloseCode,
  isSocketOnline,
  showMaxRetriesExceededNotification,
  showReconnectionDelayNotification,
  showReconnectingNotification,
  createPingMessage,
  isConnectionReady
} from './WebsocketConnection.helpers';
import { RECONNECTION_CONFIG, WEBSOCKET_CLOSE_CODES } from './constants';
import { IncomingWebsocketMessage } from './types';
import { enqueueSnackbar } from 'notistack';
import { v4 as uuidv4 } from 'uuid';

// Mock notistack
vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
  closeSnackbar: vi.fn()
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}));

describe('WebsocketConnection.helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reconnectWaitTime', () => {
    it('should return first phase delay for attempts 0-4', () => {
      expect(reconnectWaitTime(0)).toBe(RECONNECTION_CONFIG.DELAYS.FIRST_PHASE);
      expect(reconnectWaitTime(1)).toBe(RECONNECTION_CONFIG.DELAYS.FIRST_PHASE);
      expect(reconnectWaitTime(2)).toBe(RECONNECTION_CONFIG.DELAYS.FIRST_PHASE);
      expect(reconnectWaitTime(3)).toBe(RECONNECTION_CONFIG.DELAYS.FIRST_PHASE);
      expect(reconnectWaitTime(4)).toBe(RECONNECTION_CONFIG.DELAYS.FIRST_PHASE);
    });

    it('should return second phase delay for attempts 5-9', () => {
      expect(reconnectWaitTime(5)).toBe(RECONNECTION_CONFIG.DELAYS.SECOND_PHASE);
      expect(reconnectWaitTime(6)).toBe(RECONNECTION_CONFIG.DELAYS.SECOND_PHASE);
      expect(reconnectWaitTime(7)).toBe(RECONNECTION_CONFIG.DELAYS.SECOND_PHASE);
      expect(reconnectWaitTime(8)).toBe(RECONNECTION_CONFIG.DELAYS.SECOND_PHASE);
      expect(reconnectWaitTime(9)).toBe(RECONNECTION_CONFIG.DELAYS.SECOND_PHASE);
    });

    it('should return third phase delay for attempts 10+', () => {
      expect(reconnectWaitTime(10)).toBe(RECONNECTION_CONFIG.DELAYS.THIRD_PHASE);
      expect(reconnectWaitTime(15)).toBe(RECONNECTION_CONFIG.DELAYS.THIRD_PHASE);
      expect(reconnectWaitTime(20)).toBe(RECONNECTION_CONFIG.DELAYS.THIRD_PHASE);
      expect(reconnectWaitTime(100)).toBe(RECONNECTION_CONFIG.DELAYS.THIRD_PHASE);
    });
  });

  describe('getPingTime', () => {
    it('should return 40 seconds in milliseconds', () => {
      expect(getPingTime()).toBe(40 * 1000);
    });
  });

  describe('isValidIncomingMessage', () => {
    it('should return true for valid IncomingWebsocketMessage with uri', () => {
      const validMessage: IncomingWebsocketMessage = {
        uri: '/api/test'
      };
      expect(isValidIncomingMessage(validMessage)).toBe(true);
    });

    it('should return true for valid IncomingWebsocketMessage with uri and body', () => {
      const validMessage: IncomingWebsocketMessage = {
        uri: '/api/test',
        body: { data: 'test' }
      };
      expect(isValidIncomingMessage(validMessage)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidIncomingMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidIncomingMessage(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isValidIncomingMessage('string')).toBe(false);
      expect(isValidIncomingMessage(123)).toBe(false);
      expect(isValidIncomingMessage(true)).toBe(false);
      expect(isValidIncomingMessage([])).toBe(false);
    });

    it('should return false for object without uri property', () => {
      expect(isValidIncomingMessage({})).toBe(false);
      expect(isValidIncomingMessage({ body: 'test' })).toBe(false);
      expect(isValidIncomingMessage({ other: 'property' })).toBe(false);
    });

    it('should return false for object with non-string uri', () => {
      expect(isValidIncomingMessage({ uri: 123 })).toBe(false);
      expect(isValidIncomingMessage({ uri: null })).toBe(false);
      expect(isValidIncomingMessage({ uri: undefined })).toBe(false);
      expect(isValidIncomingMessage({ uri: {} })).toBe(false);
    });
  });

  describe('isBrowserOnline', () => {
    const originalWindow = global.window;

    beforeEach(() => {
      // Reset window
      delete (global as { window?: unknown }).window;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should return false when window is undefined', () => {
      expect(isBrowserOnline()).toBe(false);
    });

    it('should return true when window exists and navigator.onLine is true', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: true
          }
        },
        writable: true,
        configurable: true
      });
      expect(isBrowserOnline()).toBe(true);
    });

    it('should return false when window exists but navigator.onLine is false', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: false
          }
        },
        writable: true,
        configurable: true
      });
      expect(isBrowserOnline()).toBe(false);
    });
  });

  describe('isSocketOnline', () => {
    const originalWindow = global.window;

    beforeEach(() => {
      // Reset window
      delete (global as { window?: unknown }).window;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should return false when window is undefined', () => {
      const mockSocket = { readyState: WebSocket.OPEN } as WebSocket;
      expect(isSocketOnline(mockSocket)).toBe(false);
    });

    it('should return false when socket is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: true
          }
        },
        writable: true,
        configurable: true
      });
      expect(isSocketOnline(undefined)).toBe(false);
    });

    it('should return false when browser is offline', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: false
          }
        },
        writable: true,
        configurable: true
      });
      const mockSocket = { readyState: WebSocket.OPEN } as WebSocket;
      expect(isSocketOnline(mockSocket)).toBe(false);
    });

    it('should return false when socket is not in OPEN state', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: true
          }
        },
        writable: true,
        configurable: true
      });
      const mockSocketConnecting = { readyState: WebSocket.CONNECTING } as WebSocket;
      const mockSocketClosing = { readyState: WebSocket.CLOSING } as WebSocket;
      const mockSocketClosed = { readyState: WebSocket.CLOSED } as WebSocket;

      expect(isSocketOnline(mockSocketConnecting)).toBe(false);
      expect(isSocketOnline(mockSocketClosing)).toBe(false);
      expect(isSocketOnline(mockSocketClosed)).toBe(false);
    });

    it('should return true when browser is online and socket is OPEN', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            onLine: true
          }
        },
        writable: true,
        configurable: true
      });
      const mockSocket = { readyState: WebSocket.OPEN } as WebSocket;
      expect(isSocketOnline(mockSocket)).toBe(true);
    });
  });

  describe('showReconnectionDelayNotification', () => {
    it('should not show notification when reconnectTries is below threshold', () => {
      showReconnectionDelayNotification('test-connection', RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD, 5000);
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it('should not show notification when reconnectTries equals threshold', () => {
      showReconnectionDelayNotification('test-connection', RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD, 5000);
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it('should show notification when reconnectTries exceeds threshold', () => {
      const name = 'test-connection';
      const reconnectTries = RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD + 1;
      const waitTime = 5000;

      showReconnectionDelayNotification(name, reconnectTries, waitTime);

      expect(enqueueSnackbar).toHaveBeenCalledWith(`trying to reconnect to ${name} in ${waitTime / 1000} seconds.`, {
        key: `${name}-offline`,
        variant: 'error',
        preventDuplicate: true
      });
    });

    it('should format wait time correctly in seconds', () => {
      const name = 'test-connection';
      const reconnectTries = RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD + 1;

      showReconnectionDelayNotification(name, reconnectTries, 4000);
      expect(enqueueSnackbar).toHaveBeenCalledWith(`trying to reconnect to ${name} in 4 seconds.`, expect.any(Object));

      vi.clearAllMocks();

      showReconnectionDelayNotification(name, reconnectTries, 30000);
      expect(enqueueSnackbar).toHaveBeenCalledWith(`trying to reconnect to ${name} in 30 seconds.`, expect.any(Object));
    });
  });

  describe('showMaxRetriesExceededNotification', () => {
    it('should show error notification with retry action', () => {
      const name = 'test-connection';
      const onRetry = vi.fn();

      showMaxRetriesExceededNotification(name, onRetry);

      expect(enqueueSnackbar).toHaveBeenCalledWith(`Connection to ${name} failed after maximum retries.`, {
        key: `${name}-max-retries`,
        variant: 'error',
        preventDuplicate: true,
        action: expect.any(Function)
      });
    });

    it('should invoke onRetry when action button onClick is triggered', () => {
      const name = 'test-connection';
      const onRetry = vi.fn();

      showMaxRetriesExceededNotification(name, onRetry);

      const call = (enqueueSnackbar as ReturnType<typeof vi.fn>).mock.calls[0];
      const actionFn = call[1].action;
      const snackbarKey = 'test-key';

      const buttonElement = actionFn(snackbarKey);
      buttonElement.props.onClick();

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('showReconnectingNotification', () => {
    it('should not show notification when reconnectTries is below threshold', () => {
      showReconnectingNotification('test-connection', RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD);
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it('should not show notification when reconnectTries equals threshold', () => {
      showReconnectingNotification('test-connection', RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD);
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it('should show notification when reconnectTries exceeds threshold', () => {
      const name = 'test-connection';
      const reconnectTries = RECONNECTION_CONFIG.NOTIFICATION_THRESHOLD + 1;

      showReconnectingNotification(name, reconnectTries);

      expect(enqueueSnackbar).toHaveBeenCalledWith(`trying to reconnect to ${name}...`, {
        key: `${name}-reconnecting`,
        variant: 'info',
        preventDuplicate: true
      });
    });
  });

  describe('createPingMessage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create a valid ping message with correct structure', () => {
      const message = createPingMessage();
      const parsed = JSON.parse(message);

      expect(parsed).toMatchObject({
        method: 'post',
        uri: 'ping',
        body: expect.any(Number),
        correlation: 'mock-uuid-1234'
      });
    });

    it('should include current timestamp in body', () => {
      const now = Date.now();
      const message = createPingMessage();
      const parsed = JSON.parse(message);

      expect(parsed.body).toBe(now);
    });

    it('should generate a correlation ID using uuid', () => {
      const message = createPingMessage();
      const parsed = JSON.parse(message);

      expect(parsed.correlation).toBe('mock-uuid-1234');
      expect(uuidv4).toHaveBeenCalled();
    });

    it('should return a valid JSON string', () => {
      const message = createPingMessage();
      expect(() => JSON.parse(message)).not.toThrow();
    });
  });

  describe('isConnectionReady', () => {
    it('should return false when socket is undefined', () => {
      expect(isConnectionReady(undefined)).toBe(false);
    });

    it('should return true when socket is in OPEN state', () => {
      const mockSocket = { readyState: WebSocket.OPEN } as WebSocket;
      expect(isConnectionReady(mockSocket)).toBe(true);
    });

    it('should return true when socket is in CONNECTING state', () => {
      const mockSocket = { readyState: WebSocket.CONNECTING } as WebSocket;
      expect(isConnectionReady(mockSocket)).toBe(true);
    });

    it('should return false when socket is in CLOSING state', () => {
      const mockSocket = { readyState: WebSocket.CLOSING } as WebSocket;
      expect(isConnectionReady(mockSocket)).toBe(false);
    });

    it('should return false when socket is in CLOSED state', () => {
      const mockSocket = { readyState: WebSocket.CLOSED } as WebSocket;
      expect(isConnectionReady(mockSocket)).toBe(false);
    });
  });

  describe('isReconnectableCloseCode', () => {
    it('should return false for Normal Closure (1000)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.NORMAL_CLOSURE)).toBe(false);
    });

    it('should return true for Going Away (1001)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.GOING_AWAY)).toBe(true);
    });

    it('should return true for Internal Error (1011)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.INTERNAL_ERROR)).toBe(true);
    });

    it('should return true for Service Restart (1012)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.SERVICE_RESTART)).toBe(true);
    });

    it('should return true for Try Again Later (1013)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.TRY_AGAIN_LATER)).toBe(true);
    });

    it('should return true for Abnormal Closure (1006)', () => {
      expect(isReconnectableCloseCode(WEBSOCKET_CLOSE_CODES.ABNORMAL_CLOSURE)).toBe(true);
    });

    it('should return true for any code other than 1000', () => {
      expect(isReconnectableCloseCode(1002)).toBe(true);
      expect(isReconnectableCloseCode(1014)).toBe(true);
    });
  });
});
