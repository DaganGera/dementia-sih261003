import { fromB64, toB64 } from '@hillpath/core';
import type { AppCore } from './core';

/**
 * A light lock on the family area of the person's tablet. It keeps a curious tap out; it is not protection against a
 * determined attacker with the device. The PIN is stored only as a salted PBKDF2 hash, with slower retries after
 * repeated mistakes. A passkey (device unlock) can be added, and the PIN always stays as the fallback.
 */

export interface PinRecord {
  salt: string;
  hash: string;
  iter: number;
  setAt: number;
  /** Passkey credential id (base64) and its public key (SPKI, base64) with the COSE algorithm, when one is registered. */
  passkey?: { id: string; spki: string; alg: number };
}

interface Fails {
  count: number;
  until: number;
}

export const PIN_ITERATIONS = 200_000;
export const MAX_FREE_TRIES = 5;
export const UNLOCK_WINDOW_MS = 5 * 60_000;
export const isValidPin = (s: string): boolean => /^\d{4,8}$/.test(s);

const enc = new TextEncoder();

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

export const pinRecord = (core: AppCore): PinRecord | null => core.getLocal<PinRecord | null>('pin', null);
export const hasPin = (core: AppCore): boolean => pinRecord(core) !== null;

export async function setPin(core: AppCore, pin: string, keepPasskey = false): Promise<void> {
  if (!isValidPin(pin)) throw new Error('A PIN is 4 to 8 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const old = pinRecord(core);
  const rec: PinRecord = { salt: toB64(salt), hash: toB64(await derive(pin, salt, PIN_ITERATIONS)), iter: PIN_ITERATIONS, setAt: Date.now(), ...(keepPasskey && old?.passkey ? { passkey: old.passkey } : {}) };
  await core.putLocal('pin', rec);
  await core.putLocal('pin_fails', { count: 0, until: 0 } satisfies Fails);
}

export async function clearPin(core: AppCore): Promise<void> {
  await core.putLocal('pin', null);
  await core.putLocal('pin_fails', { count: 0, until: 0 } satisfies Fails);
}

/** Seconds a person must wait before trying again, or 0. Doubles after each mistake beyond five, up to 15 minutes. */
export function waitSeconds(core: AppCore, now = Date.now()): number {
  const f = core.getLocal<Fails>('pin_fails', { count: 0, until: 0 });
  return f.until > now ? Math.ceil((f.until - now) / 1000) : 0;
}

export async function checkPin(core: AppCore, pin: string, now = Date.now()): Promise<{ ok: boolean; waitSeconds: number }> {
  const rec = pinRecord(core);
  if (!rec) return { ok: true, waitSeconds: 0 };
  const wait = waitSeconds(core, now);
  if (wait > 0) return { ok: false, waitSeconds: wait };
  const ok = isValidPin(pin) && sameBytes(await derive(pin, fromB64(rec.salt), rec.iter), fromB64(rec.hash));
  const f = core.getLocal<Fails>('pin_fails', { count: 0, until: 0 });
  if (ok) {
    if (f.count) await core.putLocal('pin_fails', { count: 0, until: 0 } satisfies Fails);
    return { ok: true, waitSeconds: 0 };
  }
  const count = f.count + 1;
  const delay = count >= MAX_FREE_TRIES ? Math.min(15 * 60_000, 30_000 * 2 ** (count - MAX_FREE_TRIES)) : 0;
  await core.putLocal('pin_fails', { count, until: delay ? now + delay : 0 } satisfies Fails);
  return { ok: false, waitSeconds: Math.ceil(delay / 1000) };
}

// ---- reset from a family phone ----

const CTL = 'tablet-pin';

/** Family phone: ask the tablet to drop its PIN the next time it receives records. */
export function requestPinReset(core: AppCore): void {
  const exists = core.replica.get('device_ctl', CTL);
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'device_ctl', CTL, { reset_at: Date.now() });
}

export function pinResetRequestedAt(core: AppCore): number {
  return Number(core.replica.get('device_ctl', CTL)?.reset_at ?? 0);
}

/** Tablet: honour a reset that is newer than the PIN. Returns true if the PIN was removed. */
export async function applyPinReset(core: AppCore): Promise<boolean> {
  const rec = pinRecord(core);
  if (!rec || pinResetRequestedAt(core) <= rec.setAt) return false;
  await clearPin(core);
  return true;
}

// ---- passkey ----

export const passkeySupported = (): boolean => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

const b64u = (b: Uint8Array) => toB64(b).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const fromB64u = (s: string) => fromB64(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4));

export async function registerPasskey(core: AppCore): Promise<boolean> {
  const rec = pinRecord(core);
  if (!rec || !passkeySupported()) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Hillpath' },
        user: { id: enc.encode(core.deviceId), name: 'family-area', displayName: 'Family area' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        attestation: 'none',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    const res = cred.response as AuthenticatorAttestationResponse;
    const spki = res.getPublicKey?.();
    const alg = res.getPublicKeyAlgorithm?.();
    if (!spki || (alg !== -7 && alg !== -257)) return false;
    await core.putLocal('pin', { ...rec, passkey: { id: b64u(new Uint8Array(cred.rawId)), spki: toB64(new Uint8Array(spki)), alg } } satisfies PinRecord);
    return true;
  } catch {
    return false;
  }
}

/** ECDSA signatures from authenticators are DER encoded; WebCrypto wants r then s, 32 bytes each. */
export function derToRaw(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error('bad signature');
  let i = 2;
  if (der[1]! & 0x80) i = 2 + (der[1]! & 0x7f);
  const readInt = (): Uint8Array => {
    if (der[i] !== 0x02) throw new Error('bad signature');
    const len = der[i + 1]!;
    let v = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

/** Ask the device to confirm it is its owner (fingerprint, face, screen lock) and check the answer against the stored key. */
export async function passkeyUnlock(core: AppCore): Promise<boolean> {
  const pk = pinRecord(core)?.passkey;
  if (!pk || !passkeySupported()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const a = (await navigator.credentials.get({
      publicKey: { challenge, allowCredentials: [{ type: 'public-key', id: fromB64u(pk.id) as BufferSource }], userVerification: 'required', timeout: 60_000 },
    })) as PublicKeyCredential | null;
    if (!a) return false;
    const r = a.response as AuthenticatorAssertionResponse;
    const client = JSON.parse(new TextDecoder().decode(r.clientDataJSON)) as { type: string; challenge: string; origin: string };
    if (client.type !== 'webauthn.get' || client.challenge !== b64u(challenge) || client.origin !== location.origin) return false;
    const authData = new Uint8Array(r.authenticatorData);
    // Bit 2 of the flags byte is "user verified".
    if (!((authData[32] ?? 0) & 0x04)) return false;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', r.clientDataJSON));
    const signed = new Uint8Array(authData.length + hash.length);
    signed.set(authData, 0);
    signed.set(hash, authData.length);
    const spki = fromB64(pk.spki);
    const sig = new Uint8Array(r.signature);
    if (pk.alg === -7) {
      const key = await crypto.subtle.importKey('spki', spki as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig) as BufferSource, signed);
    }
    const key = await crypto.subtle.importKey('spki', spki as BufferSource, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig as BufferSource, signed);
  } catch {
    return false;
  }
}
