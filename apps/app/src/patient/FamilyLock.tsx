import { useEffect, useState } from 'react';
import type { AppCore } from '../lib/core';
import { applyPinReset, checkPin, clearPin, hasPin, isValidPin, passkeySupported, passkeyUnlock, pinRecord, registerPasskey, setPin, UNLOCK_WINDOW_MS, waitSeconds } from '../lib/pin';
import { go } from '../lib/router';
import { useVersion } from '../lib/state';
import { BigButton, PatientScreen } from '../ui/kit';
import { QRScan } from '../ui/qr';
import { SyncPanel } from '../ui/Sync';

/** Unlock lasts a few minutes while the page stays open, and is forgotten on reload. */
let unlockedAt = 0;
const isOpen = () => Date.now() - unlockedAt < UNLOCK_WINDOW_MS;

/** The family area of the person's tablet: sharing and pairing, behind an optional PIN. */
export function FamilyGate({ core }: { core: AppCore }) {
  const v = useVersion();
  const [, tick] = useState(0);
  useEffect(() => {
    void applyPinReset(core);
  }, [core, v]);

  const locked = hasPin(core) && !isOpen();
  return (
    <PatientScreen title="For family" onBack={() => go('patient')}>
      {locked ? (
        <PinEntry core={core} onOpen={() => { unlockedAt = Date.now(); tick((n) => n + 1); }} />
      ) : (
        <>
          <SyncPanel core={core} />
          <LockSettings core={core} onLock={() => { unlockedAt = 0; tick((n) => n + 1); }} />
        </>
      )}
    </PatientScreen>
  );
}

function PinEntry({ core, onOpen }: { core: AppCore; onOpen: () => void }) {
  const [pin, setPinText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passkey = !!pinRecord(core)?.passkey && passkeySupported();

  const submit = async () => {
    setBusy(true);
    const r = await checkPin(core, pin);
    setBusy(false);
    if (r.ok) return onOpen();
    // The field keeps its value so a mistyped digit can just be fixed, rather than retyped from empty.
    setMsg(r.waitSeconds > 0 ? `Too many tries. Please wait ${r.waitSeconds} seconds.` : 'That PIN did not match. Please try again.');
  };

  const usePasskey = async () => {
    setBusy(true);
    const ok = await passkeyUnlock(core);
    setBusy(false);
    if (ok) onOpen();
    else setMsg('Device unlock did not work. You can use the PIN instead.');
  };

  const wait = waitSeconds(core);
  const [, tick] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [wait]);

  return (
    <div className="flex flex-col gap-4">
      <form className="card flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-label="Family area lock">
        <h2 className="text-2xl font-bold">This area is for family.</h2>
        <label>Family PIN
          <input className="field" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))} />
        </label>
        {msg && <p role="alert" className="font-bold">{msg}</p>}
        <BigButton primary type="submit" disabled={busy || !isValidPin(pin) || wait > 0}>Open</BigButton>
        {passkey && <BigButton type="button" onClick={() => void usePasskey()} disabled={busy}>Use device unlock instead</BigButton>}
      </form>
      <details className="card">
        <summary className="cursor-pointer py-2 text-lg">Forgot the PIN?</summary>
        <p className="mb-3 text-base">On a family phone, open Privacy and choose "Reset the tablet PIN". Then open Share, show all records, and scan that code here.</p>
        <QRScan
          prompt="Scan the records code from the family phone."
          onText={(t) =>
            core
              .receiveText(t)
              .then(() => applyPinReset(core))
              .then((cleared) => (cleared ? onOpen() : setMsg('That code did not reset the PIN. Ask the family phone to choose "Reset the tablet PIN" first.')))
              .catch(() => setMsg('That code could not be used.'))
          }
        />
      </details>
    </div>
  );
}

function LockSettings({ core, onLock }: { core: AppCore; onLock: () => void }) {
  useVersion();
  const [pin, setPinText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const rec = pinRecord(core);
  const has = hasPin(core);

  const save = async () => {
    if (!isValidPin(pin)) return setMsg('A PIN is 4 to 8 digits.');
    unlockedAt = Date.now();
    await setPin(core, pin, true);
    setPinText('');
    setMsg(has ? 'The PIN was changed.' : 'The PIN is set. This area is locked when you leave it.');
  };

  return (
    <details className="card mt-4" data-testid="lock-settings">
      <summary className="cursor-pointer py-2 text-xl font-bold">{has ? 'Lock settings' : 'Lock this area with a PIN'}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p>The lock keeps accidental taps out. It is not a strong protection if someone has the tablet for a long time.</p>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label>{has ? 'New PIN (4 to 8 digits)' : 'Choose a PIN (4 to 8 digits)'}
            <input className="field" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))} />
          </label>
          <BigButton primary type="submit" disabled={!isValidPin(pin)}>{has ? 'Change the PIN' : 'Set the PIN'}</BigButton>
        </form>
        {msg && <p role="status">{msg}</p>}
        {has && (
          <div className="flex flex-wrap gap-3">
            <BigButton onClick={onLock}>Lock now</BigButton>
            {passkeySupported() && !rec?.passkey && (
              <BigButton onClick={() => void registerPasskey(core).then((ok) => setMsg(ok ? 'Device unlock is on. The PIN still works.' : 'Device unlock could not be set up on this tablet. The PIN still works.'))}>Add device unlock</BigButton>
            )}
            {rec?.passkey && <span role="status">Device unlock is on.</span>}
            <BigButton className="btn-quiet" onClick={() => void clearPin(core).then(() => setMsg('The lock is removed.'))}>Remove the lock</BigButton>
          </div>
        )}
      </div>
    </details>
  );
}
