import { z } from 'zod';
import { fromB64, toB64 } from './bytes';
import { unwrapCircleKey, wrapCircleKey, type WrappedKey } from './crypto';

/**
 * Three QR messages pair a device without any network:
 * offer (caregiver) -> accept (new device) -> key (caregiver, sealed to the new device's box key).
 * Both screens show a 4 digit comparison code between offer and accept so a person can check them.
 */
const b64 = z.string().min(20).max(200);

export const PairOffer = z.object({ t: z.literal('offer'), circle: z.string().min(6), sign: b64, box: b64, name: z.string().max(60) });
export const PairAccept = z.object({ t: z.literal('accept'), device: z.string().min(4), sign: b64, box: b64, name: z.string().max(60), role: z.enum(['patient', 'caregiver', 'health_worker']) });
export const PairKey = z.object({ t: z.literal('key'), circle: z.string(), to: z.string(), wrapped: z.object({ eph: z.string(), nonce: z.string(), ct: z.string() }) });
export type PairOffer = z.infer<typeof PairOffer>;
export type PairAccept = z.infer<typeof PairAccept>;
export type PairKey = z.infer<typeof PairKey>;

export function parsePairing(text: string): PairOffer | PairAccept | PairKey | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  for (const schema of [PairOffer, PairAccept, PairKey] as const) {
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
  }
  return null;
}

export function makeOffer(circle: string, signPublic: Uint8Array, boxPublic: Uint8Array, name: string): string {
  return JSON.stringify({ t: 'offer', circle, sign: toB64(signPublic), box: toB64(boxPublic), name } satisfies PairOffer);
}

export function makeAccept(device: string, signPublic: Uint8Array, boxPublic: Uint8Array, name: string, role: PairAccept['role']): string {
  return JSON.stringify({ t: 'accept', device, sign: toB64(signPublic), box: toB64(boxPublic), name, role } satisfies PairAccept);
}

export function makeKey(circle: string, circleKey: Uint8Array, accept: PairAccept): string {
  const wrapped: WrappedKey = wrapCircleKey(circleKey, fromB64(accept.box));
  return JSON.stringify({ t: 'key', circle, to: accept.device, wrapped } satisfies PairKey);
}

export function openKey(msg: PairKey, myDevice: string, boxSecret: Uint8Array): Uint8Array {
  if (msg.to !== myDevice) throw new Error('This key is for another device');
  return unwrapCircleKey(msg.wrapped, boxSecret);
}
