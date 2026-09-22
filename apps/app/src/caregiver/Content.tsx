import { enrol, templateFrom } from '@hillpath/audio';
import { useState } from 'react';
import { recordUtterance } from '../audio/mic';
import type { AppCore } from '../lib/core';
import { deleteFact, listFaces, listFacts, listPlaces, listSongs, listWords, saveFact, savePlace, saveSong, saveWord, thumbFromFile, wordId } from '../lib/care';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from '../ui/kit';

/** Places, life-story facts and songs the family adds. Nothing here is generated: the person only ever sees what the family approved. */
export function ContentSetup({ core }: { core: AppCore }) {
  return (
    <div className="flex flex-col gap-8">
      <Places core={core} />
      <Facts core={core} />
      <Songs core={core} />
      <VoiceEnrol core={core} />
    </div>
  );
}

/**
 * Personal keyword spotting: a family member says each name three times. It works in any language because it only compares
 * sounds, and it only knows these voices and these words. Answering by tap always works.
 */
function VoiceEnrol({ core }: { core: AppCore }) {
  useVersion();
  const items = [...listFaces(core).map((f) => ({ id: wordId('face', f.id), label: f.name })), ...listPlaces(core).map((p) => ({ id: wordId('place', p.id), label: p.name }))];
  const enrolled = new Set(listWords(core).map((w) => w.id));
  const [active, setActive] = useState<{ id: string; label: string; samples: Float32Array[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const record = async () => {
    if (!active || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const rec = await recordUtterance({ maxMs: 4500, stopAfterSilenceMs: 700, waitForSpeechMs: 3500 });
      if (!templateFrom(rec.samples)) {
        setMessage('I did not hear a word. Say it a little louder and closer to the microphone.');
        return;
      }
      const samples = [...active.samples, rec.samples];
      if (samples.length >= 3) {
        const w = enrol(active.id, samples);
        if (w) {
          saveWord(core, w);
          setMessage(`Saved the voice for ${active.label}.`);
        } else setMessage('The three recordings were too different. Please try again.');
        setActive(null);
      } else setActive({ ...active, samples });
    } catch {
      setMessage('Hillpath cannot use the microphone. Allow it in Settings to record voice answers.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="h-kws" className="flex flex-col gap-3">
      <h2 id="h-kws" className="text-2xl font-bold">Voice answers</h2>
      <p>Say each name three times so the person can answer by voice. It works in any language, and only for the voices and words recorded here. The device asks "Is that right?" before it counts an answer.</p>
      {items.length === 0 ? (
        <StateNote kind="empty" title="Add people or places first." body="Voice answers use the names you added above." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id} className="card flex items-center justify-between gap-3">
              <span>{it.label} <span className="text-muted">{enrolled.has(it.id) ? '(voice saved)' : '(no voice yet)'}</span></span>
              <BigButton className="btn-quiet text-lg" onClick={() => { setMessage(null); setActive({ id: it.id, label: it.label, samples: [] }); }} disabled={busy}>{enrolled.has(it.id) ? 'Record again' : 'Record'}</BigButton>
            </li>
          ))}
        </ul>
      )}
      {active && (
        <div className="card" role="group" aria-label={`Recording ${active.label}`}>
          <p className="text-xl">Say "{active.label}". Recording {active.samples.length + 1} of 3.</p>
          <BigButton primary className="mt-3" onClick={() => void record()} disabled={busy} data-testid="kws-record">{busy ? 'Listening' : `Record ${active.samples.length + 1} of 3`}</BigButton>
        </div>
      )}
      {message && <p role="status" className="card">{message}</p>}
    </section>
  );
}

