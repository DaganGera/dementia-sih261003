/**
 * Hybrid logical clock. Timestamps are strings that sort in causal order:
 * `<wall ms, 15 digits>-<counter, 5 digits>-<device>`.
 */
export interface HlcState {
  wall: number;
  counter: number;
}

const pad = (n: number, w: number) => n.toString().padStart(w, '0');

export function formatHlc(s: HlcState, device: string): string {
  return `${pad(s.wall, 15)}-${pad(s.counter, 5)}-${device}`;
}

export function parseHlc(h: string): { wall: number; counter: number; device: string } {
  const [w, c, ...rest] = h.split('-');
  return { wall: Number(w), counter: Number(c), device: rest.join('-') };
}

export class Hlc {
  private state: HlcState = { wall: 0, counter: 0 };
  constructor(
    readonly device: string,
    private readonly now: () => number = () => Date.now(),
    private readonly maxDriftMs = 24 * 3600 * 1000,
  ) {}

  /** Next timestamp for a local event. */
  tick(): string {
    const t = this.now();
    if (t > this.state.wall) this.state = { wall: t, counter: 0 };
    else this.state = { wall: this.state.wall, counter: this.state.counter + 1 };
    return formatHlc(this.state, this.device);
  }

  /** Merge a remote timestamp; rejects clocks that run too far ahead. */
  receive(remote: string): void {
    const r = parseHlc(remote);
    const t = this.now();
    if (r.wall - t > this.maxDriftMs) throw new Error('Remote clock is too far ahead');
    const wall = Math.max(this.state.wall, r.wall, t);
    let counter = 0;
    if (wall === this.state.wall && wall === r.wall) counter = Math.max(this.state.counter, r.counter) + 1;
    else if (wall === this.state.wall) counter = this.state.counter + 1;
    else if (wall === r.wall) counter = r.counter + 1;
    this.state = { wall, counter };
  }
}
