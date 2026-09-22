import type { AppCore } from './core';

/** Postcards: a short voice message with an optional photo, from family who live far away. The audio travels inside the record, so it syncs like any other. */
export interface Postcard {
  id: string;
  from: string;
  text: string;
  /** base64 of the audio, at most about 60 KB. */
  audio: string;
  mime: string;
  thumb?: string;
  at: number;
  heardAt: number | null;
}

export const MAX_POSTCARD_AUDIO_B64 = 80_000;
export const MAX_POSTCARD_SECONDS = 15;

export function listPostcards(core: AppCore): Postcard[] {
  return core.replica
    .list('postcard')
    .map((r) => ({
      id: r.id,
      from: String(r.from ?? ''),
      text: String(r.text ?? ''),
      audio: String(r.audio ?? ''),
      mime: String(r.mime ?? 'audio/webm'),
      thumb: typeof r.thumb === 'string' ? r.thumb : undefined,
      at: Number(r.at ?? 0),
      heardAt: r.heard_at ? Number(r.heard_at) : null,
    }))
    .sort((a, b) => b.at - a.at);
}

export function savePostcard(core: AppCore, p: Omit<Postcard, 'id' | 'heardAt' | 'at'>): string {
  const id = `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  core.replica.insert('postcard', id, { from: p.from, text: p.text, audio: p.audio, mime: p.mime, ...(p.thumb ? { thumb: p.thumb } : {}), at: Date.now(), heard_at: null });
  return id;
}

export function markHeard(core: AppCore, id: string): void {
  core.replica.set('postcard', id, { heard_at: Date.now() });
}

export async function blobToB64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type: mime });
}

/** Record a short low-bitrate voice message. Call `stop` to finish early. */
export async function recordPostcardAudio(maxSeconds = MAX_POSTCARD_SECONDS): Promise<{ stop: () => void; done: Promise<{ b64: string; mime: string }> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, { audioBitsPerSecond: 12_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<{ b64: string; mime: string }>((resolve) => {
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      resolve({ b64: await blobToB64(blob), mime: blob.type });
    };
  });
  rec.start();
  const timer = window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxSeconds * 1000);
  return {
    stop: () => {
      window.clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
    },
    done,
  };
}

// ---------- play together ----------

/** A round of Find It that both devices see the same way, because the seed decides every picture. */
export interface CoPlay {
  id: string;
  from: string;
  seed: number;
  at: number;
  playedAt: number | null;
  found: number;
  total: number;
}

export function listCoPlay(core: AppCore): CoPlay[] {
  return core.replica
    .list('coplay')
    .map((r) => ({ id: r.id, from: String(r.from ?? ''), seed: Number(r.seed), at: Number(r.at ?? 0), playedAt: r.played_at ? Number(r.played_at) : null, found: Number(r.found ?? 0), total: Number(r.total ?? 0) }))
    .sort((a, b) => b.at - a.at);
}

export function inviteCoPlay(core: AppCore, from: string): CoPlay {
  const id = `cp-${Date.now().toString(36)}`;
  const seed = Math.floor(Math.random() * 1_000_000) + 1;
  core.replica.insert('coplay', id, { from, seed, at: Date.now(), played_at: null, found: 0, total: 0 });
  return { id, from, seed, at: Date.now(), playedAt: null, found: 0, total: 0 };
}

export function finishCoPlay(core: AppCore, id: string, found: number, total: number): void {
  core.replica.set('coplay', id, { played_at: Date.now(), found, total });
}
