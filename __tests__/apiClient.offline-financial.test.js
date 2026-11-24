jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../src/services/SyncEngine', () => ({
  SyncEngine: {
    enqueue: jest.fn().mockResolvedValue('queued-1'),
    cancel: jest.fn(),
  },
}));

import { apiPost } from '../src/services/apiClient';
import { SyncEngine } from '../src/services/SyncEngine';

describe('offline financial mutation safety', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it.each(['/wallet/transfer', '/wallet/billpay', '/wallet/airtime'])(
    'does not persist credentials or replay a failed financial mutation (%s)',
    async (endpoint) => {
      await expect(
        apiPost(endpoint, { amount: 500, pin: '1234', idempotencyKey: 'stable-key' }),
      ).rejects.toThrow('This financial transaction was not saved or replayed');
      expect(SyncEngine.enqueue).not.toHaveBeenCalled();
    },
  );
});
