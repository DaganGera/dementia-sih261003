import { Envelope, Op } from '@hillpath/contracts';
import { decode, encode } from 'cbor-x';
import { canonicalJson, fromB64, toB64, utf8 } from './bytes';
import { decryptBytes, encryptBytes, sign, verify } from './crypto';

function header(e: Omit<Envelope, 'sig'>): Uint8Array {
  return utf8(canonicalJson({ v: e.v, circle: e.circle, from: e.from, vector: e.vector, nonce: e.nonce, ciphertext: e.ciphertext }));
}

export interface SealInput {
  circle: string;
  circleKey: Uint8Array;
  from: string;
  signSecret: Uint8Array;
  ops: Op[];
  vector: Record<string, string>;
}

export function sealEnvelope(i: SealInput): Envelope {
  const aad = utf8(`${i.circle}|${i.from}`);
  const { nonce, ct } = encryptBytes(i.circleKey, encode(i.ops), aad);
  const body = { v: 1 as const, circle: i.circle, from: i.from, vector: i.vector, nonce: toB64(nonce), ciphertext: toB64(ct) };
  return { ...body, sig: toB64(sign(i.signSecret, header(body))) };
}

export interface OpenInput {
  envelope: unknown;
  circleKey: Uint8Array;
  senderSignPublic: Uint8Array;
}

export class EnvelopeError extends Error {}

/** Verifies the signature, decrypts, and validates every op. Throws EnvelopeError on any failure. */
export function openEnvelope(i: OpenInput): { ops: Op[]; vector: Record<string, string>; from: string } {
  const parsed = Envelope.safeParse(i.envelope);
  if (!parsed.success) throw new EnvelopeError('Envelope shape is not valid');
  const e = parsed.data;
  const { sig, ...body } = e;
  if (!verify(i.senderSignPublic, header(body), fromB64(sig))) throw new EnvelopeError('Signature does not match');
  let plain: Uint8Array;
  try {
    plain = decryptBytes(i.circleKey, fromB64(e.nonce), fromB64(e.ciphertext), utf8(`${e.circle}|${e.from}`));
  } catch {
    throw new EnvelopeError('Could not decrypt');
  }
  const raw = decode(plain) as unknown;
  if (!Array.isArray(raw)) throw new EnvelopeError('Payload is not a list of ops');
  const ops = raw.map((o) => {
    const r = Op.safeParse(o);
    if (!r.success) {
      const issue = r.error.issues[0];
      throw new EnvelopeError(`A record is not valid (${issue?.path.join('.') || 'shape'}: ${issue?.message ?? 'unknown'})`);
    }
    return r.data;
  });
  return { ops, vector: e.vector, from: e.from };
}
