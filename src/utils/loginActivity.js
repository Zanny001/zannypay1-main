import { Platform } from 'react-native';
import { loadJSON, saveJSON } from './storage';

const LOGIN_ACTIVITY_KEY = 'zannypay:loginActivity';
const MAX_ENTRIES = 15;

// NOTE: this is a purely on-device log — the backend has no session/login
// -event model yet, so this can only reflect logins that happened on this
// specific device/install, not a true cross-device security timeline.
export async function logLoginActivity() {
  const existing = await loadJSON(LOGIN_ACTIVITY_KEY, []);
  const entry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    device: `${Platform.OS === 'ios' ? 'iPhone' : 'Android device'} · ${Platform.OS}`,
  };
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  await saveJSON(LOGIN_ACTIVITY_KEY, updated);
  return updated;
}

export async function getLoginActivity() {
  return loadJSON(LOGIN_ACTIVITY_KEY, []);
}
