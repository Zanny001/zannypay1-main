import { Platform } from 'react-native';
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
  'recipientaccount',
  'account',
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
    const isSensitive = SENSITIVE_KEY_PARTS.some((part) =>
      part === 'secret'
        ? normalizedKey.includes(part)
        : normalizedKey === part ||
          normalizedKey.startsWith(part) ||
          normalizedKey.endsWith(part),
    );
    if (isSensitive) {
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

// Never write query-string values to device logs. Account-resolution URLs
// contain full bank account numbers, which are sensitive personal data.
const safeEndpointLabel = (endpoint) => String(endpoint || '').split('?')[0];

// Never execute an unverified USSD transaction fallback.

// ==========================================
// IDEMPOTENCY
// ==========================================
const IDEMPOTENT_ENDPOINTS = ['/wallet/transfer', '/wallet/billpay', '/wallet/airtime', '/wallet/bill-purchase', '/wallet/fund'];
// Financial mutations can contain transaction PINs and must never be persisted
// in the plaintext AsyncStorage retry queue. Customer verification requests
// also contain private biller identifiers and are never queued either.
const NEVER_QUEUE_FINANCIAL_ENDPOINTS = new Set(IDEMPOTENT_ENDPOINTS);
const NEVER_QUEUE_SENSITIVE_ENDPOINTS = new Set(['/wallet/bill-verify']);

export function generateIdempotencyKey() {
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
    devLog(`[API GET] Request: ${safeEndpointLabel(endpoint)}`);
    const response = await fetch(`${API_URL}${endpoint}`, { headers });
    const data = await response.json().catch(() => ({}));
    devLog(`[API GET] Response from ${safeEndpointLabel(endpoint)}:`, redact(data));
    if (!response.ok) throw new Error(extractErrorMessage(data, 'API GET request failed'));
    return data;
  } catch (error) {
    console.error(`[API GET Error] ${safeEndpointLabel(endpoint)}:`, error.message);
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
  // Retain the public call signature for existing screens while ignoring
  // legacy USSD fallback hints; no carrier rail is verified for this app.
  void fallbackConfig;
  if (!isRetry && payload && IDEMPOTENT_ENDPOINTS.includes(endpoint) && !payload.idempotencyKey) {
    payload = { ...payload, idempotencyKey: generateIdempotencyKey() };
  }

  try {
    const headers = await buildHeaders();
    devLog(`[API ${method}] Request: ${safeEndpointLabel(endpoint)}`, redact(payload));
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    devLog(`[API ${method}] Response from ${safeEndpointLabel(endpoint)}:`, redact(data));
    if (!response.ok) throw new Error(extractErrorMessage(data, `API ${method} request failed`));
    return data;
  } catch (error) {
    console.error(`[API ${method} Error] ${safeEndpointLabel(endpoint)}:`, error.message);
    if (
      error.name === 'TypeError' ||
      error.message.includes('Network request failed') ||
      error.message.includes('Failed to fetch')
    ) {
      const canPersistForRetry =
        !isRetry && !NEVER_QUEUE_FINANCIAL_ENDPOINTS.has(endpoint) && !NEVER_QUEUE_SENSITIVE_ENDPOINTS.has(endpoint);
      if (canPersistForRetry) {
        await SyncEngine.enqueue(`${method}_RETRY`, {
          method,
          endpoint,
          payload,
        });
      }
      // A carrier USSD code is not a verified ZannyPay payout/fulfilment rail.
      // Never launch a dialer as a substitute for an unconfirmed API operation.
      const offlineMessage = NEVER_QUEUE_FINANCIAL_ENDPOINTS.has(endpoint)
        ? 'Network offline. This financial transaction was not saved or replayed; reconnect and retry it.'
        : NEVER_QUEUE_SENSITIVE_ENDPOINTS.has(endpoint)
          ? 'Network offline. This account verification request was not saved or replayed; reconnect and try again.'
          : 'Network offline. Please reconnect and try again.';
      throw new Error(offlineMessage);
    }
    throw error;
  }
};
