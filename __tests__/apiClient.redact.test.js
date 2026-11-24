jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { redact } from '../src/services/apiClient';

describe('sensitive log redaction', () => {
  it('redacts compound credential and personal-data keys recursively', () => {
    const result = redact({
      accessToken: 'bearer-secret',
      transaction_pin: '1234',
      profile: {
        emailAddress: 'person@example.com',
        phoneNumber: '+2348000000000',
        bvn: '12345678901',
        safeLabel: 'Wallet',
      },
      items: [{ cardNumber: '4111111111111111', amount: 2500 }],
    });

    expect(result).toEqual({
      accessToken: '[redacted]',
      transaction_pin: '[redacted]',
      profile: {
        emailAddress: '[redacted]',
        phoneNumber: '[redacted]',
        bvn: '[redacted]',
        safeLabel: 'Wallet',
      },
      items: [{ cardNumber: '[redacted]', amount: 2500 }],
    });
  });
});
