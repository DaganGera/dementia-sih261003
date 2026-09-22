import { useEffect, useState } from 'react';
import type { AppCore } from '../lib/core';
import { lanExchange, lanHost, lanJoin, type Guest, type Host } from '../lib/lan';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from './kit';
import { QRScan, QRShow } from './qr';

const DEFAULT_RELAY = (import.meta.env.VITE_RELAY_ORIGIN as string | undefined) ?? '';

/** Backup server: a relay that only ever holds encrypted records. Optional and never needed. */
export function RelayPanel({ core }: { core: AppCore }) {
  useVersion();
  const [origin, setOrigin] = useState(core.circle?.relay?.origin ?? DEFAULT_RELAY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!core.circle) return <StateNote kind="empty" title="This device is not paired yet." body="Open Pair a device first." />;

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await core.setRelay(origin);
      const r = await core.relaySync();
      setMsg({ ok: true, text: `Done. Sent ${r.sent} records and received ${r.received}.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p>A backup server stores your records after they are encrypted on this device. It cannot read them. You never need one: sharing by scanning works without it.</p>
      <label>Server address<input className="field" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://your-relay.workers.dev" inputMode="url" /></label>
      <BigButton primary onClick={() => void run()} disabled={busy || !origin.trim()}>{busy ? 'Working' : 'Sync now'}</BigButton>
      {msg && <StateNote kind={msg.ok ? 'empty' : 'error'} title={msg.ok ? 'Synced.' : 'Could not sync.'} body={msg.text} />}
    </div>
  );
}

/** Health worker: carry other families' encrypted shares and hand them on later. The phone cannot read them. */
export function CourierPanel({ core }: { core: AppCore }) {
  const [summary, setSummary] = useState<Array<{ circle: string; count: number; bytes: number }>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [bundle, setBundle] = useState<{ circle: string; text: string } | null>(null);
  const [server, setServer] = useState(DEFAULT_RELAY);
  const refresh = () => void core.courierSummary().then(setSummary);
  useEffect(refresh, [core]);

  return (
    <div className="flex flex-col gap-4">
      <p>Carry another family's records without reading them. Scan the share on their device, and later hand it to their family phone or send it to their backup server.</p>
      {!scanning ? (
        <BigButton primary onClick={() => { setScanning(true); setErr(null); setMsg(null); }}>Take a share from a family</BigButton>
      ) : (
        <QRScan
          prompt="Scan the moving code on the family's Send records screen."
          onText={(t) =>
            core
              .courierReceive(t)
              .then((r) => {
                setMsg(`Kept a share for circle ${r.circle}. It is encrypted and cannot be read on this phone.`);
                setScanning(false);
                refresh();
              })
              .catch((e: Error) => {
                setErr(e.message);
                setScanning(false);
              })
          }
        />
      )}
      {msg && <p role="status" className="card">{msg}</p>}
      {err && <StateNote kind="error" title="That share could not be kept." body={err} />}
      {summary.length === 0 ? (
        <StateNote kind="empty" title="Nothing is being carried." body="Shares you take appear here." />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Carried shares">
          {summary.map((s) => (
            <li key={s.circle} className="card flex flex-col gap-2" data-testid="courier-item">
              <p><strong>{s.circle}</strong>: {s.count} {s.count === 1 ? 'share' : 'shares'}, {Math.round(s.bytes / 1024)} KB</p>
              <BigButton onClick={() => void core.courierBundle(s.circle).then((text) => setBundle({ circle: s.circle, text }))}>Show to hand over</BigButton>
              <label>Backup server of that family (optional)<input className="field" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://your-relay.workers.dev" inputMode="url" /></label>
              <BigButton
                className="btn-quiet"
                disabled={!server.trim()}
                onClick={() =>
                  core
                    .courierDeliver(s.circle, server)
                    .then((n) => {
                      setMsg(`Delivered ${n} shares to the server.`);
                      setErr(null);
                      refresh();
                    })
                    .catch((e: Error) => setErr(e.message))
                }
              >
                Send to their server
              </BigButton>
            </li>
          ))}
        </ul>
      )}
      {bundle && (
        <div className="flex flex-col gap-2">
          <p>Let a device of that family scan this and choose Receive records.</p>
          <QRShow text={bundle.text} label={`Carried shares for circle ${bundle.circle}`} />
        </div>
      )}
    </div>
  );
}

/** Nearby: two devices on the same Wi-Fi or hotspot sync directly with no internet at all. */
export function LanPanel({ core }: { core: AppCore }) {
  const [step, setStep] = useState<'choose' | 'host-show' | 'host-scan' | 'guest-scan' | 'guest-show' | 'working' | 'done'>('choose');
  const [host, setHost] = useState<Host | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [result, setResult] = useState<{ sent: number; received: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!core.circle) return <StateNote kind="empty" title="This device is not paired yet." body="Open Pair a device first." />;

  const fail = (e: unknown) => {
    setErr(e instanceof Error ? e.message : 'The nearby connection failed.');
    setStep('choose');
  };
  const exchange = async (ch: RTCDataChannel) => {
    setStep('working');
    const r = await lanExchange(core, ch);
    setResult(r);
    setStep('done');
    void core.markShared();
  };

  return (
    <div className="flex flex-col gap-3">
      <p>Both devices need the same Wi-Fi or hotspot. No internet is used.</p>
      {err && <StateNote kind="error" title="Could not connect." body={err} />}
      {step === 'choose' && (
        <>
          <BigButton primary onClick={() => void lanHost().then((h) => { setHost(h); setStep('host-show'); }).catch(fail)}>Start on this device</BigButton>
          <BigButton onClick={() => { setErr(null); setStep('guest-scan'); }}>Join from the other device</BigButton>
        </>
      )}
      {step === 'host-show' && host && (
        <>
          <p>Step 1. Let the other device scan this and choose Join.</p>
          <QRShow text={host.text} label="Nearby connection offer" />
          <BigButton primary onClick={() => setStep('host-scan')}>Next: scan the reply</BigButton>
        </>
      )}
      {step === 'host-scan' && host && (
        <QRScan prompt="Step 2. Scan the reply code on the other device." onText={(t) => host.finish(t).then(exchange).catch(fail)} />
      )}
      {step === 'guest-scan' && <QRScan prompt="Scan the code on the first device." onText={(t) => lanJoin(t).then((g) => { setGuest(g); setStep('guest-show'); void g.channel.then(exchange).catch(fail); }).catch(fail)} />}
      {step === 'guest-show' && guest && (
        <>
          <p>Let the first device scan this reply.</p>
          <QRShow text={guest.text} label="Nearby connection reply" />
        </>
      )}
      {step === 'working' && <p role="status" className="card">Connected. Sharing records.</p>}
      {step === 'done' && result && <StateNote kind="empty" title="Done." body={`Sent ${result.sent} records and received ${result.received}. No internet was used.`} />}
    </div>
  );
}
