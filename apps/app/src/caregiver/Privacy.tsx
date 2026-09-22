import type { ConsentPurpose } from '@hillpath/contracts';
import { appendAudit, grantConsent, hasConsent, revokeConsent, verifyChain, type AuditEvent, type ConsentMethod } from '@hillpath/core';
import { useState } from 'react';
import type { AppCore } from '../lib/core';
import { getSettings } from '../lib/care';
import { requestPinReset } from '../lib/pin';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from '../ui/kit';

const PURPOSES: Array<[ConsentPurpose, string, string]> = [
  ['family', 'Family circle', 'Devices in your family circle can see activity, reminders and results.'],
  ['health_worker', 'Community health worker', 'A health worker you name can see a summary during visits.'],
  ['clinician_report', 'Doctor report', 'A one-page summary is made for a doctor you choose. You approve each report.'],
  ['relay', 'Encrypted backup server', 'Encrypted records may be stored on a server that cannot read them.'],
];
const METHODS: Array<[ConsentMethod, string]> = [
  ['self', 'The person agreed themselves'],
  ['self_supported', 'The person agreed with help from a supporter'],
  ['guardian_verified', 'A lawful guardian agreed, and their appointment was checked'],
  ['family_supported_unverified', 'Family agreed on their behalf, guardian not checked'],
];

export function auditChain(core: AppCore): AuditEvent[] {
  return core.replica
    .list('audit')
    .map((r) => r as unknown as AuditEvent)
    .sort((a, b) => a.seq - b.seq);
}

export function logAudit(core: AppCore, action: string, target: string): void {
  const chain = appendAudit(auditChain(core), core.deviceId, action, target, Date.now());
  const e = chain[chain.length - 1]!;
  core.replica.insert('audit', `${String(e.seq).padStart(8, '0')}-${core.deviceId}`, { ...e });
}

export function PrivacyPanel({ core }: { core: AppCore }) {
  useVersion();
  const subject = getSettings(core)?.patient_id ?? 'patient';
  const [method, setMethod] = useState<ConsentMethod>('self_supported');
  const [msg, setMsg] = useState<string | null>(null);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const chain = auditChain(core);
  const broken = verifyChain(chain);

  const toggle = (p: ConsentPurpose) => {
    setMsg(null);
    const active = core.replica.list('consent').find((c) => c.subject_id === subject && c.purpose === p && !c.revoked_at);
    if (active) {
      revokeConsent(core.replica, active.id, Date.now());
      logAudit(core, 'consent_revoked', p);
    } else {
      const r = grantConsent(core.replica, `c-${p}-${Date.now().toString(36)}`, subject, p, method, Date.now());
      if (!r.ok) setMsg(r.reason ?? 'That choice is not allowed.');
      else logAudit(core, 'consent_granted', `${p}:${method}`);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Privacy and sharing">
      <h2 className="text-2xl font-bold">Who can see what</h2>
      <p>Records stay on the devices in your family circle. You choose anything beyond that, and can change it at any time.</p>
      <label>How was agreement given?
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value as ConsentMethod)}>
          {METHODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
      </label>
      {msg && <StateNote kind="error" title="Not allowed with that choice." body={msg} />}
      <ul className="flex flex-col gap-2">
        {PURPOSES.map(([p, title, body]) => {
          const on = hasConsent(core.replica, subject, p);
          return (
            <li key={p} className="card flex items-center justify-between gap-3">
              <span><strong>{title}</strong><br />{body}</span>
              <BigButton aria-pressed={on} primary={on} onClick={() => toggle(p)} className="text-lg">{on ? 'On' : 'Off'}</BigButton>
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="h-pin" className="card flex flex-col gap-2">
        <h3 id="h-pin" className="text-xl font-bold">The tablet's family lock</h3>
        <p>If the person's tablet asks for a family PIN and it is forgotten, this removes the lock the next time records reach the tablet.</p>
        <BigButton onClick={() => { requestPinReset(core); logAudit(core, 'tablet_pin_reset_requested', 'tablet'); setPinMsg('Done. Share records with the tablet to finish.'); }} className="text-lg">Reset the tablet PIN</BigButton>
        {pinMsg && <p role="status">{pinMsg}</p>}
      </section>
      <section aria-labelledby="h-audit">
        <h3 id="h-audit" className="text-xl font-bold">Activity log</h3>
        <p data-testid="audit-status" role="status">{chain.length === 0 ? 'Nothing logged yet.' : broken === -1 ? `${chain.length} entries. The log is intact.` : `The log was changed at entry ${broken + 1}.`}</p>
        <ul className="text-sm">
          {chain.slice(-6).reverse().map((e) => <li key={e.seq}>{new Date(e.at).toLocaleString()}: {e.action} {e.target}</li>)}
        </ul>
      </section>
    </section>
  );
}
