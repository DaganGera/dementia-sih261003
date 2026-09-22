import { CheckCircle, ClipboardText, Hand, ListChecks, MapPin, Smiley, Timer, Users, Warning, type Icon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { AppCore } from '../lib/core';
import { getSettings, saveInstrument } from '../lib/care';
import { speak } from '../lib/voice';
import { BigButton, StateNote } from '../ui/kit';

/**
 * Monthly check, run by a family member or health worker. These are Hillpath's own items,
 * not a validated instrument: they stand in for the published tools until a clinical pilot.
 */
const INFORMANT = [
  'remembering things about family and friends',
  'remembering things that happened recently',
  'remembering conversations from a few days ago',
  'finding their way around familiar places',
  'finding things in the house',
  'handling money and small purchases',
  'using household things like the stove or phone',
  'following a story or a programme',
];
const ADL = ['dressing', 'washing', 'eating', 'using the toilet', 'walking indoors', 'taking medicines', 'cooking', 'handling money'];
const RECALL_WORDS = ['river', 'chair', 'lamp', 'bread', 'mango', 'bell', 'cloud', 'rope', 'shoe', 'tea'];
const ORIENT = ['Do they know where they are (home, village or town)?', 'Do they know the season or the weather now?', 'Do they know if it is morning, afternoon or evening?', 'Do they know the day of the week?'];
const ACUTE: Array<[string, string]> = [
  ['sudden_confusion', 'Sudden confusion'],
  ['drowsiness', 'Unusual drowsiness'],
  ['agitation', 'Sudden agitation'],
  ['fever', 'Fever'],
  ['new_medicine', 'A new medicine'],
  ['fall', 'A fall'],
  ['poor_sleep', 'Poor sleep'],
  ['not_drinking', 'Not drinking'],
  ['face_drooping', 'One side of the face drooping'],
  ['arm_weakness', 'Weakness in one arm'],
  ['speech_difficulty', 'Trouble speaking'],
];

type Step = 'intro' | 'informant' | 'adl' | 'fluency' | 'recall' | 'orient' | 'mood' | 'acute' | 'done';
const ORDER: Step[] = ['intro', 'informant', 'adl', 'fluency', 'recall', 'orient', 'mood', 'acute', 'done'];

const STEP_TITLES: Record<Step, string> = {
  intro: 'Monthly check',
  informant: 'Family questions',
  adl: 'Daily tasks',
  fluency: 'Naming animals',
  recall: 'Remembering words',
  orient: 'Where and when',
  mood: 'Mood, seeing and hearing',
  acute: 'Anything sudden in the last two weeks',
  done: 'The check is saved',
};

const STEP_ICONS: Record<Step, Icon> = {
  intro: ClipboardText,
  informant: Users,
  adl: Hand,
  fluency: Timer,
  recall: ListChecks,
  orient: MapPin,
  mood: Smiley,
  acute: Warning,
  done: CheckCircle,
};

/** `visit` is the home-visit mode for community health workers: a large picture for each step and each step read aloud. */
export function MonthlyCheck({ core, visit = false }: { core: AppCore; visit?: boolean }) {
  const settings = getSettings(core);
  const [step, setStep] = useState<Step>('intro');
  const [rating, setRating] = useState<number[]>(INFORMANT.map(() => 3));
  const [adl, setAdl] = useState<boolean[]>(ADL.map(() => false));
  const [animals, setAnimals] = useState(0);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(60);
  const [recalled, setRecalled] = useState<Set<string>>(new Set());
  const [oriented, setOriented] = useState<boolean[]>(ORIENT.map(() => true));
  const [mood, setMood] = useState<[number, number]>([0, 0]);
  const [visionHearing, setVisionHearing] = useState(false);
  const [acute, setAcute] = useState<Record<string, boolean>>({});
  const timer = useRef(0);

  useEffect(() => {
    if (visit) speak(STEP_TITLES[step]);
  }, [step, visit]);

  if (!settings) return <StateNote kind="empty" title="Set up the person first." body="Open Family to add a name, age and years of schooling." />;
  const StepIcon = STEP_ICONS[step];
  const next = () => setStep(ORDER[ORDER.indexOf(step) + 1]!);
  const name = settings.patient_name || 'the person';

  const startTimer = () => {
    setRunning(true);
    setLeft(60);
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          window.clearInterval(timer.current);
          setRunning(false);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
  };

  const save = () => {
    saveInstrument(core, {
      id: `i-${Date.now().toString(36)}`,
      at: Date.now(),
      informant: rating.reduce((a, b) => a + b, 0) / rating.length,
      adl: adl.filter(Boolean).length,
      fluency: animals,
      recall: recalled.size,
      orientation: oriented.filter(Boolean).length,
      acute,
      vision_hearing_problem: visionHearing,
      depression_positive: mood[0] + mood[1] >= 3,
    });
    next();
  };

  return (
    <section className="flex flex-col gap-4" aria-label={visit ? 'Home visit check' : 'Monthly check'} data-visit={visit ? 'true' : undefined}>
      {visit && (
        <div className="flex items-center gap-4" data-testid="visit-step">
          <StepIcon size={64} weight="duotone" aria-hidden />
          <BigButton className="btn-quiet" onClick={() => speak(STEP_TITLES[step])} aria-label="Hear this step again">Hear this step</BigButton>
        </div>
      )}
      {step === 'intro' && (
        <>
          <h2 className="text-2xl font-bold">Monthly check</h2>
          <p>About 10 minutes. A family member who knows {name} well should answer the family questions. The tasks are done with {name}, sitting together somewhere quiet.</p>
          <p className="card">This is a screening aid. It cannot tell you what is wrong, and it is not a diagnosis. If anything worries you, talk to a doctor or health worker.</p>
          <BigButton primary onClick={next}>Start</BigButton>
        </>
      )}
      {step === 'informant' && (
        <>
          <h2 className="text-2xl font-bold">Family questions</h2>
          <p>Compared with 10 years ago, how is {name} now at each of these? 1 is much better, 3 is about the same, 5 is much worse.</p>
          <ul className="flex flex-col gap-3">
            {INFORMANT.map((q, i) => (
              <li key={q} className="card">
                <label htmlFor={`inf-${i}`} className="block font-bold">{q[0]!.toUpperCase() + q.slice(1)}</label>
                <input id={`inf-${i}`} type="range" min={1} max={5} step={1} value={rating[i]} onChange={(e) => setRating(rating.map((r, j) => (j === i ? Number(e.target.value) : r)))} className="w-full" aria-valuetext={`${rating[i]} of 5`} />
                <p className="tnum text-center text-xl">{rating[i]}</p>
              </li>
            ))}
          </ul>
          <BigButton primary onClick={next}>Next</BigButton>
        </>
      )}
      {step === 'adl' && (
        <>
          <h2 className="text-2xl font-bold">Daily tasks</h2>
          <p>Tick the tasks where {name} now needs help from someone.</p>
          <ul className="flex flex-col gap-2">
            {ADL.map((t, i) => (
              <li key={t}>
                <label className="card flex min-h-12 items-center gap-3">
                  <input type="checkbox" className="size-6" checked={adl[i]} onChange={() => setAdl(adl.map((a, j) => (j === i ? !a : a)))} />
                  {t[0]!.toUpperCase() + t.slice(1)}
                </label>
              </li>
            ))}
          </ul>
          <BigButton primary onClick={next}>Next</BigButton>
        </>
      )}
      {step === 'fluency' && (
        <>
          <h2 className="text-2xl font-bold">Naming animals</h2>
          <p>Ask {name}: "Tell me the names of as many animals as you can, in one minute." Tap once for each different animal named.</p>
          <p className="tnum text-center text-4xl" aria-live="off">{left} seconds</p>
          <div className="flex flex-col gap-3">
            {!running && left === 60 && <BigButton primary onClick={startTimer}>Start the minute</BigButton>}
            <BigButton onClick={() => setAnimals(animals + 1)} disabled={!running} className="py-8 text-4xl" aria-label="Count one animal">
              Count one animal: {animals}
            </BigButton>
            <BigButton className="btn-quiet" onClick={() => setAnimals(Math.max(0, animals - 1))}>Undo one</BigButton>
          </div>
          {running && <BigButton className="btn-quiet" onClick={() => { window.clearInterval(timer.current); setRunning(false); }}>Finish now</BigButton>}
          {!running && left < 60 && <p role="status">The minute is over. {animals} animals counted.</p>}
          <BigButton primary onClick={next} disabled={running}>Next</BigButton>
        </>
      )}
      {step === 'recall' && (
        <>
          <h2 className="text-2xl font-bold">Remembering words</h2>
          <p>Read these ten words slowly to {name}, or press the button. Then play any activity together for a few minutes, and come back here to ask which words {name} remembers.</p>
          <p className="card tnum">{RECALL_WORDS.join(', ')}</p>
          <BigButton onClick={() => speak(RECALL_WORDS.join('. ') + '.')}>Hear the words</BigButton>
          <p className="font-bold">Tap the words {name} remembers now:</p>
          <ul className="flex flex-wrap gap-2">
            {RECALL_WORDS.map((w) => (
              <li key={w}>
                <BigButton aria-pressed={recalled.has(w)} primary={recalled.has(w)} onClick={() => setRecalled((s) => { const n = new Set(s); if (n.has(w)) n.delete(w); else n.add(w); return n; })} className="text-xl">
                  {w}
                </BigButton>
              </li>
            ))}
          </ul>
          <BigButton primary onClick={next}>Next</BigButton>
        </>
      )}
      {step === 'orient' && (
        <>
          <h2 className="text-2xl font-bold">Where and when</h2>
          <ul className="flex flex-col gap-2">
            {ORIENT.map((q, i) => (
              <li key={q}>
                <label className="card flex min-h-12 items-center gap-3">
                  <input type="checkbox" className="size-6" checked={oriented[i]} onChange={() => setOriented(oriented.map((o, j) => (j === i ? !o : o)))} />
                  {q}
                </label>
              </li>
            ))}
          </ul>
          <BigButton primary onClick={next}>Next</BigButton>
        </>
      )}
      {step === 'mood' && (
        <>
          <h2 className="text-2xl font-bold">Mood, seeing and hearing</h2>
          <p>Over the last 2 weeks, how often has {name} seemed bothered by each of these? 0 is not at all, 1 several days, 2 more than half the days, 3 nearly every day.</p>
          {['Little interest or pleasure in doing things', 'Feeling down, low or hopeless'].map((q, i) => (
            <div key={q} className="card">
              <label htmlFor={`mood-${i}`} className="block font-bold">{q}</label>
              <input id={`mood-${i}`} type="range" min={0} max={3} step={1} value={mood[i]} onChange={(e) => setMood(i === 0 ? [Number(e.target.value), mood[1]] : [mood[0], Number(e.target.value)])} className="w-full" />
              <p className="tnum text-center text-xl">{mood[i]}</p>
            </div>
          ))}
          <label className="card flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-6" checked={visionHearing} onChange={(e) => setVisionHearing(e.target.checked)} />
            {name} has trouble seeing large letters at arm's length, or repeating three words said at a normal voice.
          </label>
          <BigButton primary onClick={next}>Next</BigButton>
        </>
      )}
      {step === 'acute' && (
        <>
          <h2 className="text-2xl font-bold">Anything sudden in the last two weeks?</h2>
          <p>Tick anything that applies. A sudden change can have a treatable cause and needs a health check.</p>
          <ul className="flex flex-col gap-2">
            {ACUTE.map(([k, label]) => (
              <li key={k}>
                <label className="card flex min-h-12 items-center gap-3">
                  <input type="checkbox" className="size-6" checked={Boolean(acute[k])} onChange={() => setAcute({ ...acute, [k]: !acute[k] })} />
                  {label}
                </label>
              </li>
            ))}
          </ul>
          <BigButton primary onClick={save}>Save the check</BigButton>
        </>
      )}
      {step === 'done' && (
        <StateNote kind="empty" title="The check is saved." body="Open Home to see the screening range. If you ticked anything sudden, please arrange a health check." />
      )}
    </section>
  );
}
