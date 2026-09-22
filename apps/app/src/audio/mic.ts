import { resampleTo16k, SAMPLE_RATE } from '@hillpath/audio';

export interface Recording {
  samples: Float32Array;
  /** Samples at 16 kHz. */
  rate: number;
  /** Milliseconds from the start of recording until the recording stopped. */
  ms: number;
}

export interface RecordOptions {
  maxMs: number;
  /** Stop this long after speech, once speech has been heard. */
  stopAfterSilenceMs?: number;
  /** Give up waiting for speech to begin after this long. */
  waitForSpeechMs?: number;
  onLevel?: (db: number) => void;
}

const SPEECH_MARGIN_DB = 9;

/**
 * Record from the microphone, resample to 16 kHz and stop by itself. Nothing is kept: the caller decides what to store,
 * and for speech timing only the timing numbers are stored.
 */
export async function recordUtterance(o: RecordOptions): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, channelCount: 1 } });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const chunks: Float32Array[] = [];
  const t0 = performance.now();
  let floor = Infinity;
  let heard = false;
  let lastSpeech = 0;

  return new Promise<Recording>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      proc.disconnect();
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const all = new Float32Array(total);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.length;
      }
      const rate = ctx.sampleRate;
      void ctx.close();
      resolve({ samples: resampleTo16k(all, rate), rate: SAMPLE_RATE, ms: performance.now() - t0 });
    };
    proc.onaudioprocess = (e) => {
      const x = new Float32Array(e.inputBuffer.getChannelData(0));
      chunks.push(x);
      let energy = 0;
      for (let i = 0; i < x.length; i++) energy += x[i]! * x[i]!;
      const db = 10 * Math.log10(energy / x.length + 1e-12);
      o.onLevel?.(db);
      const elapsed = performance.now() - t0;
      if (elapsed < 300) floor = Math.min(floor, db);
      else {
        floor = Math.min(floor, db + 3);
        if (db > Math.max(floor + SPEECH_MARGIN_DB, -52)) {
          heard = true;
          lastSpeech = elapsed;
        }
      }
      if (elapsed >= o.maxMs) finish();
      else if (heard && o.stopAfterSilenceMs && elapsed - lastSpeech > o.stopAfterSilenceMs) finish();
      else if (!heard && o.waitForSpeechMs && elapsed > o.waitForSpeechMs) finish();
    };
    src.connect(proc);
    proc.connect(mute).connect(ctx.destination);
  });
}
