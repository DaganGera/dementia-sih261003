/**
 * Neutral geometric weave tiles. They are not copies of any community's textile.
 * Regional textile motifs (gamosa borders, phanek stripes, Naga shawl bands) need community review first,
 * see content/cultural-register.json.
 */
export type Shape = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross' | 'bars';

export interface Tile {
  shape: Shape;
  /** Index into PALETTE. */
  color: number;
}

export const PALETTE = ['#1B5E45', '#B5651D', '#5A5A5A', '#C9A227'] as const;
export const PALETTE_NAMES = ['green', 'brown', 'grey', 'gold'] as const;
const SHAPES: Shape[] = ['circle', 'square', 'diamond', 'triangle', 'cross', 'bars'];

const RULES: Record<number, number[][]> = {
  2: [[0, 1], [0, 0, 1]],
  3: [[0, 1, 2], [0, 0, 1, 2], [0, 1, 1, 2]],
  4: [[0, 1, 2, 3], [0, 1, 0, 2, 3]],
};

export interface Weave {
  shown: Tile[];
  answer: Tile;
  options: Tile[];
}

export const tileKey = (t: Tile) => `${t.shape}-${t.color}`;
export const tileLabel = (t: Tile) => `${PALETTE_NAMES[t.color]} ${t.shape === 'bars' ? 'bars' : t.shape}`;

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * A repeating pattern of `length` tiles with `motifs` different tiles. The last tile is hidden.
 * Wrong options are other tiles, some of which already appear in the pattern.
 */
export function makeWeave(length: number, motifs: number, options: number, rand: () => number): Weave {
  const m = Math.min(4, Math.max(2, motifs));
  const shapes = shuffle(SHAPES, rand).slice(0, m);
  const colors = shuffle([0, 1, 2, 3], rand).slice(0, m);
  const tiles: Tile[] = shapes.map((shape, i) => ({ shape, color: colors[i]! }));
  const rules = RULES[m]!;
  const rule = rules[Math.floor(rand() * rules.length)]!;
  const seq = Array.from({ length }, (_, i) => tiles[rule[i % rule.length]!]!);
  const answer = seq[length - 1]!;
  const shown = seq.slice(0, length - 1);
  const pool: Tile[] = [...tiles.filter((t) => tileKey(t) !== tileKey(answer))];
  while (pool.length < options - 1) {
    const extra: Tile = { shape: SHAPES[Math.floor(rand() * SHAPES.length)]!, color: Math.floor(rand() * 4) };
    if (tileKey(extra) !== tileKey(answer) && !pool.some((p) => tileKey(p) === tileKey(extra))) pool.push(extra);
  }
  const wrong = shuffle(pool, rand).slice(0, options - 1);
  return { shown, answer, options: shuffle([answer, ...wrong], rand) };
}
