import { CaretRight, Stop } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playTune, TUNES } from '../../audio/synth';
import type { AppCore } from '../../lib/core';
import { getSettings, listFacts, listSongs, newSessionId, writeSession, type Fact, type Song } from '../../lib/care';
import { go } from '../../lib/router';
import { say } from '../../lib/voice';
import { BigButton, PatientScreen, StateNote } from '../../ui/kit';
import { TimingCapture } from '../../ui/TimingCapture';
import { SESSION_CAP_MS } from './engine';

/** Unscored activities log that they happened and for how long. Nothing here is graded, and no wrong answer exists. */
function useUnscoredSession(core: AppCore, game: 'G9' | 'G10') {
  const patientId = getSettings(core)?.patient_id ?? 'patient';
  const id = useRef(newSessionId(core));
  const started = useRef(Date.now());
  const items = useRef(0);
  useEffect(() => {
    writeSession(core, id.current, game, patientId, started.current, null);
  }, [core, game, patientId]);
  return {
    seen: () => {
      items.current += 1;
    },
    end: () => writeSession(core, id.current, game, patientId, started.current, Date.now(), { items: items.current, seconds: Math.round((Date.now() - started.current) / 1000) }),
    elapsed: () => Date.now() - started.current,
  };
}

function FactCard({ f }: { f: Fact }) {
  const title = f.person ? `About ${f.person}${f.relation ? `, your ${f.relation}` : ''}` : f.place ? `Remembering ${f.place}` : 'A happy memory';
  return (
    <article className="flex flex-col gap-3">
      {f.thumb && <img src={f.thumb} alt="" width={160} height={160} className="mx-auto rounded-ctl object-cover" style={{ width: 160, height: 160 }} />}
      <h2>{title}</h2>
      <p className="card">{f.text}</p>
      {(f.place || f.year) && <p className="text-muted">{[f.place && f.person ? f.place : '', f.year].filter(Boolean).join(', ')}</p>}
    </article>
  );
}

export function LifeStory({ core }: { core: AppCore }) {
  const facts = useMemo(() => listFacts(core).filter((f) => !f.do_not_ask).sort(() => Math.random() - 0.5), [core]);
  const session = useUnscoredSession(core, 'G9');
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const f = facts[i];

  useEffect(() => {
    if (f) void say(core, `fact:${f.id}`, f.text);
    if (f) session.seen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id]);

  const finish = () => {
    session.end();
    setDone(true);
  };
  if (done) {
    return (
      <PatientScreen title="Thank you">
        <p className="card">It was lovely to remember together.</p>
        <BigButton primary onClick={() => go('patient')}>Back to home</BigButton>
      </PatientScreen>
    );
  }
  if (facts.length === 0) {
    return (
      <PatientScreen title="Memories" onBack={() => go('patient')}>
        <StateNote kind="empty" title="No memories here yet." body="Your family can add happy memories and photos for you." />
      </PatientScreen>
    );
  }
  return (
    <PatientScreen title="Memories" onBack={() => go('patient')} onHear={() => f && void say(core, `fact:${f.id}`, f.text)}>
      {f && <FactCard f={f} />}
      <TimingCapture core={core} context="life_story" label="Tell me more" />
      <BigButton
        primary
        onClick={() => {
          if (i + 1 >= facts.length || session.elapsed() >= SESSION_CAP_MS) finish();
          else setI(i + 1);
        }}
        className="w-full"
      >
        <CaretRight size={32} aria-hidden />
        {i + 1 >= facts.length ? 'That is all for now' : 'Next memory'}
      </BigButton>
      <BigButton className="btn-quiet w-full" onClick={finish}>That is enough</BigButton>
    </PatientScreen>
  );
}

export function SongCircle({ core }: { core: AppCore }) {
  const songs = useMemo(() => listSongs(core), [core]);
  const session = useUnscoredSession(core, 'G10');
  const [playing, setPlaying] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const [done, setDone] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  };
  useEffect(() => () => audio.current?.pause(), []);

  const playFamily = async (s: Song) => {
    stop();
    const blob = await core.loadMedia(s.media);
    if (!blob) return setMissing(`The recording of ${s.title} is not on this device. Ask your family to add it here.`);
    setMissing(null);
    const a = new Audio(URL.createObjectURL(blob));
    audio.current = a;
    a.onended = () => setPlaying(null);
    await a.play().catch(() => setMissing('This device could not play that recording.'));
    setPlaying(s.id);
    setLyrics(s.lyrics);
    session.seen();
  };

  const playBuiltIn = (idx: number) => {
    stop();
    const seconds = playTune(idx);
    setPlaying(TUNES[idx]!.id);
    setLyrics('');
    session.seen();
    window.setTimeout(() => setPlaying((p) => (p === TUNES[idx]!.id ? null : p)), seconds * 1000);
  };

  if (done) {
    return (
      <PatientScreen title="Thank you">
        <p className="card">I hope you enjoyed the music.</p>
        <BigButton primary onClick={() => go('patient')}>Back to home</BigButton>
      </PatientScreen>
    );
  }
  return (
    <PatientScreen title="Music" onBack={() => go('patient')}>
      <ul className="flex flex-col gap-3">
        {songs.map((s) => (
          <li key={s.id}>
            <BigButton className="w-full" primary={playing === s.id} onClick={() => void playFamily(s)}>{s.title}</BigButton>
          </li>
        ))}
        {TUNES.map((t, idx) => (
          <li key={t.id}>
            <BigButton className="w-full" primary={playing === t.id} onClick={() => playBuiltIn(idx)}>{t.title}</BigButton>
          </li>
        ))}
      </ul>
      {missing && <p role="status" className="card">{missing}</p>}
      {playing && (
        <BigButton className="btn-quiet w-full" onClick={stop}>
          <Stop size={32} aria-hidden />
          Stop the music
        </BigButton>
      )}
      {lyrics && <p className="card whitespace-pre-line" aria-label="Words">{lyrics}</p>}
      <BigButton
        className="btn-quiet w-full"
        onClick={() => {
          stop();
          session.end();
          setDone(true);
        }}
      >
        That is enough
      </BigButton>
    </PatientScreen>
  );
}
