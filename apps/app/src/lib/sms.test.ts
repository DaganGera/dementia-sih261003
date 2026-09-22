import { describe, expect, it } from 'vitest';
import { isPlausiblePhone, smsHref } from './sms';

describe('urgent text message link', () => {
  it('fills in a short message with the name and no health details', () => {
    const href = smsHref('+91 98765 43210', 'Ama');
    expect(href.startsWith('sms:+919876543210?body=')).toBe(true);
    const body = decodeURIComponent(href.split('body=')[1]!);
    expect(body).toBe('Ama needs help. Please call as soon as you can.');
    expect(body).not.toMatch(/dementia|memory|medicine|diagnos/i);
  });

  it('checks that a number looks like a phone number', () => {
    expect(isPlausiblePhone('+91 98765 43210')).toBe(true);
    expect(isPlausiblePhone('9876543210')).toBe(true);
    expect(isPlausiblePhone('abc')).toBe(false);
    expect(isPlausiblePhone('12')).toBe(false);
  });
});
