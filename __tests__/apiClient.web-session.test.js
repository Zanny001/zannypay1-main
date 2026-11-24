jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: { OS: 'web' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { clearToken, getSavedToken, saveToken } from '../src/services/apiClient';

describe('browser session-token safety', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('never reads a legacy bearer token from localStorage', async () => {
    window.localStorage.setItem('userToken', 'legacy-secret');
    await expect(getSavedToken()).resolves.toBeNull();
    expect(window.localStorage.getItem('userToken')).toBeNull();
  });

  it('fails closed instead of storing a bearer token in browser storage', async () => {
    await expect(saveToken('access-token')).rejects.toThrow(
      'Secure web sign-in is unavailable',
    );
    expect(window.localStorage.getItem('userToken')).toBeNull();
  });

  it('clears a legacy browser token on logout', async () => {
    window.localStorage.setItem('userToken', 'legacy-secret');
    await expect(clearToken()).resolves.toBeUndefined();
    expect(window.localStorage.getItem('userToken')).toBeNull();
  });
});
