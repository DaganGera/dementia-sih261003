import type { Role } from '@hillpath/contracts';
import { Envelope } from '@hillpath/contracts';
import {
  Replica,
  bearerHash,
  fromB64,
  gunzipFromB64,
  gzipToB64,
  makeAccept,
  makeKey,
  makeOffer,
  newCircleKey,
  newDeviceKeys,
  openEnvelope,
  openKey,
  parsePairing,
  relayBearer,
  relayDropToken,
  sealEnvelope,
  toB64,
  type DeviceKeys,
  type PairAccept,
} from '@hillpath/core';
import { dexiePersistence, getBlob, getVault, hasBlob, loadSecret, openDb, putBlob, saveSecret, type Db } from './db';

export interface Peer {
  device: string;
  name: string;
  role: string;
  sign: string;
  box: string;
}

interface IdentityStored {
  deviceId: string;
  role: Role | null;
  signSecret: string;
  signPublic: string;
  boxSecret: string;
  boxPublic: string;
}

interface RelayState {
  origin: string;
  cursor: number;
  pushed: Record<string, string>;
}

interface CircleStored {
  id: string;
  key: string;
  peers: Peer[];
  sent: Record<string, Record<string, string>>;
  relay?: RelayState;
}

export interface Circle {
  id: string;
  key: Uint8Array;
  peers: Peer[];
  sent: Record<string, Record<string, string>>;
  relay?: RelayState;
}

export interface EnvelopeWire {
  v: 1;
  circle: string;
  from: string;
  vector: Record<string, string>;
  nonce: string;
  ciphertext: string;
  sig: string;
  /** The sender's public signing key, so a device that has not paired with it can still check integrity. */
  senderSign?: string;
  /** Write-only delivery token for couriers. Not part of the signed header. */
  drop?: string;
}

export class SyncError extends Error {}

const newId = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

/** All device state that is not an op: identity, keys, circle membership. Ops live in the replica. */
export class AppCore {
  db!: Db;
  vault!: CryptoKey;
  replica!: Replica;
  keys!: DeviceKeys;
  deviceId = '';
  role: Role | null = null;
  circle: Circle | null = null;
  /** Device-only values (carer check-in answers, PIN hash, language pack state). Sealed at rest, never synced or reported. */
  local: Record<string, unknown> = {};
  private listeners = new Set<() => void>();
  version = 0;

