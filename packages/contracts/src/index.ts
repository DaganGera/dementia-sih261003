import { z } from 'zod';

export const CONTRACTS_VERSION = '0.1.0';

export const Maturity = z.enum(['Implemented', 'Simulated', 'Roadmap']);
export type Maturity = z.infer<typeof Maturity>;

export const DOMAINS = ['visual_memory', 'associative_memory', 'verbal_memory', 'procedural', 'attention', 'recognition'] as const;
export const Domain = z.enum(DOMAINS);
export type Domain = z.infer<typeof Domain>;

/** Scored games feed the ability model. G9 and G10 are unscored: they log engagement only. */
export const SCORED_GAME_IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const;
export const UNSCORED_GAME_IDS = ['G9', 'G10'] as const;
export const GAME_IDS = [...SCORED_GAME_IDS, ...UNSCORED_GAME_IDS] as const;
export const GameId = z.enum(GAME_IDS);
export type GameId = z.infer<typeof GameId>;
export type ScoredGameId = (typeof SCORED_GAME_IDS)[number];
export const isScored = (g: string): g is ScoredGameId => (SCORED_GAME_IDS as readonly string[]).includes(g);

export const Role = z.enum(['patient', 'caregiver', 'health_worker', 'clinician']);
export type Role = z.infer<typeof Role>;

export const Trial = z.object({
  session_id: z.string(),
  idx: z.number().int().nonnegative(),
  game_id: GameId,
  domain: Domain,
  design: z.record(z.string(), z.number()),
  difficulty: z.number(),
  chance: z.number().min(0).max(1),
  correct: z.boolean(),
  rt_ms: z.number().nonnegative(),
  hint_used: z.boolean(),
  input_mode: z.enum(['tap', 'voice', 'both']),
  synthetic: z.boolean(),
  /** Voice answers only: time from the end of the prompt to the start of speech, and the share of the answer that was pause. */
  speech_latency_ms: z.number().nonnegative().optional(),
  pause_ratio: z.number().min(0).max(1).optional(),
});
export type Trial = z.infer<typeof Trial>;

export const Session = z.object({
  id: z.string(),
  patient_id: z.string(),
  game_id: GameId,
  started_at: z.number(),
  ended_at: z.number().nullable(),
  device_id: z.string(),
  synthetic: z.boolean(),
});
export type Session = z.infer<typeof Session>;

export const JsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(z.string(), JsonValue)]),
);

export const Op = z.object({
  op_id: z.string(),
  hlc: z.string(),
  device: z.string(),
  entity: z.string(),
  id: z.string(),
  kind: z.enum(['insert', 'set', 'tombstone']),
  fields: z.record(z.string(), JsonValue).optional(),
});
export type Op = z.infer<typeof Op>;

export const Envelope = z.object({
  v: z.literal(1),
  circle: z.string(),
  from: z.string(),
  vector: z.record(z.string(), z.string()),
  nonce: z.string(),
  ciphertext: z.string(),
  sig: z.string(),
});
export type Envelope = z.infer<typeof Envelope>;

export const AbilityState = z.object({
  model_version: z.string(),
  at: z.number(),
  synthetic: z.boolean(),
  domains: z.record(z.string(), z.object({ mean: z.number(), sd: z.number() })),
});
export type AbilityState = z.infer<typeof AbilityState>;

export const STAGES = ['no_impairment', 'mci_range', 'mild_range', 'moderate_or_severe_range'] as const;
export type Stage = (typeof STAGES)[number];

export const StageEstimate = z.object({
  model_version: z.string(),
  maturity: Maturity,
  at: z.number(),
  probs: z.array(z.number()).length(4),
  set: z.array(z.number().int().min(0).max(3)),
  abstain: z.string().nullable(),
  contributions: z.array(z.object({ feature: z.string(), effect: z.number() })),
});
export type StageEstimate = z.infer<typeof StageEstimate>;

export const AlertTier = z.enum(['info', 'attention', 'urgent']);
export type AlertTier = z.infer<typeof AlertTier>;

export const ReminderKind = z.enum(['medicine', 'hydration', 'activity', 'appointment']);
export type ReminderKind = z.infer<typeof ReminderKind>;

export const ConsentPurpose = z.enum(['local', 'family', 'health_worker', 'clinician_report', 'relay']);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

export const TIERS = { en: 'T1', other: 'T0' } as const;
