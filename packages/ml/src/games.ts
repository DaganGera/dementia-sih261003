import type { Domain, ScoredGameId } from '@hillpath/contracts';

/** Difficulty weights below are assumed values (Simulated). They are refit only when real trials exist. */
export type Design = Record<string, number>;

export interface Level {
  design: Design;
  /** Item difficulty on the ability scale. */
  b: number;
  /** Chance-level success for this design. */
  chance: number;
  /** Plain-language description for "why this level". */
  label: string;
}

export interface GameSpec {
  id: ScoredGameId;
  title: string;
  domain: Domain;
  /** Slope of the response curve. */
  a: number;
  levels: Level[];
}

interface Raw {
  design: Design;
  chance: number;
  label: string;
}

function build(id: ScoredGameId, title: string, domain: Domain, a: number, intercept: number, w: Design, raw: Raw[]): GameSpec {
  const levels = raw
    .map((r) => ({ ...r, b: intercept + Object.entries(w).reduce((s, [k, v]) => s + v * (r.design[k] ?? 0), 0) }))
    .sort((x, y) => x.b - y.b);
  return { id, title, domain, a, levels };
}

const g1 = [
  [2, 0, 6], [3, 0, 5], [3, 1, 4], [4, 1, 3], [5, 1, 3], [6, 1, 2], [6, 2, 2], [8, 2, 1],
].map(([pairs, similarity, preview_s]) => ({
  design: { pairs: pairs!, similarity: similarity!, preview_s: preview_s! },
  chance: 1 / (2 * pairs! - 1),
  label: `${pairs} pairs`,
}));

const g2 = [
  [2, 2, 0], [2, 1, 1], [3, 1, 1], [3, 0, 2], [4, 1, 2], [4, 0, 3], [4, 0, 4],
].map(([options, cue, interval]) => ({
  design: { options: options!, cue: cue!, interval: interval! },
  chance: 1 / options!,
  label: `${options} faces to choose from`,
}));

const g3 = [
  [2, 2, 0], [3, 2, 0], [3, 3, 0], [4, 3, 1], [4, 4, 1], [5, 4, 2], [6, 4, 2],
].map(([sentences, options, delay]) => ({
  design: { sentences: sentences!, options: options!, delay: delay! },
  chance: 1 / options!,
  label: `a story of ${sentences} sentences`,
}));

const g4 = [
  [3, 2, 2], [3, 3, 2], [4, 3, 2], [4, 3, 1], [5, 3, 1], [5, 4, 1], [6, 4, 0],
].map(([steps, options, hint]) => ({
  design: { steps: steps!, options: options!, hint: hint! },
  chance: 1 / options!,
  label: `${steps} steps`,
}));

const g7 = [
  [4, 0], [6, 0], [8, 1], [10, 1], [12, 1], [14, 2], [16, 2],
].map(([set_size, similarity]) => ({
  design: { set_size: set_size!, similarity: similarity! },
  chance: 1 / set_size!,
  label: `${set_size} things to look through`,
}));

const g5 = [
  [2, 0, 1], [2, 1, 1], [3, 0, 1], [3, 1, 0], [3, 2, 0], [4, 1, 0], [4, 2, 0],
].map(([options, similarity, cue]) => ({
  design: { options: options!, similarity: similarity!, cue: cue! },
  chance: 1 / options!,
  label: `${options} pictures to choose from`,
}));

const g6 = [
  [3, 2, 2], [4, 2, 2], [4, 2, 3], [5, 3, 3], [5, 3, 4], [6, 3, 4], [6, 4, 4],
].map(([length, motifs, options]) => ({
  design: { length: length!, motifs: motifs!, options: options! },
  chance: 1 / options!,
  label: `a pattern of ${length} tiles`,
}));

const g8 = [
  [2, 2], [2, 1], [3, 1], [3, 0], [4, 1], [4, 0],
].map(([options, cue]) => ({
  design: { options: options!, cue: cue! },
  chance: 1 / options!,
  label: `${options} places to choose from`,
}));

export const GAMES: Record<ScoredGameId, GameSpec> = {
  G1: build('G1', 'Pairs at Home', 'visual_memory', 1.2, -2.4, { pairs: 0.45, similarity: 0.5, preview_s: -0.15 }, g1),
  G2: build('G2', 'Faces and Names', 'associative_memory', 1.1, -1.2, { options: 0.5, cue: -0.5, interval: 0.25 }, g2),
  G3: build('G3', 'Story Time', 'verbal_memory', 1.0, -2.6, { sentences: 0.35, options: 0.35, delay: 0.3 }, g3),
  G4: build('G4', 'Routine Steps', 'procedural', 1.1, -1.4, { steps: 0.3, options: 0.4, hint: -0.5 }, g4),
  G5: build('G5', 'Sound Match', 'recognition', 1.1, -1.6, { options: 0.5, similarity: 0.5, cue: -0.4 }, g5),
  G6: build('G6', 'Pattern Weave', 'recognition', 1.1, -2.2, { length: 0.25, motifs: 0.5, options: 0.35 }, g6),
  G7: build('G7', 'Find It', 'attention', 1.2, -2.6, { set_size: 0.12, similarity: 0.5 }, g7),
  G8: build('G8', 'Places I Know', 'recognition', 1.1, -1.8, { options: 0.5, cue: -0.5 }, g8),
};
