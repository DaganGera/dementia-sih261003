import type { Role } from '@hillpath/contracts';
import {
  Replica,
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

interface CircleStored {
  id: string;
  key: string;
  peers: Peer[];
  sent: Record<string, Record<string, string>>;
}

export interface Circle {
  id: string;
  key: Uint8Array;
  peers: Peer[];
  sent: Record<string, Record<string, string>>;
}

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
    if (cs) c.circle = { id: cs.id, key: fromB64(cs.key), peers: cs.peers, sent: cs.sent };
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
    const c: CircleStored = { id: this.circle.id, key: toB64(this.circle.key), peers: this.circle.peers, sent: this.circle.sent };
    await saveSecret(this.db, this.vault, 'circle', c);
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
    this.pendingCircleId = offer.circle;
    return {
      text: makeAccept(this.deviceId, this.keys.signPublic, this.keys.boxPublic, name, role),
      circleId: offer.circle,
      peer: { device: 'caregiver', name: offer.name, role: 'caregiver', sign: offer.sign, box: offer.box },
    };
  }
  pendingCircleId: string | null = null;
  pendingPeer: Peer | null = null;

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

  /** Text for the QR pages: gzip of one signed, encrypted envelope of ops the peer has not been sent. */
  async shareText(all = false): Promise<{ text: string; count: number }> {
    if (!this.circle) throw new Error('This device is not in a care circle yet.');
    const vec = all ? {} : (this.circle.sent['*'] ?? {});
    const ops = this.replica.missingFor(vec);
    const env = sealEnvelope({ circle: this.circle.id, circleKey: this.circle.key, from: this.deviceId, signSecret: this.keys.signSecret, ops, vector: this.replica.vector() });
    return { text: await gzipToB64(JSON.stringify({ ...env, senderSign: toB64(this.keys.signPublic) })), count: ops.length };
  }

  async markShared(): Promise<void> {
    if (!this.circle) return;
    this.circle.sent['*'] = this.replica.vector();
    await this.saveCircle();
  }

  /** Apply an envelope that arrived by QR or relay. Throws a readable error when it does not fit this circle. */
  async receiveText(packed: string): Promise<number> {
    if (!this.circle) throw new Error('This device is not in a care circle yet.');
    const env = JSON.parse(await gunzipFromB64(packed)) as { from: string; senderSign?: string; circle: string };
    if (env.circle !== this.circle.id) throw new Error('This code is for a different care circle.');
    const peer = this.circle.peers.find((p) => p.device === env.from);
    const signPublic = peer ? fromB64(peer.sign) : env.senderSign ? fromB64(env.senderSign) : null;
    if (!signPublic) throw new Error('This code is from a device that is not paired here.');
    const { ops } = openEnvelope({ envelope: env, circleKey: this.circle.key, senderSignPublic: signPublic });
    return this.replica.apply(ops).length;
  }

  // Media: encrypted blobs stored on device. Not synced in this build.
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
