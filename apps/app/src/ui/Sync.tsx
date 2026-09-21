import { comparisonCode, fromB64 } from '@hillpath/core';
import { useState } from 'react';
import type { AppCore, Peer } from '../lib/core';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from './kit';
import { QRScan, QRShow } from './qr';

type Tab = 'send' | 'receive' | 'pair';

/** Share and pair without any network. Used on every device; the caregiver starts pairing, others answer. */
export function SyncPanel({ core }: { core: AppCore }) {
  const [tab, setTab] = useState<Tab>('send');
  useVersion();
  return (
    <section className="flex flex-col gap-4" aria-label="Share with another device">
      <div role="tablist" className="flex flex-wrap gap-2">
        {(['send', 'receive', 'pair'] as Tab[]).map((t) => (
          <BigButton key={t} role="tab" aria-selected={tab === t} primary={tab === t} onClick={() => setTab(t)} className="text-lg">
            {t === 'send' ? 'Send records' : t === 'receive' ? 'Receive records' : 'Pair a device'}
          </BigButton>
        ))}
      </div>
      {tab === 'send' && <Send core={core} />}
      {tab === 'receive' && <Receive core={core} />}
      {tab === 'pair' && <Pair core={core} />}
    </section>
  );
}

function Send({ core }: { core: AppCore }) {
  const [state, setState] = useState<{ text: string; count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);
  if (!core.circle) return <StateNote kind="empty" title="This device is not paired yet." body="Open Pair a device first." />;
  return (
    <div className="flex flex-col gap-3">
      <p>Everything stays encrypted. Only devices in your family circle can read it. No internet is needed.</p>
      {!state && (
        <>
          <BigButton primary onClick={() => core.shareText().then(setState).catch((e: Error) => setErr(e.message))}>Show new records</BigButton>
          <BigButton onClick={() => core.shareText(true).then(setState).catch((e: Error) => setErr(e.message))}>Show all records</BigButton>
        </>
      )}
      {err && <StateNote kind="error" title="Could not prepare the records." body={err} />}
      {state && (
        <>
          <p aria-live="polite">{state.count} records in this code.</p>
          <QRShow text={state.text} label="Moving code with encrypted records" />
          <BigButton primary disabled={marked} onClick={() => core.markShared().then(() => setMarked(true))}>
            {marked ? 'Marked as sent' : 'The other phone has it'}
          </BigButton>
        </>
      )}
    </div>
  );
}

function Receive({ core }: { core: AppCore }) {
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!core.circle) return <StateNote kind="empty" title="This device is not paired yet." body="Open Pair a device first." />;
  return (
    <div className="flex flex-col gap-3">
      {result === null && !err && (
        <QRScan
          onText={(t) =>
            core
              .receiveText(t)
              .then((n) => setResult(`${n} new records added.`))
              .catch((e: Error) => setErr(e.message))
          }
        />
      )}
      {result && <StateNote kind="empty" title={result} body="You can close this screen." />}
      {err && (
        <StateNote kind="error" title="That code could not be used." body={err} action={<BigButton onClick={() => setErr(null)}>Try again</BigButton>} />
      )}
    </div>
  );
}

function Pair({ core }: { core: AppCore }) {
  return core.role === 'caregiver' ? <PairCaregiver core={core} /> : <PairNewDevice core={core} />;
}

function PairCaregiver({ core }: { core: AppCore }) {
  const [step, setStep] = useState<'offer' | 'scan' | 'key'>('offer');
  const [keyText, setKeyText] = useState('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const v = useVersion();
  void v;
  if (!core.circle) return <BigButton primary onClick={() => void core.createCircle()}>Start a family circle</BigButton>;
  return (
    <div className="flex flex-col gap-3">
      {core.circle.peers.length > 0 && (
        <ul className="card" aria-label="Paired devices">
          {core.circle.peers.map((p) => (
            <li key={p.device} className="flex items-center justify-between gap-3 py-1">
              <span>{p.name} ({p.role})</span>
              <BigButton className="btn-quiet text-lg" onClick={() => void core.removePeer(p.device)}>Remove</BigButton>
            </li>
          ))}
        </ul>
      )}
      {step === 'offer' && (
        <>
          <p>Step 1. Show this code on your phone. On the other device, choose Pair a device and scan it.</p>
          <QRShow text={core.offerText('Family phone')} label="Pairing offer code" />
          <BigButton primary onClick={() => setStep('scan')}>Next: scan the reply</BigButton>
        </>
      )}
      {step === 'scan' && (
        <>
          <p>Step 2. The other device now shows a reply code. Scan it here.</p>
          <QRScan
            onText={(t) =>
              core
                .admit(t)
                .then((r) => {
                  setKeyText(r.keyText);
                  setPeer(r.peer);
                  setStep('key');
                })
                .catch((e: Error) => setErr(e.message))
            }
          />
          {err && <StateNote kind="error" title="That code could not be used." body={err} action={<BigButton onClick={() => setErr(null)}>Try again</BigButton>} />}
        </>
      )}
      {step === 'key' && peer && (
        <>
          <p>
            Step 3. Check that both screens show the same four digits: <strong data-testid="compare-code">{comparisonCode(core.keys.boxPublic, fromB64(peer.box))}</strong>. Then let the other device scan this code.
          </p>
          <QRShow text={keyText} label="Sealed key code for the new device" />
          <BigButton primary onClick={() => setStep('offer')}>Finished</BigButton>
        </>
      )}
    </div>
  );
}

function PairNewDevice({ core }: { core: AppCore }) {
  const [step, setStep] = useState<'scan-offer' | 'reply' | 'scan-key' | 'done'>('scan-offer');
  const [reply, setReply] = useState('');
  const [caregiver, setCaregiver] = useState<Peer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const role = core.role === 'health_worker' ? 'health_worker' : 'patient';
  const retry = <BigButton onClick={() => setErr(null)}>Try again</BigButton>;
  return (
    <div className="flex flex-col gap-3">
      {core.circle && step === 'scan-offer' && <StateNote kind="empty" title="This device is already paired." body="Scan a new offer only if you want to join a different circle." />}
      {step === 'scan-offer' && !err && (
        <QRScan
          prompt="Step 1. Scan the pairing code on the family phone."
          onText={(t) => {
            try {
              const r = core.acceptText(t, role === 'patient' ? 'Tablet' : 'Health worker phone', role);
              setReply(r.text);
              setCaregiver(r.peer);
              setStep('reply');
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        />
      )}
      {err && <StateNote kind="error" title="That code could not be used." body={err} action={retry} />}
      {step === 'reply' && caregiver && (
        <>
          <p>
            Step 2. Check that both screens show the same four digits: <strong data-testid="compare-code">{comparisonCode(core.keys.boxPublic, fromB64(caregiver.box))}</strong>. Then let the family phone scan this reply.
          </p>
          <QRShow text={reply} label="Reply code for the family phone" />
          <BigButton primary onClick={() => setStep('scan-key')}>Next: scan the key</BigButton>
        </>
      )}
      {step === 'scan-key' && caregiver && !err && (
        <QRScan
          prompt="Step 3. Scan the last code on the family phone."
          onText={(t) =>
            core
              .join(t, caregiver)
              .then(() => setStep('done'))
              .catch((e: Error) => setErr(e.message))
          }
        />
      )}
      {step === 'done' && <StateNote kind="empty" title="Paired." body="This device is now part of the family circle." />}
    </div>
  );
}