function Places({ core }: { core: AppCore }) {
  useVersion();
  const places = listPlaces(core);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const add = async () => {
    if (!name.trim()) return;
    const thumb = file ? await thumbFromFile(file).catch(() => undefined) : undefined;
    savePlace(core, { id: `pl-${Date.now().toString(36)}`, name: name.trim(), ...(thumb ? { thumb } : {}) });
    setName('');
    setFile(null);
  };
  return (
    <section aria-labelledby="h-places" className="flex flex-col gap-3">
      <h2 id="h-places" className="text-2xl font-bold">Places for "Places I Know"</h2>
      <p>Add at least two places the person knows: the market, the church or temple, the river, the neighbour's house. A small photo is kept on the phone.</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>Name of the place<input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Photo (optional)<input className="field" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <BigButton primary type="submit">Add place</BigButton>
      </form>
      {places.length === 0 ? (
        <StateNote kind="empty" title="No places yet." body="Add two or more to turn on Places I Know." />
      ) : (
        <ul className="flex flex-wrap gap-2">{places.map((p) => <li key={p.id} className="card py-2">{p.name}</li>)}</ul>
      )}
    </section>
  );
}

function Facts({ core }: { core: AppCore }) {
  useVersion();
  const facts = listFacts(core);
  const [f, setF] = useState({ person: '', relation: '', place: '', year: '', text: '', do_not_ask: false });
  const [file, setFile] = useState<File | null>(null);
  const add = async () => {
    if (!f.text.trim()) return;
    const thumb = file ? await thumbFromFile(file).catch(() => undefined) : undefined;
    saveFact(core, { id: `fa-${Date.now().toString(36)}`, ...f, text: f.text.trim(), ...(thumb ? { thumb } : {}) });
    setF({ person: '', relation: '', place: '', year: '', text: '', do_not_ask: false });
    setFile(null);
  };
  return (
    <section aria-labelledby="h-facts" className="flex flex-col gap-3">
      <h2 id="h-facts" className="text-2xl font-bold">Life story</h2>
      <p className="card">Write short, true, happy facts in your own words. Hillpath shows them to the person exactly as written and never adds to them, corrects them or asks about anything you mark "do not ask about".</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>What should the person be reminded of?<textarea className="field" rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
        <label>Who is it about (optional)<input className="field" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} /></label>
        <label>Their relation (optional)<input className="field" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} /></label>
        <label>Place (optional)<input className="field" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
        <label>Year (optional)<input className="field" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
        <label>Photo (optional)<input className="field" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="size-6" checked={f.do_not_ask} onChange={(e) => setF({ ...f, do_not_ask: e.target.checked })} />
          Do not ask about this. Keep it for the family only.
        </label>
        <BigButton primary type="submit">Add to the life story</BigButton>
      </form>
      {facts.length === 0 ? (
        <StateNote kind="empty" title="No life story yet." body="Add a few happy facts and photos to turn on Life Story." />
      ) : (
        <ul className="flex flex-col gap-2">
          {facts.map((x) => (
            <li key={x.id} className="card flex items-center justify-between gap-3">
              <span>{x.text} {x.do_not_ask && <strong>(family only)</strong>}</span>
              <BigButton className="btn-quiet text-lg" onClick={() => deleteFact(core, x.id)} aria-label={`Delete: ${x.text.slice(0, 30)}`}>Delete</BigButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Songs({ core }: { core: AppCore }) {
  useVersion();
  const songs = listSongs(core);
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const add = async () => {
    if (!title.trim() || !file) return;
    const id = `so-${Date.now().toString(36)}`;
    await core.saveMedia(`song:${id}`, file);
    saveSong(core, { id, title: title.trim(), lyrics, media: `song:${id}` });
    setTitle('');
    setLyrics('');
    setFile(null);
    setNote('Added. The song stays on this device. Add it again on the person\'s tablet if that is a different device.');
  };
  return (
    <section aria-labelledby="h-songs" className="flex flex-col gap-3">
      <h2 id="h-songs" className="text-2xl font-bold">Songs for "Song Circle"</h2>
      <p>Add songs you have the right to use, such as family recordings of hymns or folk songs. Three short original tunes are always available.</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>Title<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Audio file<input className="field" type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label>Words (optional)<textarea className="field" rows={3} value={lyrics} onChange={(e) => setLyrics(e.target.value)} /></label>
        <BigButton primary type="submit" disabled={!title.trim() || !file}>Add song</BigButton>
      </form>
      {note && <p role="status" className="card">{note}</p>}
      {songs.length > 0 && <ul className="flex flex-wrap gap-2">{songs.map((s) => <li key={s.id} className="card py-2">{s.title}</li>)}</ul>}
    </section>
  );
}
