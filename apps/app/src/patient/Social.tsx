import { rng } from '@hillpath/ml';
import { EnvelopeSimple, HandsClapping } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickItems } from '../content/items';
import type { AppCore } from '../lib/core';
import { finishCoPlay, listCoPlay, listPostcards, markHeard, b64ToBlob } from '../lib/social';
import { go } from '../lib/router';
import { BigButton, PatientScreen, StateNote } from '../ui/kit';

/** Messages from family. Playing one marks it heard. Nothing is scored. */
export function PatientPostcards({ core }: { core: AppCore }) {
  const cards = listPostcards(core);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const play = async (id: string) => {
    const p = cards.find((c) => c.id === id);
    if (!p) return;
    audio.current?.pause();
    const a = new Audio(URL.createObjectURL(b64ToBlob(p.audio, p.mime)));
    audio.current = a;
    a.onended = () => setPlaying(null);
    setPlaying(id);
    await a.play().catch(() => setPlaying(null));
    markHeard(core, id);
  };

  return (
    <PatientScreen title="Messages from family" onBack={() => go('patient')}>
      {cards.length === 0 ? (
        <StateNote kind="empty" title="No messages yet." body="When family send you a message it will appear here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {cards.map((c) => (
            <li key={c.id} className="card flex flex-col gap-3">
              {c.thumb && <img src={c.thumb} alt="" width={120} height={120} className="rounded-ctl object-cover" style={{ width: 120, height: 120 }} />}
              <p className="text-2xl font-bold">From {c.from}</p>
              {c.text && <p>{c.text}</p>}
              {c.audio ? (
                <BigButton primary={playing !== c.id} onClick={() => void play(c.id)}>{playing === c.id ? 'Playing' : c.heardAt ? 'Hear it again' : 'Hear the message'}</BigButton>
              ) : (
                <p className="text-muted">This message has no voice.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </PatientScreen>
  );
}

const ROUNDS = 3;

/**
 * Play together: a round of Find It where the pictures and the target are decided by a shared seed. The family member
 * can open the same round on their own device, so both look for the same things. It is not scored and never adapts.
 */
export function CoPlayRound({ core, seed, coplayId }: { core: AppCore; seed: number; coplayId?: string }) {
  const [round, setRound] = useState(0);
  const [found, setFound] = useState(0);
  const [dim, setDim] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  const missedFirst = useRef(false);
  const firstFound = useRef(0);

  const scene = useMemo(() => {
    const r = rng(seed * 1000 + round);
    const items = pickItems(8, 1, r);
    return { items, target: items[Math.floor(r() * items.length)]! };
  }, [seed, round]);

  useEffect(() => {
    setDim(new Set());
    setSolved(false);
    missedFirst.current = false;
  }, [round]);

  const tap = (id: string) => {
    if (solved) return;
    if (id === scene.target.id) {
      setSolved(true);
      if (!missedFirst.current) firstFound.current += 1;
      window.setTimeout(() => {
        if (round + 1 >= ROUNDS) {
          setFound(firstFound.current);
          if (coplayId) finishCoPlay(core, coplayId, firstFound.current, ROUNDS);
          setRound(ROUNDS);
        } else setRound(round + 1);
      }, 900);
    } else {
      missedFirst.current = true;
      setDim(new Set(dim).add(id));
    }
  };

  if (round >= ROUNDS) {
    return (
      <PatientScreen title="Well done together">
        <p className="card" data-testid="coplay-result">You found {found} of {ROUNDS} on the first try. Thank you for playing.</p>
        <BigButton primary onClick={() => go('patient')}>Back to home</BigButton>
      </PatientScreen>
    );
  }
  return (
    <PatientScreen title="Play together" onBack={() => go('patient')}>
      <p aria-live="polite" className="text-lg text-muted" data-testid="coplay-counter">Round {round + 1} of {ROUNDS}</p>
      <p className="text-2xl font-bold" data-testid="coplay-prompt">Find the {scene.target.label}.</p>
      <ul className="grid grid-cols-4 gap-3">
        {scene.items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              aria-label={it.label}
              onClick={() => tap(it.id)}
              className={`flex aspect-square w-full items-center justify-center rounded-ctl border-2 ${solved && it.id === scene.target.id ? 'border-accent bg-surface' : 'border-line bg-bg'}`}
              style={{ minHeight: 64, opacity: dim.has(it.id) ? 0.35 : 1 }}
            >
              <it.Icon size={40} weight="duotone" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </PatientScreen>
  );
}

/** Home buttons for unheard messages and waiting invitations. Rendered only when there is something to do. */
export function SocialButtons({ core }: { core: AppCore }) {
  const unheard = listPostcards(core).filter((p) => !p.heardAt);
  const invite = listCoPlay(core).find((c) => !c.playedAt);
  if (!unheard.length && !invite) return null;
  return (
    <div className="flex flex-col gap-4">
      {unheard.length > 0 && (
        <BigButton onClick={() => go('patient', 'postcards')} className="w-full" data-testid="postcard-button">
          <EnvelopeSimple size={32} aria-hidden />
          {unheard.length === 1 ? `A message from ${unheard[0]!.from}` : `${unheard.length} messages from family`}
        </BigButton>
      )}
      {invite && (
        <BigButton onClick={() => go('patient', 'together', String(invite.seed), invite.id)} className="w-full" data-testid="coplay-button">
          <HandsClapping size={32} aria-hidden />
          Play with {invite.from}
        </BigButton>
      )}
    </div>
  );
}
