import type { ConsentPurpose } from '@hillpath/contracts';
import type { Replica } from './replica';

export type ConsentMethod = 'self' | 'self_supported' | 'guardian_verified' | 'family_supported_unverified';

/** Purposes that a family-supported but unverified consent may never grant. */
const NEEDS_VERIFIED_OR_SELF: ConsentPurpose[] = ['health_worker', 'clinician_report', 'relay'];

export function grantConsent(r: Replica, id: string, subject: string, purpose: ConsentPurpose, method: ConsentMethod, at: number): { ok: boolean; reason?: string } {
  if (method === 'family_supported_unverified' && NEEDS_VERIFIED_OR_SELF.includes(purpose)) {
    return { ok: false, reason: 'Sharing outside the family needs the person to agree, or a guardian whose appointment has been checked.' };
  }
  r.insert('consent', id, { subject_id: subject, purpose, method, granted_at: at, revoked_at: null });
  return { ok: true };
}

export function revokeConsent(r: Replica, id: string, at: number): void {
  r.set('consent', id, { revoked_at: at });
}

export function hasConsent(r: Replica, subject: string, purpose: ConsentPurpose): boolean {
  return r.list('consent').some((c) => c.subject_id === subject && c.purpose === purpose && !c.revoked_at);
}

export function activeConsents(r: Replica, subject: string) {
  return r.list('consent').filter((c) => c.subject_id === subject && !c.revoked_at);
}
