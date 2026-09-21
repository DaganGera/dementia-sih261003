import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { fromB64, randomBytes, toB64, toHex, utf8 } from './bytes';

export interface DeviceKeys {
  signSecret: Uint8Array;
  signPublic: Uint8Array;
  boxSecret: Uint8Array;
  boxPublic: Uint8Array;
}

export function newDeviceKeys(): DeviceKeys {
  const signSecret = ed25519.utils.randomSecretKey();
  const boxSecret = x25519.utils.randomSecretKey();
  return { signSecret, signPublic: ed25519.getPublicKey(signSecret), boxSecret, boxPublic: x25519.getPublicKey(boxSecret) };
}

export function newCircleKey(): Uint8Array {
  return randomBytes(32);
}

/** Bearer token for the relay, derived so the relay only ever stores its hash. */
export function relayBearer(circleKey: Uint8Array): string {
  return toHex(hkdf(sha256, circleKey, undefined, utf8('hillpath-relay-bearer'), 32));
}

export function bearerHash(bearer: string): string {
  return toHex(sha256(utf8(bearer)));
}

export interface WrappedKey {
  eph: string;
  nonce: string;
  ct: string;
}

/** Seal the circle key to one device's public box key. */
export function wrapCircleKey(circleKey: Uint8Array, recipientBoxPublic: Uint8Array): WrappedKey {
  const ephSecret = x25519.utils.randomSecretKey();
  const shared = x25519.getSharedSecret(ephSecret, recipientBoxPublic);
  const key = hkdf(sha256, shared, undefined, utf8('hillpath-key-wrap'), 32);
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(circleKey);
  return { eph: toB64(x25519.getPublicKey(ephSecret)), nonce: toB64(nonce), ct: toB64(ct) };
}

export function unwrapCircleKey(w: WrappedKey, boxSecret: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(boxSecret, fromB64(w.eph));
  const key = hkdf(sha256, shared, undefined, utf8('hillpath-key-wrap'), 32);
  return xchacha20poly1305(key, fromB64(w.nonce)).decrypt(fromB64(w.ct));
}

export function encryptBytes(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): { nonce: Uint8Array; ct: Uint8Array } {
  const nonce = randomBytes(24);
  return { nonce, ct: xchacha20poly1305(key, nonce, aad).encrypt(plain) };
}

export function decryptBytes(key: Uint8Array, nonce: Uint8Array, ct: Uint8Array, aad: Uint8Array): Uint8Array {
  return xchacha20poly1305(key, nonce, aad).decrypt(ct);
}

export function sign(secret: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, secret);
}

export function verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** Four digits both devices show during pairing so the user can compare them. */
export function comparisonCode(a: Uint8Array, b: Uint8Array): string {
  const [x, y] = toB64(a) < toB64(b) ? [a, b] : [b, a];
  const h = sha256(new Uint8Array([...x, ...y]));
  const n = ((h[0]! << 8) | h[1]!) % 10000;
  return n.toString().padStart(4, '0');
}
