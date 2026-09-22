import { Bell, Bird, Clock, CloudRain, Door, Drop, Fire, Wind, type Icon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playSound, SOUND_GROUPS, SOUND_LABELS, type SoundId } from '../../audio/synth';
import { BigButton } from '../../ui/kit';
import type { RoundProps } from './engine';

const ICONS: Record<SoundId, Icon> = { bell: Bell, rain: CloudRain, kettle: Fire, clock: Clock, knock: Door, drip: Drop, wind: Wind, bird: Bird };
const ALL = Object.keys(SOUND_LABELS) as SoundId[];

function pick(options: number, similarity: number): { target: SoundId; choices: SoundId[] } {
  const target = ALL[Math.floor(Math.random() * ALL.length)]!;
  const group = SOUND_GROUPS.find((g) => g.includes(target)) ?? [];
  const same = group.filter((s) => s !== target);
  const other = ALL.filter((s) => s !== target && !group.includes(s));
  const shuffle = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);
  // similarity 0: wrong answers from other groups. 2: from the same group first.
  const order = similarity >= 2 ? [...shuffle(same), ...shuffle(other)] : similarity === 1 ? [...shuffle(same).slice(0, 1), ...shuffle(other), ...shuffle(same).slice(1)] : [...shuffle(other), ...shuffle(same)];
  const wrong = order.slice(0, options - 1);
  return { target, choices: shuffle([target, ...wrong]) };
}

/** Hear a sound, then pick its picture. A wrong pick names the right sound and plays it again. */
export function G5Sounds({ level, onDone, speak }: RoundProps) {
  const { options = 3, similarity = 0, cue = 1 } = level.design;
  const { target, choices } = useMemo(() => pick(options, similarity), [options, similarity]);
  const [picked, setPicked] = useState<SoundId | null>(null);
  const started = useRef(Date.now());
  const plays = useRef(0);

  useEffect(() => {
    speak('Listen. Which picture matches the sound?');
    const t = window.setTimeout(() => {
      playSound(target);
      started.current = Date.now();
    }, 1800);
    return () => window.clearTimeout(t);
  }, [speak, target]);

  const answer = (s: SoundId) => {
    if (picked) return;
    setPicked(s);
    playSound(target);
    if (s !== target) speak(`That was ${SOUND_LABELS[target]}.`);
    window.setTimeout(() => onDone([{ correct: s === target, rt_ms: Date.now() - started.current, hint_used: plays.current > 1 || cue >= 1, chance: 1 / choices.length }]), s === target ? 1800 : 3200);
  };

  return (
    <section aria-label="Sound match">
      <p className="mb-4 text-2xl font-bold">Which picture matches the sound?</p>
      <BigButton
        className="mb-4 w-full"
        onClick={() => {
          plays.current += 1;
          playSound(target);
        }}
        aria-label="Play the sound again"
      >
        Hear the sound again
      </BigButton>
      <ul className="grid grid-cols-2 gap-3">
        {choices.map((s) => {
          const I = ICONS[s];
          const right = picked !== null && s === target;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => answer(s)}
                disabled={picked !== null && s !== target}
                aria-label={SOUND_LABELS[s]}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-ctl border-2 p-4 ${right ? 'border-accent bg-surface' : 'border-line bg-bg'}`}
                style={{ minHeight: 96 }}
              >
                <I size={44} weight="duotone" aria-hidden />
                {cue >= 1 && <span className="text-lg">{SOUND_LABELS[s].replace(/^(a|an) /, '')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {picked && picked !== target && (
        <p className="card mt-4" role="status">
          That was {SOUND_LABELS[target]}.
        </p>
      )}
    </section>
  );
}
