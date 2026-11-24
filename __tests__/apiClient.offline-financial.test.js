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

  it.each(['/wallet/transfer', '/wallet/billpay', '/wallet/airtime', '/wallet/bill-purchase'])(
    'does not persist credentials or replay a failed financial mutation (%s)',
    async (endpoint) => {
      await expect(
        apiPost(endpoint, { amount: 500, pin: '1234', idempotencyKey: 'stable-key' }),
      ).rejects.toThrow('This financial transaction was not saved or replayed');
      expect(SyncEngine.enqueue).not.toHaveBeenCalled();
    },
  );
});


describe('sensitive biller verification offline safety', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  });
  afterAll(() => { global.fetch = originalFetch; });

  it('does not persist a biller account identifier for offline verification', async () => {
    await expect(apiPost('/wallet/bill-verify', { serviceID: 'ikeja-electric', billersCode: '1234567890' }))
      .rejects.toThrow('account verification request was not saved or replayed');
    expect(SyncEngine.enqueue).not.toHaveBeenCalled();
  });
});
