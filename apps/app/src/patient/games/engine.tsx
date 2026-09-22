import { DOMAINS, type ScoredGameId } from '@hillpath/contracts';
import { chooseLevel, composite, finishSession, GAMES, practiceGain, successProbability, updateTrial, type Level } from '@hillpath/ml';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { AppCore } from '../../lib/core';
import { getSettings, loadModel, newSessionId, saveModel, writeSession, writeTrial } from '../../lib/care';
import { go } from '../../lib/router';
import { say } from '../../lib/voice';
import { BigButton, PatientScreen } from '../../ui/kit';
import { G1Pairs } from './G1Pairs';
import { G2Faces } from './G2Faces';
import { G3Story } from './G3Story';
import { G4Routine } from './G4Routine';
import { G5Sounds } from './G5Sounds';
import { G6Weave } from './G6Weave';
import { G7Find } from './G7Find';
import { G8Places } from './G8Places';

export interface TrialResult {
  correct: boolean;
  rt_ms: number;
  hint_used: boolean;
  chance?: number;
  /** Set when the answer was given by voice and confirmed. */
  voice?: { latencyMs: number; pauseRatio: number };
}

export interface RoundProps {
  core: AppCore;
  level: Level;
  /** Called once with every trial of the round. */
  onDone: (trials: TrialResult[]) => void;
  /** Called when the round asks for a spoken prompt. */
  speak: (text: string) => void;
}

const ROUND_COMPONENTS: Record<ScoredGameId, ComponentType<RoundProps>> = { G1: G1Pairs, G2: G2Faces, G3: G3Story, G4: G4Routine, G5: G5Sounds, G6: G6Weave, G7: G7Find, G8: G8Places };
const ROUNDS: Record<ScoredGameId, number> = { G1: 2, G2: 5, G3: 2, G4: 2, G5: 5, G6: 5, G7: 5, G8: 5 };
export const SESSION_CAP_MS = 10 * 60_000;

/** Runs one session: M1 picks each round's level, trials are written as ops, and the session ends by itself. */
export function GameRunner({ core, gameId }: { core: AppCore; gameId: ScoredGameId }) {
  const spec = GAMES[gameId];
  const settings = getSettings(core);
  const patientId = settings?.patient_id ?? 'patient';
  const sessionId = useRef(newSessionId(core));
  const started = useRef(Date.now());
  const model = useRef(loadModel(core));
  const lastIndex = useRef<number | null>(null);
  const lastRate = useRef<number | null>(null);
  const traceIdx = useRef(0);
  const excessSum = useRef(0);
  const excessCount = useRef(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const rand = useMemo(() => Math.random, []);
  const choice = useMemo(
    () => chooseLevel({ model: model.current, gameId, lastIndex: lastIndex.current, lastRoundRate: lastRate.current, rand }),
    // A new choice is made only when the round number changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );
  const [why, setWhy] = useState('');
  const speakFn = useCallback((t: string) => void say(core, `prompt:${t}`, t), [core]);

  useEffect(() => {
    writeSession(core, sessionId.current, gameId, patientId, started.current, null);
  }, [core, gameId, patientId]);

  useEffect(() => setWhy(choice.reason), [choice]);

  const finish = () => {
    model.current = finishSession(model.current, gameId);
    saveModel(core, model.current);
    const c = composite(model.current);
    const excess = excessCount.current ? excessSum.current / excessCount.current : 0;
    if (Number.isFinite(c.mean) && Number.isFinite(c.sd)) core.replica.insert('ability_snap', sessionId.current, { at: Date.now(), mean: c.mean, sd: c.sd });
    writeSession(core, sessionId.current, gameId, patientId, started.current, Date.now(), { excess, domain: spec.domain });
    setDone(true);
    void say(core, 'well-done', 'That was lovely. That is enough for now. Thank you for playing.');
  };

  const onDone = (trials: TrialResult[]) => {
    for (const t of trials) {
      const chance = t.chance ?? choice.level.chance;
      writeTrial(core, {
        session_id: sessionId.current,
        idx: traceIdx.current++,
        game_id: gameId,
        domain: spec.domain,
        design: choice.level.design,
        difficulty: choice.level.b,
        chance,
        correct: t.correct,
        rt_ms: Math.round(t.rt_ms),
        hint_used: t.hint_used,
        input_mode: t.voice ? 'both' : 'tap',
        synthetic: false,
        ...(t.voice ? { speech_latency_ms: Math.round(t.voice.latencyMs), pause_ratio: Math.max(0, Math.min(1, t.voice.pauseRatio)) } : {}),
      });
      const d = DOMAINS.indexOf(spec.domain);
      const expected = successProbability(model.current.mu[d]!, { b: choice.level.b, chance }, spec.a, practiceGain(model.current.exposures[gameId] ?? 0));
      excessSum.current += (t.correct ? 1 : 0) - expected;
      excessCount.current += 1;
      model.current = updateTrial(model.current, gameId, { b: choice.level.b, chance }, t.correct);
    }
    lastIndex.current = choice.index;
    lastRate.current = trials.length ? trials.filter((t) => t.correct).length / trials.length : null;
    saveModel(core, model.current);
    const overTime = Date.now() - started.current >= SESSION_CAP_MS;
    if (round + 1 >= ROUNDS[gameId] || overTime) finish();
    else setRound(round + 1);
  };

  if (done) {
    return (
      <PatientScreen title="That is enough for now">
        <p className="card">Thank you for playing. You can rest, or play again later.</p>
        <BigButton primary onClick={() => go('patient')}>Back to home</BigButton>
      </PatientScreen>
    );
  }

  const Round = ROUND_COMPONENTS[gameId];
  return (
    <PatientScreen title={spec.title} onBack={() => go('patient')}>
      <p aria-live="polite" className="text-lg text-muted" data-testid="round-counter">Round {round + 1} of {ROUNDS[gameId]}</p>
      <Round key={round} core={core} level={choice.level} onDone={onDone} speak={speakFn} />
      <details className="text-base text-muted">
        <summary className="cursor-pointer py-2">For family: why this level</summary>
        <p data-testid="why-level">{why}</p>
      </details>
    </PatientScreen>
  );
}
