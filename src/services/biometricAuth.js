import { SecureStorage } from './SecureStorage';

// Biometric "login" unlocks access to an already-issued, revocable session
// token — never the user's actual PIN. The PIN is the same secret that
// authorizes money movement (transfers/bills/airtime all bcrypt.compare it
// server-side); caching it here would mean anything that can read this
// device's secure storage recovers that literal transaction-authorizing
// secret, not just a revocable convenience credential. A cached token has
// exactly the app's existing "stay logged in" exposure — no worse than
// what's already accepted for normal sessions — and expires/can be
// invalidated the same way the customer JWT already does.
const BIOMETRIC_PHONE_KEY = 'zannypay_biometric_phone';
const biometricTokenKey = (phone) => `zannypay_biometric_token_${phone}`;

export const BiometricAuth = {
  async enroll(phone, sessionToken) {
    await SecureStorage.save(BIOMETRIC_PHONE_KEY, phone);
    await SecureStorage.save(biometricTokenKey(phone), sessionToken);
  },

  async getSavedPhone() {
    return SecureStorage.get(BIOMETRIC_PHONE_KEY);
  },

  async getTokenForPhone(phone) {
    if (!phone) return null;
    return SecureStorage.get(biometricTokenKey(phone));
  },

  async isEnabledFor(phone) {
    const token = await this.getTokenForPhone(phone);
    return !!token;
  },

  async clearFor(phone) {
    if (phone) await SecureStorage.remove(biometricTokenKey(phone));
    await SecureStorage.remove(BIOMETRIC_PHONE_KEY);
  },
};
