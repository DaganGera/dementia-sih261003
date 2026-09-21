import { sha256 } from '@noble/hashes/sha2.js';
import { canonicalJson, toHex, utf8 } from './bytes';

export interface AuditEvent {
  seq: number;
  prev_hash: string;
  hash: string;
  actor: string;
  action: string;
  target: string;
  at: number;
}

const GENESIS = '0'.repeat(64);

function hashOf(prev: string, e: Omit<AuditEvent, 'hash'>): string {
  return toHex(sha256(utf8(prev + canonicalJson({ seq: e.seq, actor: e.actor, action: e.action, target: e.target, at: e.at }))));
}

export function appendAudit(chain: AuditEvent[], actor: string, action: string, target: string, at: number): AuditEvent[] {
  const prev = chain.length ? chain[chain.length - 1]!.hash : GENESIS;
  const base = { seq: chain.length, prev_hash: prev, actor, action, target, at };
  return [...chain, { ...base, hash: hashOf(prev, base) }];
}

/** Index of the first broken link, or -1 when the chain is intact. */
export function verifyChain(chain: AuditEvent[]): number {
  let prev = GENESIS;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]!;
    if (e.seq !== i || e.prev_hash !== prev || e.hash !== hashOf(prev, e)) return i;
    prev = e.hash;
  }
  return -1;
}
