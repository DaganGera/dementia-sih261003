import type { Op } from '@hillpath/contracts';
import type { Persistence } from '@hillpath/core';
import Dexie, { type Table } from 'dexie';

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

class HillpathDB extends Dexie {
  ops!: Table<Sealed & { op_id: string }, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  blobs!: Table<Sealed & { id: string; type: string }, string>;

  constructor(name = 'hillpath') {
    super(name);
    this.version(1).stores({ ops: 'op_id', meta: 'key', blobs: 'id' });
  }
}

export type Db = HillpathDB;
export const openDb = (name?: string): Db => new HillpathDB(name);

/** AES-GCM key kept as a non-extractable CryptoKey in IndexedDB. Ops, secrets and blobs are sealed with it. */
export async function getVault(db: Db): Promise<CryptoKey> {
  const existing = await db.meta.get('vault');
  if (existing) return existing.value as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await db.meta.put({ key: 'vault', value: key });
  return key;
}

async function seal(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes) };
}

async function open(key: CryptoKey, s: Sealed): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: s.iv }, key, s.data));
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function dexiePersistence(db: Db, key: CryptoKey): Persistence {
  return {
    async load() {
      const rows = await db.ops.toArray();
      const out: Op[] = [];
      for (const r of rows) out.push(JSON.parse(dec.decode(await open(key, r))) as Op);
      return out;
    },
    async append(ops) {
      const rows = await Promise.all(ops.map(async (op) => ({ op_id: op.op_id, ...(await seal(key, enc.encode(JSON.stringify(op)))) })));
      await db.ops.bulkPut(rows);
    },
  };
}

export async function saveSecret(db: Db, key: CryptoKey, name: string, json: unknown): Promise<void> {
  await db.meta.put({ key: `secret:${name}`, value: await seal(key, enc.encode(JSON.stringify(json))) });
}

export async function loadSecret<T>(db: Db, key: CryptoKey, name: string): Promise<T | null> {
  const row = await db.meta.get(`secret:${name}`);
  if (!row) return null;
  return JSON.parse(dec.decode(await open(key, row.value as Sealed))) as T;
}

export async function putBlob(db: Db, key: CryptoKey, id: string, blob: Blob): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await db.blobs.put({ id, type: blob.type, ...(await seal(key, bytes)) });
}

export async function getBlob(db: Db, key: CryptoKey, id: string): Promise<Blob | null> {
  const row = await db.blobs.get(id);
  if (!row) return null;
  return new Blob([(await open(key, row)) as BlobPart], { type: row.type });
}

export async function hasBlob(db: Db, id: string): Promise<boolean> {
  return (await db.blobs.get(id)) !== undefined;
}
