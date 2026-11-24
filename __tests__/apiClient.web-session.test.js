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

import { clearToken, getSavedToken, saveToken } from '../src/services/apiClient';

describe('browser session-token safety', () => {
  const removeItem = jest.fn();
  const getItem = jest.fn();

  beforeEach(() => {
    removeItem.mockClear();
    getItem.mockClear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem, getItem },
    });
  });

  it('never reads a legacy bearer token from localStorage', async () => {
    await expect(getSavedToken()).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith('userToken');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('fails closed instead of storing a bearer token in browser storage', async () => {
    await expect(saveToken('access-token')).rejects.toThrow(
      'Secure web sign-in is unavailable',
    );
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('clears a legacy browser token on logout', async () => {
    await expect(clearToken()).resolves.toBeUndefined();
    expect(removeItem).toHaveBeenCalledWith('userToken');
  });
});
