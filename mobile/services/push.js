/**
 * Native push notification registration.
 *
 * Requests permission, fetches the Expo push token, and hands it to the
 * backend (POST /api/auth/push-token). Called once the user is
 * authenticated. Everything is best-effort: on a simulator, denied
 * permission, or any error we just skip — the app works fine without push
 * (email/SMS/in-app still deliver).
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';

// Foreground behavior: show the banner + play sound even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush() {
  try {
    if (!Device.isDevice) return null; // simulators can't get a token
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp?.data;
    if (token) {
      await api.registerPushToken(token).catch(() => {});
    }
    return token;
  } catch {
    return null;
  }
}
