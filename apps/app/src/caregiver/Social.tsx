import { useRef, useState } from 'react';
import type { AppCore } from '../lib/core';
import { getSettings, thumbFromFile } from '../lib/care';
import { inviteCoPlay, listCoPlay, listPostcards, MAX_POSTCARD_AUDIO_B64, MAX_POSTCARD_SECONDS, recordPostcardAudio, savePostcard } from '../lib/social';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from '../ui/kit';

/** For any family member, including someone far away: send a voice postcard, or invite the person to play a round together. */
export function SocialSetup({ core }: { core: AppCore }) {
  useVersion();
  const settings = getSettings(core);
  const [from, setFrom] = useState(settings?.carer_name ?? '');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<{ b64: string; mime: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const rec = useRef<Awaited<ReturnType<typeof recordPostcardAudio>> | null>(null);
  const cards = listPostcards(core);
  const plays = listCoPlay(core);

  const start = async () => {
    setNote(null);
    try {
      rec.current = await recordPostcardAudio();
      setRecording(true);
      void rec.current.done.then((a) => {
        setRecording(false);
        if (a.b64.length > MAX_POSTCARD_AUDIO_B64) setNote(`That message is too long to send. Keep it under ${MAX_POSTCARD_SECONDS} seconds.`);
        else setAudio(a);
      });
    } catch {
      setNote('Hillpath cannot use the microphone. Allow it in Settings to record a message.');
    }
  };

  const send = async () => {
    if (!from.trim() || (!audio && !text.trim())) return;
    const thumb = file ? await thumbFromFile(file).catch(() => undefined) : undefined;
    savePostcard(core, { from: from.trim(), text: text.trim(), audio: audio?.b64 ?? '', mime: audio?.mime ?? 'audio/webm', ...(thumb ? { thumb } : {}) });
    setText('');
    setFile(null);
    setAudio(null);
    setNote('Sent. It reaches the person the next time you share records.');
  };

  return (
    <section aria-labelledby="h-social" className="flex flex-col gap-4">
      <h2 id="h-social" className="text-2xl font-bold">Postcards and playing together</h2>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label>Your name<input className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>A few words (optional)<textarea className="field" rows={2} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label>Photo (optional)<input className="field" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <BigButton onClick={() => void start()} type="button">{audio ? 'Record again' : 'Record a voice message'}</BigButton>
          ) : (
            <BigButton primary type="button" onClick={() => rec.current?.stop()}>Stop recording</BigButton>
          )}
          {audio && <span role="status">Voice message ready.</span>}
          {recording && <span role="status">Recording. Up to {MAX_POSTCARD_SECONDS} seconds.</span>}
        </div>
        <BigButton primary type="submit" disabled={!from.trim() || (!audio && !text.trim())}>Send the postcard</BigButton>
      </form>
      {note && <p role="status" className="card">{note}</p>}
      {cards.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Sent postcards">
          {cards.slice(0, 5).map((c) => <li key={c.id} className="card py-2">From {c.from}: {c.text || 'voice message'}. {c.heardAt ? 'Heard.' : 'Not heard yet.'}</li>)}
        </ul>
      )}

      <div className="card flex flex-col gap-3">
        <h3 className="text-xl font-bold">Play together</h3>
        <p>Send an invitation to a round of Find It. You and the person see exactly the same pictures, wherever you are.</p>
        <BigButton onClick={() => inviteCoPlay(core, from.trim() || settings?.carer_name || 'Your family')}>Send an invitation</BigButton>
        {plays.length === 0 ? (
          <StateNote kind="empty" title="No invitations yet." />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Invitations">
            {plays.slice(0, 5).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span data-testid="coplay-status">{p.playedAt ? `Played together: found ${p.found} of ${p.total} on the first try.` : 'Waiting for the person to play.'}</span>
                <a className="btn text-lg" style={{ minHeight: 48 }} href={`#/patient/together/${p.seed}`}>Play this round too</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