  static async create(dbName?: string): Promise<AppCore> {
    const c = new AppCore();
    c.db = openDb(dbName);
    c.vault = await getVault(c.db);
    const stored = await loadSecret<IdentityStored>(c.db, c.vault, 'identity');
    if (stored) {
      c.deviceId = stored.deviceId;
      c.role = stored.role;
      c.keys = { signSecret: fromB64(stored.signSecret), signPublic: fromB64(stored.signPublic), boxSecret: fromB64(stored.boxSecret), boxPublic: fromB64(stored.boxPublic) };
    } else {
      c.deviceId = `dev-${newId(4)}`;
      c.keys = newDeviceKeys();
      await c.saveIdentity();
    }
    const cs = await loadSecret<CircleStored>(c.db, c.vault, 'circle');
    if (cs) c.circle = { id: cs.id, key: fromB64(cs.key), peers: cs.peers, sent: cs.sent, relay: cs.relay };
    c.local = (await loadSecret<Record<string, unknown>>(c.db, c.vault, 'local')) ?? {};
    c.replica = new Replica(c.deviceId, dexiePersistence(c.db, c.vault));
    await c.replica.open();
    c.replica.subscribe(() => c.bump());
    return c;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  bump(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  private async saveIdentity(): Promise<void> {
    const k = this.keys;
    const s: IdentityStored = { deviceId: this.deviceId, role: this.role, signSecret: toB64(k.signSecret), signPublic: toB64(k.signPublic), boxSecret: toB64(k.boxSecret), boxPublic: toB64(k.boxPublic) };
    await saveSecret(this.db, this.vault, 'identity', s);
  }

  private async saveCircle(): Promise<void> {
    if (!this.circle) return;
    const c: CircleStored = { id: this.circle.id, key: toB64(this.circle.key), peers: this.circle.peers, sent: this.circle.sent, relay: this.circle.relay };
    await saveSecret(this.db, this.vault, 'circle', c);
  }

  getLocal<T>(name: string, fallback: T): T {
    return name in this.local ? (this.local[name] as T) : fallback;
  }

  async putLocal(name: string, value: unknown): Promise<void> {
    this.local = { ...this.local, [name]: value };
    await saveSecret(this.db, this.vault, 'local', this.local);
    this.bump();
  }

  async setRole(role: Role): Promise<void> {
    this.role = role;
    await this.saveIdentity();
    this.bump();
  }

  /** Caregiver side: start a new care circle on this device. */
  async createCircle(): Promise<void> {
    if (this.circle) return;
    this.circle = { id: `c-${newId(6)}`, key: newCircleKey(), peers: [], sent: {} };
    await this.saveCircle();
    this.bump();
  }

  offerText(name: string): string {
    if (!this.circle) throw new Error('No circle yet');
    return makeOffer(this.circle.id, this.keys.signPublic, this.keys.boxPublic, name);
  }

  /** New device side: answer an offer. Returns the accept message to show as a QR. */
  acceptText(offerText: string, name: string, role: PairAccept['role']): { text: string; circleId: string; peer: Peer } {
    const offer = parsePairing(offerText);
    if (!offer || offer.t !== 'offer') throw new Error('That code is not a Hillpath pairing offer.');
    return {
      text: makeAccept(this.deviceId, this.keys.signPublic, this.keys.boxPublic, name, role),
      circleId: offer.circle,
      peer: { device: 'caregiver', name: offer.name, role: 'caregiver', sign: offer.sign, box: offer.box },
    };
  }

  /** Caregiver side: take a device's accept message and produce the sealed key message. */
  async admit(acceptText: string): Promise<{ keyText: string; peer: Peer }> {
    if (!this.circle) throw new Error('No circle yet');
    const a = parsePairing(acceptText);
    if (!a || a.t !== 'accept') throw new Error('That code is not a Hillpath pairing reply.');
    const peer: Peer = { device: a.device, name: a.name, role: a.role, sign: a.sign, box: a.box };
    this.circle.peers = [...this.circle.peers.filter((p) => p.device !== peer.device), peer];
    await this.saveCircle();
    this.bump();
    return { keyText: makeKey(this.circle.id, this.circle.key, a), peer };
  }

  /** New device side: open the sealed key and join. */
  async join(keyText: string, caregiver: Peer): Promise<void> {
    const k = parsePairing(keyText);
    if (!k || k.t !== 'key') throw new Error('That code is not a Hillpath key message.');
    const key = openKey(k, this.deviceId, this.keys.boxSecret);
    this.circle = { id: k.circle, key, peers: [caregiver], sent: {} };
    await this.saveCircle();
    this.bump();
  }

  /** Drop a device and rotate the circle key so it cannot read anything new. */
  async removePeer(device: string): Promise<void> {
    if (!this.circle) return;
    this.circle = { ...this.circle, key: newCircleKey(), peers: this.circle.peers.filter((p) => p.device !== device) };
    await this.saveCircle();
    this.bump();
  }

  // ---------- envelopes ----------

  private requireCircle(): Circle {
    if (!this.circle) throw new SyncError('This device is not in a care circle yet.');
    return this.circle;
  }

  /** One signed, encrypted envelope of the ops the given vector has not seen. */
  envelopeFor(vector: Record<string, string>): { wire: EnvelopeWire; count: number } {
    const c = this.requireCircle();
    const ops = this.replica.missingFor(vector);
    const env = sealEnvelope({ circle: c.id, circleKey: c.key, from: this.deviceId, signSecret: this.keys.signSecret, ops, vector: this.replica.vector() });
    return { wire: { ...env, senderSign: toB64(this.keys.signPublic), drop: relayDropToken(c.key) }, count: ops.length };
  }

  /** Text for the QR frames: gzip of one envelope. */
  async shareText(all = false): Promise<{ text: string; count: number }> {
    const c = this.requireCircle();
    const { wire, count } = this.envelopeFor(all ? {} : (c.sent['*'] ?? {}));
    return { text: await gzipToB64(JSON.stringify(wire)), count };
  }

  async markShared(): Promise<void> {
    if (!this.circle) return;
    this.circle.sent['*'] = this.replica.vector();
    await this.saveCircle();
  }

  /** Apply one envelope. Throws a readable error when it does not fit this circle. */
  applyEnvelope(env: EnvelopeWire): number {
    const c = this.requireCircle();
    if (env.circle !== c.id) throw new SyncError('This code is for a different care circle.');
    const peer = c.peers.find((p) => p.device === env.from);
    const signPublic = peer ? fromB64(peer.sign) : env.senderSign ? fromB64(env.senderSign) : null;
    if (!signPublic) throw new SyncError('This code is from a device that is not paired here.');
    const { ops } = openEnvelope({ envelope: env, circleKey: c.key, senderSignPublic: signPublic });
    return this.replica.apply(ops).length;
  }

  /** Apply what arrived by QR, which is one envelope or a bundle from a courier. */
  async receiveText(packed: string): Promise<number> {
    const raw = JSON.parse(await gunzipFromB64(packed)) as EnvelopeWire | EnvelopeWire[];
    const list = Array.isArray(raw) ? raw : [raw];
    let n = 0;
    for (const e of list) n += this.applyEnvelope(e);
    return n;
  }

  // ---------- courier: carry ciphertext for other families ----------

  /** Keep an envelope for a circle this device is not in. It cannot be read here. */
  async courierReceive(packed: string): Promise<{ circle: string }> {
    const raw = JSON.parse(await gunzipFromB64(packed)) as EnvelopeWire | EnvelopeWire[];
    const list = Array.isArray(raw) ? raw : [raw];
    let circle = '';
    for (const e of list) {
      if (!Envelope.safeParse(e).success) throw new SyncError('That code is not a Hillpath share.');
      if (this.circle && e.circle === this.circle.id) throw new SyncError('That share is for this device\'s own family. Use Receive records instead.');
      circle = e.circle;
      await this.db.meta.put({ key: `courier:${e.circle}:${e.nonce}`, value: JSON.stringify(e) });
    }
    return { circle };
  }

  async courierSummary(): Promise<Array<{ circle: string; count: number; bytes: number }>> {
    const rows = (await this.db.meta.toArray()).filter((r) => r.key.startsWith('courier:'));
    const by = new Map<string, { count: number; bytes: number }>();
    for (const r of rows) {
      const circle = r.key.split(':')[1]!;
      const cur = by.get(circle) ?? { count: 0, bytes: 0 };
      by.set(circle, { count: cur.count + 1, bytes: cur.bytes + String(r.value).length });
    }
    return [...by.entries()].map(([circle, v]) => ({ circle, ...v }));
  }

  private async courierRows(circle: string) {
    return (await this.db.meta.toArray()).filter((r) => r.key.startsWith(`courier:${circle}:`));
  }

  /** The carried envelopes for one circle as QR text, to hand to a device of that family. */
  async courierBundle(circle: string): Promise<string> {
    const rows = await this.courierRows(circle);
    return gzipToB64(JSON.stringify(rows.map((r) => JSON.parse(String(r.value)))));
  }

  /** Deliver carried envelopes to a relay with the write-only drop token. Delivered ones are removed. */
  async courierDeliver(circle: string, origin: string): Promise<number> {
    const rows = await this.courierRows(circle);
    let sent = 0;
    for (const r of rows) {
      const env = JSON.parse(String(r.value)) as EnvelopeWire;
      if (!env.drop) throw new SyncError('This share has no delivery token, so it can only be handed over by scanning.');
      const res = await this.http(`${origin.replace(/\/$/, '')}/v1/circles/${circle}/drop`, { method: 'POST', headers: { Authorization: `Bearer ${env.drop}`, 'Content-Type': 'application/json' }, body: JSON.stringify(env) });
      if (res.status === 401) throw new SyncError('The family server did not accept this delivery.');
      if (!res.ok) throw new SyncError('The family server could not take this delivery. Try again later.');
      await this.db.meta.delete(r.key);
      sent += 1;
    }
    return sent;
  }

  // ---------- relay ----------

  private async http(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new SyncError('The family server cannot be reached. Your data is safe on this phone.');
    }
  }

  async setRelay(origin: string): Promise<void> {
    const c = this.requireCircle();
    const clean = origin.trim().replace(/\/$/, '');
    if (!/^https?:\/\/[^\s]+$/.test(clean)) throw new SyncError('That server address does not look right. It should start with http:// or https://.');
    c.relay = { origin: clean, cursor: c.relay?.origin === clean ? c.relay.cursor : 0, pushed: c.relay?.origin === clean ? c.relay.pushed : {} };
    await this.saveCircle();
    this.bump();
  }

  /** Send what the server has not seen, then fetch what other devices sent. Returns counts. */
  async relaySync(): Promise<{ sent: number; received: number }> {
    const c = this.requireCircle();
    if (!c.relay) throw new SyncError('No server address is set.');
    const base = `${c.relay.origin}/v1/circles/${c.id}`;
    const auth = { Authorization: `Bearer ${relayBearer(c.key)}` };
    let sent = 0;
    const { wire, count } = this.envelopeFor(c.relay.pushed);
    if (count > 0) {
      const res = await this.http(`${base}/envelopes`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'X-Drop-Hash': bearerHash(relayDropToken(c.key)) }, body: JSON.stringify(wire) });
      if (res.status === 401) throw new SyncError('The family server did not accept this device. Check the server address.');
      if (!res.ok) throw new SyncError('The family server could not take these records. Try again later.');
      c.relay.pushed = this.replica.vector();
      sent = count;
    }
    let received = 0;
    for (let page = 0; page < 40; page++) {
      const res = await this.http(`${base}/envelopes?after=${c.relay.cursor}`, { headers: auth });
      if (res.status === 401) break; // Nothing has been written to this circle yet.
      if (!res.ok) throw new SyncError('The family server could not be read. Try again later.');
      const { envelopes } = (await res.json()) as { envelopes: Array<{ cursor: number; envelope: string }> };
      if (envelopes.length === 0) break;
      for (const row of envelopes) {
        const env = JSON.parse(row.envelope) as EnvelopeWire;
        if (env.from !== this.deviceId) {
          try {
            received += this.applyEnvelope(env);
          } catch {
            // An envelope from a removed device or under an older key is skipped, not fatal.
          }
        }
        c.relay.cursor = row.cursor;
      }
    }
    await this.saveCircle();
    this.bump();
    return { sent, received };
  }

  // ---------- media ----------

  saveMedia(id: string, blob: Blob) {
    return putBlob(this.db, this.vault, id, blob);
  }
  loadMedia(id: string) {
    return getBlob(this.db, this.vault, id);
  }
  hasMedia(id: string) {
    return hasBlob(this.db, id);
  }
}
