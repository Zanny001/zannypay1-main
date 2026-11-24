import { Platform, Alert, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SyncEngine } from './SyncEngine';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://zannypay-backend.onrender.com/api/v1';

// Browser storage is not an acceptable place for a bearer session token:
// any script executing in the origin can read localStorage. Web sign-in
// must be served through a backend-for-frontend that issues an httpOnly,
// Secure, SameSite cookie. Until that BFF exists, fail closed on web.
const WEB_SESSION_ERROR =
  'Secure web sign-in is unavailable until the ZannyPay web session proxy is configured.';

export const getSavedToken = async () => {
  if (Platform.OS === 'web') {
    // Remove tokens left by older builds; never read them into application JS.
    try {
      globalThis.localStorage?.removeItem('userToken');
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
    return null;
  }
  return await SecureStore.getItemAsync('userToken');
};

export const saveToken = async (token) => {
  if (!token) return;
  if (Platform.OS === 'web') throw new Error(WEB_SESSION_ERROR);
  await SecureStore.setItemAsync('userToken', token);
};

export const clearToken = async () => {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem('userToken');
    } catch {
      // Logout must remain safe if browser storage is unavailable.
    }
    return;
  }
  await SecureStore.deleteItemAsync('userToken');
};

// ==========================================
// LOGGING
// ==========================================
const SENSITIVE_KEY_PARTS = [
  'pin',
  'password',
  'passcode',
  'cvv',
  'token',
  'secret',
  'authorization',
  'cookie',
  'bvn',
  'nin',
  'otp',
  'accountnumber',
  'cardnumber',
  'phone',
  'email',
  'apikey',
];

export function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = Array.isArray(value) ? [...value] : { ...value };
  for (const key of Object.keys(clone)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
      clone[key] = '[redacted]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = redact(clone[key]);
    }
  }
  return clone;
}

function devLog(...args) {
  if (__DEV__) console.log(...args);
}

// ==========================================
// USSD FALLBACK SYSTEM
// ==========================================
const triggerUssdFallback = (fallbackConfig, onDialed) => {
  if (!fallbackConfig) return;
  const { type, amount, account } = fallbackConfig;

  let ussdString = '';
  if (type === 'transfer') ussdString = `*999*${amount}*${account}#`;
  else if (type === 'airtime') ussdString = `*999*${amount}#`;
  else return;

  const encodedUssd = ussdString.replace('#', '%23');

  Alert.alert(
    'Network Connection Dropped 📡',
    `We couldn't reach the server. Would you like to complete this transaction securely offline via USSD?\n\nCode: ${ussdString}`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dial Code',
        onPress: async () => {
          if (onDialed) await onDialed();
          Linking.openURL(`tel:${encodedUssd}`);
        },
      },
    ]
  );
};

// ==========================================
// IDEMPOTENCY
// ==========================================
const IDEMPOTENT_ENDPOINTS = ['/wallet/transfer', '/wallet/billpay', '/wallet/airtime'];

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ==========================================
// API FETCH HELPERS
// ==========================================
const buildHeaders = async () => {
  const headers = { 'Content-Type': 'application/json' };
  const savedToken = await getSavedToken();
  if (savedToken && savedToken !== 'undefined' && savedToken !== 'null') {
    headers.Authorization = `Bearer ${savedToken}`;
  }
  return headers;
};

const extractErrorMessage = (data, fallback) => {
  const raw = data?.message || data?.error || fallback;
  if (Array.isArray(raw)) return raw.join(' ');
  return raw || fallback;
};

export const apiGet = async (endpoint) => {
  try {
    const headers = await buildHeaders();
    devLog(`[API GET] Request: ${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, { headers });
    const data = await response.json().catch(() => ({}));
    devLog(`[API GET] Response from ${endpoint}:`, redact(data));
    if (!response.ok) throw new Error(extractErrorMessage(data, 'API GET request failed'));
    return data;
  } catch (error) {
    console.error(`[API GET Error] ${endpoint}:`, error.message);
    throw error;
  }
};

export const apiPost = async (endpoint, payload, fallbackConfig = null, isRetry = false) =>
  apiWrite('POST', endpoint, payload, fallbackConfig, isRetry);

export const apiPatch = async (endpoint, payload, fallbackConfig = null, isRetry = false) =>
  apiWrite('PATCH', endpoint, payload, fallbackConfig, isRetry);

export const apiDelete = async (endpoint, fallbackConfig = null, isRetry = false) =>
  apiWrite('DELETE', endpoint, null, fallbackConfig, isRetry);

const apiWrite = async (method, endpoint, payload, fallbackConfig, isRetry) => {
  if (!isRetry && payload && IDEMPOTENT_ENDPOINTS.includes(endpoint) && !payload.idempotencyKey) {
    payload = { ...payload, idempotencyKey: generateIdempotencyKey() };
  }

  try {
    const headers = await buildHeaders();
    devLog(`[API ${method}] Request: ${endpoint}`, redact(payload));
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    devLog(`[API ${method}] Response from ${endpoint}:`, redact(data));
    if (!response.ok) throw new Error(extractErrorMessage(data, `API ${method} request failed`));
    return data;
  } catch (error) {
    console.error(`[API ${method} Error] ${endpoint}:`, error.message);
    if (
      error.name === 'TypeError' ||
      error.message.includes('Network request failed') ||
      error.message.includes('Failed to fetch')
    ) {
      let queuedId = null;
      if (!isRetry) queuedId = await SyncEngine.enqueue(`${method}_RETRY`, { method, endpoint, payload });
      if (fallbackConfig) {
        triggerUssdFallback(fallbackConfig, queuedId ? () => SyncEngine.cancel(queuedId) : null);
      }
      throw new Error('Network offline. Attempting USSD fallback.');
    }
    throw error;
  }
};
