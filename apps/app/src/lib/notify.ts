import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { occurrences, type ReminderRule } from '@hillpath/core';

const DAYS_AHEAD = 7;
const stableId = (rule: string, at: number) => {
  let h = 0;
  for (const c of `${rule}@${at}`) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2_000_000_000;
};

/**
 * Schedule the next 7 days of reminders as native notifications. On Android 14 and later, exact alarms
 * are off by default for new installs, so the person may need to allow them. On the web there is no
 * native scheduling; reminders show inside the app while it is open.
 */
export async function scheduleNative(rules: ReminderRule[]): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Saved. On the web, reminders appear inside the app while it is open. The Android app also rings when it is closed.';
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'Notifications are switched off for Hillpath. Allow them in Settings so reminders can ring.';
  let exact = true;
  try {
    exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    exact = false;
  }
  const now = Date.now();
  const notifications = rules.flatMap((r) =>
    occurrences(r, now, now + DAYS_AHEAD * 86_400_000).map((at) => ({
      id: stableId(r.id, at),
      title: 'Hillpath',
      body: r.kind === 'medicine' ? `Time for your medicine: ${r.title}` : `Time: ${r.title}`,
      schedule: { at: new Date(at), allowWhileIdle: true },
    })),
  );
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (notifications.length) await LocalNotifications.schedule({ notifications: notifications.slice(0, 60) });
  return exact ? 'Saved. Reminders are scheduled on this phone.' : 'Saved. Reminders may be up to 15 minutes late. Allow exact alarms in Settings so they ring on time.';
}
