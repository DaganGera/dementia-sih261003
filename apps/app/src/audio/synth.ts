/**
 * Everyday sounds made from oscillators and noise, so there are no recordings and no rights to clear.
 * Each recipe schedules its nodes on any audio context, which lets tests render them offline.
 */
export type SoundId = 'bell' | 'rain' | 'kettle' | 'clock' | 'knock' | 'drip' | 'wind' | 'bird';

export const SOUND_LABELS: Record<SoundId, string> = {
  bell: 'a bell',
  rain: 'rain',
  kettle: 'a kettle whistling',
  clock: 'a ticking clock',
  knock: 'a knock at the door',
  drip: 'dripping water',
  wind: 'wind',
  bird: 'a bird singing',
};

/** Sounds that are alike each other. Used to pick harder or easier wrong answers. */
export const SOUND_GROUPS: SoundId[][] = [
  ['rain', 'drip', 'wind'],
  ['clock', 'knock', 'bell'],
  ['bird', 'kettle'],
];

function noise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function envelope(ctx: BaseAudioContext, g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, peak: number, attack: number, decay: number, type: OscillatorType = 'sine', freqEnd?: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
  envelope(ctx, g, t, peak, attack, decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** Schedules the sound starting at `when` seconds and returns its length in seconds. */
export function scheduleSound(id: SoundId, ctx: BaseAudioContext, dest: AudioNode, when = 0): number {
  const t = ctx.currentTime + when;
  switch (id) {
    case 'bell': {
      for (const [mult, peak] of [[1, 0.5], [2.76, 0.25], [5.4, 0.12]] as const) tone(ctx, dest, t, 523 * mult, peak, 0.005, 2.2 / mult + 0.4);
      return 2.6;
    }
    case 'rain': {
      const src = noise(ctx, 2.4);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 4200;
      f.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.3);
      g.gain.linearRampToValueAtTime(0.35, t + 2.0);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
      src.connect(f).connect(g).connect(dest);
      src.start(t);
      return 2.4;
    }
    case 'kettle': {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1900, t);
      lfo.frequency.value = 7;
      lg.gain.value = 60;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.4);
      g.gain.linearRampToValueAtTime(0.28, t + 1.8);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g).connect(dest);
      o.start(t);
      lfo.start(t);
      o.stop(t + 2.3);
      lfo.stop(t + 2.3);
      return 2.2;
    }
    case 'clock': {
      for (let i = 0; i < 6; i++) tone(ctx, dest, t + i * 0.5, i % 2 ? 1800 : 2200, 0.35, 0.001, 0.05, 'square');
      return 3;
    }
    case 'knock': {
      for (const dt of [0, 0.28, 0.56]) tone(ctx, dest, t + dt, 110, 0.7, 0.002, 0.16, 'sine', 60);
      return 0.9;
    }
    case 'drip': {
      for (const dt of [0, 0.8, 1.7]) tone(ctx, dest, t + dt, 1100, 0.4, 0.004, 0.09, 'sine', 420);
      return 2;
    }
    case 'wind': {
      const src = noise(ctx, 3);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(300, t);
      f.frequency.linearRampToValueAtTime(900, t + 1.5);
      f.frequency.linearRampToValueAtTime(300, t + 3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.4, t + 1);
      g.gain.linearRampToValueAtTime(0.0001, t + 3);
      src.connect(f).connect(g).connect(dest);
      src.start(t);
      return 3;
    }
    case 'bird': {
      for (const [dt, a, b] of [[0, 2400, 3600], [0.22, 2800, 3800], [0.44, 2500, 3900], [1.0, 3000, 2200]] as const) tone(ctx, dest, t + dt, a, 0.3, 0.01, 0.16, 'sine', b);
      return 1.4;
    }
  }
}

let shared: AudioContext | null = null;

export function playSound(id: SoundId): number {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  shared ??= new Ctx();
  void shared.resume();
  return scheduleSound(id, shared, shared.destination, 0.02);
}

/** Three short original tunes for Song Circle. Pentatonic, so they always sound pleasant. */
export const TUNES: Array<{ id: string; title: string; notes: number[]; beat: number }> = [
  { id: 'hum-morning', title: 'Morning tune', notes: [0, 2, 4, 7, 4, 2, 0, -3], beat: 0.5 },
  { id: 'hum-evening', title: 'Evening tune', notes: [7, 4, 2, 4, 0, 2, -3, 0], beat: 0.6 },
  { id: 'hum-rain', title: 'Rainy day tune', notes: [4, 4, 7, 4, 2, 0, 2, 0], beat: 0.55 },
];

export function scheduleTune(ctx: BaseAudioContext, dest: AudioNode, notes: number[], beat: number, when = 0): number {
  const base = 261.63;
  notes.forEach((n, i) => tone(ctx, dest, ctx.currentTime + when + i * beat, base * 2 ** (n / 12), 0.35, 0.02, beat * 0.9, 'triangle'));
  return notes.length * beat;
}

export function playTune(index: number): number {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  shared ??= new Ctx();
  void shared.resume();
  const t = TUNES[index % TUNES.length]!;
  return scheduleTune(shared, shared.destination, [...t.notes, ...t.notes], t.beat, 0.02);
}
