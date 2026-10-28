/**
 * Browser notification helpers. Notifications are shown through the service worker registration
 * when available (required on Android/installed PWAs), falling back to `new Notification`.
 *
 * Delivery limits, stated honestly: the web platform has no general way to schedule a notification
 * for a future time without a push server. Reminders fire while the app is open or running in a
 * background tab / installed-app window. For reminders when the app is fully closed, use the
 * calendar (.ics) export, which hands the schedule to the phone's calendar app.
 */

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationSupport(): { supported: boolean; permission: PermissionState; serviceWorker: boolean; standalone: boolean; ios: boolean } {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const serviceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return { supported, permission: supported ? Notification.permission : 'unsupported', serviceWorker, standalone, ios };
}

export async function requestPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export type ShowResult = { ok: true; via: 'service-worker' | 'window' } | { ok: false; reason: string };

export async function showSystemNotification(title: string, body: string, tag: string): Promise<ShowResult> {
  if (!('Notification' in window)) return { ok: false, reason: 'This browser does not support notifications.' };
  if (Notification.permission !== 'granted') return { ok: false, reason: Notification.permission === 'denied' ? 'Notifications are blocked for this site in your browser settings.' : 'Notification permission has not been granted yet.' };
  const options: NotificationOptions = { body, tag, icon: './icon-192.png', badge: './favicon-48.png', data: { url: './#/' } };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
      if (reg?.active) {
        await reg.showNotification(title, options);
        return { ok: true, via: 'service-worker' };
      }
    }
    new Notification(title, options);
    return { ok: true, via: 'window' };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'The browser refused to show the notification.' };
  }
}
