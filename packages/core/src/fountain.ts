import { sha256 } from '@noble/hashes/sha2.js';
import { fromB64, toB64, toHex, utf8 } from './bytes';

/**
 * A Luby-transform fountain code for moving text between screens. The sender shows an endless stream of frames.
 * The first K frames are the plain chunks; later frames are XORs of several chunks. A receiver that catches
 * any slightly more than K frames, in any order, rebuilds the text, so lost frames never need to be repeated.
 * Frame: HF1|id|byteLength|K|seq|base64(payload)
 */
const PREFIX = 'HF1';
export const CHUNK_BYTES = 420;

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which chunks frame `seq` combines. Frames below K are single chunks. */
export function indicesFor(id: string, k: number, seq: number): number[] {
  if (seq < k) return [seq];
  const r = prng(fnv(`${id}:${seq}`));
  // Degree weights: a spike at 2, a soliton tail, and enough degree-1 frames to keep decoding moving.
  const maxD = Math.min(k, 24);
  const weights: number[] = [];
  for (let d = 1; d <= maxD; d++) weights.push(d === 1 ? 0.06 + 1 / k : d === 2 ? 0.46 : 1 / (d * (d - 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  let degree = 1;
  for (let d = 1; d <= maxD; d++) {
    x -= weights[d - 1]!;
    if (x <= 0) {
      degree = d;
      break;
    }
  }
  const picked = new Set<number>();
  while (picked.size < degree) picked.add(Math.floor(r() * k));
  return [...picked].sort((a, b) => a - b);
}

export class FountainEncoder {
  readonly id: string;
  readonly k: number;
  private readonly chunks: Uint8Array[];
  private readonly length: number;

  constructor(text: string, chunkBytes = CHUNK_BYTES) {
    const bytes = utf8(text);
    this.length = bytes.length;
    this.id = toHex(sha256(bytes)).slice(0, 8);
    this.k = Math.max(1, Math.ceil(bytes.length / chunkBytes));
    this.chunks = Array.from({ length: this.k }, (_, i) => {
      const c = new Uint8Array(chunkBytes);
      c.set(bytes.subarray(i * chunkBytes, (i + 1) * chunkBytes));
      return c;
    });
  }

  frame(seq: number): string {
    const idx = indicesFor(this.id, this.k, seq);
    const payload = new Uint8Array(this.chunks[0]!.length);
    for (const i of idx) for (let b = 0; b < payload.length; b++) payload[b] = payload[b]! ^ this.chunks[i]![b]!;
    return `${PREFIX}|${this.id}|${this.length}|${this.k}|${seq}|${toB64(payload)}`;
  }
}

interface Equation {
  idx: Set<number>;
  payload: Uint8Array;
}

export class FountainDecoder {
  private id: string | null = null;
  private k = 0;
  private length = 0;
  private known = new Map<number, Uint8Array>();
  private pending: Equation[] = [];
  private seen = new Set<number>();
  received = 0;

  add(raw: string): { progress: number; text?: string } {
    const p = raw.split('|');
    if (p.length !== 6 || p[0] !== PREFIX) return { progress: this.progress() };
    const [, id, len, k, seq, data] = p as [string, string, string, string, string, string];
    if (this.id !== id) this.reset(id, Number(len), Number(k));
    const s = Number(seq);
    if (!Number.isInteger(s) || s < 0 || this.seen.has(s) || this.k > 20_000) return { progress: this.progress() };
    this.seen.add(s);
    this.received += 1;
    let payload: Uint8Array;
    try {
      payload = fromB64(data);
    } catch {
      return { progress: this.progress() };
    }
    const eq: Equation = { idx: new Set(indicesFor(id, this.k, s)), payload: payload.slice() };
    this.absorb(eq);
    this.peel();
    if (this.known.size === this.k) {
      const all = new Uint8Array(this.k * payload.length);
      for (let i = 0; i < this.k; i++) all.set(this.known.get(i)!, i * payload.length);
      const bytes = all.subarray(0, this.length);
      if (toHex(sha256(bytes)).slice(0, 8) === id) return { progress: 1, text: new TextDecoder().decode(bytes) };
      this.reset(null, 0, 0);
    }
    return { progress: this.progress() };
  }

  private reset(id: string | null, length: number, k: number) {
    this.id = id;
    this.length = length;
    this.k = k;
    this.known.clear();
    this.pending = [];
    this.seen.clear();
    this.received = 0;
  }

  progress(): number {
    return this.k === 0 ? 0 : this.known.size / this.k;
  }

  private absorb(eq: Equation) {
    for (const i of [...eq.idx]) {
      const c = this.known.get(i);
      if (c) {
        for (let b = 0; b < eq.payload.length; b++) eq.payload[b] = eq.payload[b]! ^ c[b]!;
        eq.idx.delete(i);
      }
    }
    if (eq.idx.size === 1) {
      const [i] = [...eq.idx] as [number];
      this.known.set(i, eq.payload);
    } else if (eq.idx.size > 1) this.pending.push(eq);
  }

  private peel() {
    let changed = true;
    while (changed) {
      changed = false;
      const rest: Equation[] = [];
      for (const eq of this.pending) {
        const before = eq.idx.size;
        for (const i of [...eq.idx]) {
          const c = this.known.get(i);
          if (c) {
            for (let b = 0; b < eq.payload.length; b++) eq.payload[b] = eq.payload[b]! ^ c[b]!;
            eq.idx.delete(i);
          }
        }
        if (eq.idx.size === 1) {
          const [i] = [...eq.idx] as [number];
          if (!this.known.has(i)) this.known.set(i, eq.payload);
          changed = true;
        } else if (eq.idx.size > 1) {
          rest.push(eq);
          if (eq.idx.size < before) changed = true;
        }
      }
      this.pending = rest;
    }
  }
}
