import { gunzipFromB64, gzipToB64 } from '@hillpath/core';
import type { AppCore, EnvelopeWire } from './core';
import { SyncError } from './core';

/**
 * Sync between two devices on the same Wi-Fi or hotspot with no internet: the two exchange a connection description by QR,
 * then talk directly over a WebRTC data channel. No relay and no STUN server is used, so only devices on the same network can connect.
 * The records themselves are the same signed, encrypted envelopes as everywhere else.
 */
const CHUNK = 12_000;
const TIMEOUT_MS = 25_000;

async function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, 4000);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(t);
        resolve();
      }
    });
  });
}

const pack = (kind: 'offer' | 'answer', sdp: string) => gzipToB64(JSON.stringify({ t: `lan-${kind}`, sdp }));

async function unpack(text: string, kind: 'offer' | 'answer'): Promise<string> {
  let o: { t?: string; sdp?: string };
  try {
    o = JSON.parse(await gunzipFromB64(text)) as typeof o;
  } catch {
    throw new SyncError('That code is not a nearby-connection code.');
  }
  if (o.t !== `lan-${kind}` || typeof o.sdp !== 'string') throw new SyncError(`That code is not a nearby-connection ${kind}.`);
  return o.sdp;
}

export interface Host {
  text: string;
  finish(answerText: string): Promise<RTCDataChannel>;
  close(): void;
}

/** First device: make the offer. Show `text` as a QR, then scan the other device's reply into `finish`. */
export async function lanHost(): Promise<Host> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel('hillpath');
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return {
    text: await pack('offer', pc.localDescription!.sdp),
    async finish(answerText) {
      await pc.setRemoteDescription({ type: 'answer', sdp: await unpack(answerText, 'answer') });
      return opened(channel);
    },
    close: () => pc.close(),
  };
}

export interface Guest {
  text: string;
  channel: Promise<RTCDataChannel>;
  close(): void;
}

/** Second device: take the offer, make the reply, and wait for the channel. */
export async function lanJoin(offerText: string): Promise<Guest> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = new Promise<RTCDataChannel>((resolve) => {
    pc.ondatachannel = (e) => resolve(opened(e.channel));
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: await unpack(offerText, 'offer') });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return { text: await pack('answer', pc.localDescription!.sdp), channel, close: () => pc.close() };
}

function opened(ch: RTCDataChannel): Promise<RTCDataChannel> {
  if (ch.readyState === 'open') return Promise.resolve(ch);
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new SyncError('The two devices could not connect. Check that both are on the same Wi-Fi or hotspot.')), TIMEOUT_MS);
    ch.addEventListener('open', () => {
      window.clearTimeout(t);
      resolve(ch);
    });
    ch.addEventListener('error', () => reject(new SyncError('The nearby connection failed.')));
  });
}

/** Trade version vectors, then send each other the records the other is missing. Both sides call this. */
export function lanExchange(core: AppCore, ch: RTCDataChannel): Promise<{ sent: number; received: number }> {
  return new Promise((resolve, reject) => {
    let sent = -1;
    let received = -1;
    const buffers = new Map<string, string[]>();
    const timer = window.setTimeout(() => reject(new SyncError('The exchange took too long. Try again.')), TIMEOUT_MS);
    const done = () => {
      if (sent >= 0 && received >= 0) {
        window.clearTimeout(timer);
        resolve({ sent, received });
      }
    };
    const sendEnvelope = (vector: Record<string, string>) => {
      const { wire, count } = core.envelopeFor(vector);
      const json = JSON.stringify(wire);
      const id = Math.random().toString(36).slice(2, 8);
      const parts = Math.max(1, Math.ceil(json.length / CHUNK));
      for (let i = 0; i < parts; i++) ch.send(JSON.stringify({ t: 'chunk', id, i, n: parts, data: json.slice(i * CHUNK, (i + 1) * CHUNK) }));
      sent = count;
      done();
    };
    ch.addEventListener('message', (e) => {
      try {
        const m = JSON.parse(String(e.data)) as { t: string; v?: Record<string, string>; id?: string; i?: number; n?: number; data?: string };
        if (m.t === 'vector' && m.v) sendEnvelope(m.v);
        else if (m.t === 'chunk' && m.id !== undefined && m.n !== undefined && m.i !== undefined && m.data !== undefined) {
          const arr = buffers.get(m.id) ?? [];
          arr[m.i] = m.data;
          buffers.set(m.id, arr);
          if (arr.filter(Boolean).length === m.n) {
            received = core.applyEnvelope(JSON.parse(arr.join('')) as EnvelopeWire);
            done();
          }
        }
      } catch (err) {
        window.clearTimeout(timer);
        reject(err instanceof SyncError ? err : new SyncError('The other device sent something that could not be used.'));
      }
    });
    ch.send(JSON.stringify({ t: 'vector', v: core.replica.vector() }));
  });
}
