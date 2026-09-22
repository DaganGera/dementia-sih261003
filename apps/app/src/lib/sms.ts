/**
 * Text message for an urgent alert. It opens the phone's messaging app with the words filled in and the person presses send.
 * It never contains health details: only who needs help and to call.
 */
export function smsHref(phone: string, personName: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const body = `${personName || 'Someone'} needs help. Please call as soon as you can.`;
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}

export const isPlausiblePhone = (phone: string) => /^\+?\d[\d\s-]{6,15}$/.test(phone.trim());
