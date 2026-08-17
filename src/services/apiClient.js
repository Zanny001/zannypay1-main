import { Platform, Alert, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SyncEngine } from './SyncEngine';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://zannypay-backend-no6a.onrender.com/api/v1';

// ==========================================
// TOKEN MANAGEMENT
// ==========================================
// NOTE ON WEB: the `Platform.OS === 'web'` branch below stores the session
// token in localStorage, which is readable by any script running on the
// page — a real XSS-exfiltration risk, the same class of risk the admin
// dashboard's httpOnly-cookie proxy was specifically built to avoid. That
// fix isn't a simple storage swap here, though: it needs a real backend-
// for-frontend layer (a server-side proxy that holds the token in an
// httpOnly cookie instead of handing it to page JS at all), which is an
// architectural addition, not a one-line change. Left as-is deliberately
// rather than picking a partial fix unilaterally — this needs a product
// decision: either treat the web build as dev-only/non-production, or
// invest in the BFF layer. Flagging clearly rather than silently patching.
export const getSavedToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('userToken');
  return await SecureStore.getItemAsync('userToken');
};

export const saveToken = async (token) => {
  if (!token) return; // Prevent saving empty tokens
  if (Platform.OS === 'web') localStorage.setItem('userToken', token);
  else await SecureStore.setItemAsync('userToken', token);
};

export const clearToken = async () => {
  if (Platform.OS === 'web') localStorage.removeItem('userToken');
  else await SecureStore.deleteItemAsync('userToken');
};

// ==========================================
// LOGGING
// ==========================================
// Request/response logging is dev-only and redacts anything that could be
// a credential or a full financial payload. Previously this logged every
// request/response body unconditionally, in production builds too —
// meaning PINs, passwords, and full account/balance details could end up
// in device logs or crash-reporter breadcrumbs.
const SENSITIVE_KEYS = ['pin', 'password', 'cvv', 'token', 'bvn'];

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = Array.isArray(value) ? [...value] : { ...value };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
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
// `onDialed` is called if the user actually dials the USSD code — used to
// cancel the matching queued retry (see apiWrite below). Without this, a
// user who completes the transaction via USSD *and* later reconnects to
// WiFi would have the app's own sync queue silently replay the same
// transfer/airtime purchase as a second, real transaction.
const triggerUssdFallback = (fallbackConfig, onDialed) => {
  if (!fallbackConfig) return;
  const { type, amount, account } = fallbackConfig;

  let ussdString = '';
  if (type === 'transfer') ussdString = `*999*${amount}*${account}#`;
  else if (type === 'airtime') ussdString = `*999*${amount}#`;
  else return;

  // iOS/Android require the '#' to be URL-encoded as '%23' for dialer links
  const encodedUssd = ussdString.replace('#', '%23');

  Alert.alert(
    'Network Connection Dropped 📡',
    `We couldn't reach the server. Would you like to complete this transaction securely offline via USSD?\n\nCode: ${ussdString}`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
        // The user is NOT completing it via USSD — leave the queued retry
        // in place so it still goes through once connectivity returns.
      },
      {
        text: 'Dial Code',
        onPress: async () => {
          // The user is completing this transaction via USSD right now —
          // cancel the queued app-side retry for the *same* action first,
          // so reconnecting later can't also replay it.
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
// Only endpoints whose backend DTO actually accepts idempotencyKey — the
// API's ValidationPipe rejects unrecognized fields on every other route,
// so this must stay an explicit allowlist, not applied blindly everywhere.
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

  // Guard against the "undefined" or "null" string trap from local storage
  if (savedToken && savedToken !== 'undefined' && savedToken !== 'null') {
    headers.Authorization = `Bearer ${savedToken}`;
  }
  return headers;
};

// NestJS's ValidationPipe often responds with `message` as an ARRAY of
// strings when several fields fail validation at once (e.g. ["amount must
// not be less than 1", "property bank should not exist"]). Joining it into
// a single readable string keeps every Alert.alert()/Text call downstream
// safe, since React Native can't render a raw array as text.
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

    if (!response.ok) {
      throw new Error(extractErrorMessage(data, 'API GET request failed'));
    }
    return data;
  } catch (error) {
    console.error(`[API GET Error] ${endpoint}:`, error.message);
    throw error;
  }
};

export const apiPost = async (endpoint, payload, fallbackConfig = null, isRetry = false) => {
  return apiWrite('POST', endpoint, payload, fallbackConfig, isRetry);
};

export const apiPatch = async (endpoint, payload, fallbackConfig = null, isRetry = false) => {
  return apiWrite('PATCH', endpoint, payload, fallbackConfig, isRetry);
};

export const apiDelete = async (endpoint, fallbackConfig = null, isRetry = false) => {
  return apiWrite('DELETE', endpoint, null, fallbackConfig, isRetry);
};

const apiWrite = async (method, endpoint, payload, fallbackConfig, isRetry) => {
  // Attach an idempotency key exactly once, on the first (non-retry)
  // attempt, for endpoints that support it — and mutate `payload` itself
  // so the SAME key travels with it into the offline-sync queue if this
  // call fails and gets queued for retry below.
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

    if (!response.ok) {
      // Prioritize the exact message sent back from NestJS exceptions
      throw new Error(extractErrorMessage(data, `API ${method} request failed`));
    }
    return data;
  } catch (error) {
    console.error(`[API ${method} Error] ${endpoint}:`, error.message);

    // Intercept genuine network failures (fetch throws TypeError on drops)
    if (error.name === 'TypeError' || error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
      // Queue the real request for retry once connectivity returns, in
      // addition to offering the instant USSD fallback for right now.
      // `queuedId` lets the USSD dial handler cancel this exact queued
      // item if the user completes the transaction that way instead —
      // see triggerUssdFallback's onDialed callback.
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
