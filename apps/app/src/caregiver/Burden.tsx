import { BURDEN_ITEMS, BURDEN_NOTE, BURDEN_OPTIONS, burdenDue, pushBudgetFor, scoreBurden, supportFor, type BurdenResult } from '@hillpath/core';
import { useState } from 'react';
import type { AppCore } from '../lib/core';
import { useVersion } from '../lib/state';
import { BigButton } from '../ui/kit';

export const burdenHistory = (core: AppCore): BurdenResult[] => core.getLocal<BurdenResult[]>('burden', []);

/** Attention alerts allowed per day for this carer, from their latest check-in. Urgent alerts are never limited. */
export function attentionBudget(core: AppCore): number {
  const last = burdenHistory(core).at(-1);
  return pushBudgetFor(last?.band ?? null);
}

/** A private check-in for the carer. Answers never leave this device. */
export function BurdenCheck({ core }: { core: AppCore }) {
  useVersion();
  const history = burdenHistory(core);
  const last = history.at(-1);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Array<number | null>>(BURDEN_ITEMS.map(() => null));
  const done = answers.every((a) => a !== null);
  const due = burdenDue(history, Date.now());

  const save = async () => {
    const r = scoreBurden(answers as number[], Date.now());
    await core.putLocal('burden', [...history, r].slice(-24));
    setOpen(false);
    setAnswers(BURDEN_ITEMS.map(() => null));
  };

  const support = last ? supportFor(last) : null;
  return (
    <section aria-labelledby="h-burden" className="card" data-testid="burden-card">
      <h2 id="h-burden" className="text-2xl font-bold">How are you?</h2>
      <p className="mt-2 text-muted">{BURDEN_NOTE}</p>
      {support && last && !open && (
        <div className="mt-3" data-testid="burden-support">
          <p className="text-xl font-bold">{support.headline}</p>
          <ul className="mt-2 list-disc pl-6">{support.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="mt-2 text-sm text-muted">Last check-in: {new Date(last.at).toLocaleDateString([], { day: 'numeric', month: 'long' })}.</p>
        </div>
      )}
      {!open ? (
        <BigButton className="mt-3" primary={due} onClick={() => setOpen(true)}>{last ? 'Check in again' : 'Check in with yourself'}</BigButton>
      ) : (
        <form className="mt-3 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {BURDEN_ITEMS.map((item, i) => (
            <fieldset key={item.id} className="flex flex-col gap-2">
              <legend className="text-lg font-bold">{item.text}</legend>
              <div className="flex flex-wrap gap-2">
                {BURDEN_OPTIONS.map((o) => (
                  <label key={o.value} className={`btn text-lg ${answers[i] === o.value ? 'btn-primary' : 'btn-quiet'}`} style={{ minHeight: 48 }}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={item.id}
                      value={o.value}
                      checked={answers[i] === o.value}
                      onChange={() => setAnswers(answers.map((a, j) => (j === i ? o.value : a)))}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex gap-3">
            <BigButton primary type="submit" disabled={!done}>Save my check-in</BigButton>
            <BigButton type="button" className="btn-quiet" onClick={() => setOpen(false)}>Not now</BigButton>
          </div>
        </form>
      )}
    </section>
  );
}
