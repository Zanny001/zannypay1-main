import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiPost, apiDelete } from '../services/apiClient';

// Master audit, Section 4/9: "There is no push notification system... a
// fraud hold a user doesn't find out about for six hours is a support
// ticket and a trust problem, not a missed feature." This is the client
// half of that fix — the backend half is push/push.service.ts, which
// fans a send out to every token this registers.

// Foreground behavior: still show a banner + play the default sound even
// while the app is open, same as most banking apps (a fraud hold or a
// large incoming transfer is worth interrupting whatever screen the user
// is already on).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedToken = null;

/**
 * Requests permission and registers this device's Expo push token with
 * the backend. Call once after a successful login/signup, and again on
 * cold start if already authenticated — cheap to call repeatedly since
 * the backend's registerToken() is an upsert keyed on the token itself.
 * Never throws: a user should never be blocked from using the app because
 * push permission was denied or a physical/simulator device doesn't
 * support push at all.
 */
export async function registerForPushNotifications() {
  try {
    // Push tokens don't exist on simulators/emulators — Expo's API throws
    // if asked for one there, so skip the entire flow rather than let that
    // throw ever reach a caller.
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D2261',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResponse.data;
    cachedToken = token;

    await apiPost('/push/register', { token, platform: Platform.OS });
    return token;
  } catch (error) {
    // Best-effort by design — see the doc comment above. A push
    // registration failure should never surface to the user or block
    // anything else in the login/signup flow that called this.
    console.log('[Push] Registration skipped:', error?.message);
    return null;
  }
}

/** Call on explicit logout — unregisters this device so a shared/reset device stops receiving another account's pushes. */
export async function unregisterPushNotifications() {
  if (!cachedToken) return;
  try {
    await apiDelete(`/push/unregister/${encodeURIComponent(cachedToken)}`);
  } catch (error) {
    console.log('[Push] Unregister skipped:', error?.message);
  } finally {
    cachedToken = null;
  }
}
