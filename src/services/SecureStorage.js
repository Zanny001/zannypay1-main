import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation at all (there's no OS-level
// secure enclave in a browser) — calling it on web throws
// "getValueWithKeyAsync is not a function". Biometric login and other
// secure-storage features simply aren't available on web, so every method
// here short-circuits to a safe no-op/null there instead of throwing.
const isWeb = Platform.OS === 'web';

export const SecureStorage = {
  // Save sensitive data (e.g., JWT tokens, user IDs)
  save: async (key, value) => {
    if (isWeb) return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`[SecureStorage] Save error for ${key}:`, error);
    }
  },

  // Retrieve decrypted data
  get: async (key) => {
    if (isWeb) return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`[SecureStorage] Read error for ${key}:`, error);
      return null;
    }
  },

  // Delete data on logout
  remove: async (key) => {
    if (isWeb) return;
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`[SecureStorage] Delete error for ${key}:`, error);
    }
  },
};
