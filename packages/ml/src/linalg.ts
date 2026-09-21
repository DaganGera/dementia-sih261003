export type Vec = number[];
export type Mat = number[][];

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function identity(n: number, s = 1): Mat {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? s : 0)));
}

export function copyMat(m: Mat): Mat {
  return m.map((r) => [...r]);
}

/** Mulberry32, so tests and simulations are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function cholesky(m: Mat): Mat {
  const n = m.length;
  const l: Mat = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i]![j]!;
      for (let k = 0; k < j; k++) s -= l[i]![k]! * l[j]![k]!;
      l[i]![j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / l[j]![j]!;
    }
  }
  return l;
}

export function sampleMvn(mu: Vec, cov: Mat, r: () => number): Vec {
  const l = cholesky(cov);
  const z = mu.map(() => normal(r));
  return mu.map((m, i) => m + l[i]!.reduce((s, v, k) => s + v * z[k]!, 0));
}
