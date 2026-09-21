import { useEffect, useState } from 'react';
import type { AppCore } from '../lib/core';
import { getSettings, listFaces, saveFace, saveSettings, thumbFromFile } from '../lib/care';
import { CORE_PROMPTS, recordingId, startRecording, type Recorder } from '../lib/voice';
import { useVersion } from '../lib/state';
import { Avatar } from '../patient/games/G2Faces';
import { BigButton, StateNote } from '../ui/kit';

export function FamilySetup({ core }: { core: AppCore }) {
  useVersion();
  const s = getSettings(core);
  const [name, setName] = useState(s?.patient_name ?? '');
  const [carer, setCarer] = useState(s?.carer_name ?? '');
  const [age, setAge] = useState(s?.age ?? 75);
  const [schooling, setSchooling] = useState(s?.schooling ?? 5);
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="h-person" className="flex flex-col gap-3">
        <h2 id="h-person" className="text-2xl font-bold">The person</h2>
        <form
          className="card flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings(core, { patient_id: s?.patient_id ?? `p-${Date.now().toString(36)}`, patient_name: name.trim(), carer_name: carer.trim() || 'Your family', age, schooling });
            setSaved(true);
          }}
        >
          <label>Their name<input className="field" required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Your name (shown on their screen)<input className="field" value={carer} onChange={(e) => setCarer(e.target.value)} /></label>
          <label>Age<input className="field" type="number" min={40} max={110} value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
          <label>
            Years of schooling
            <input className="field" type="number" min={0} max={20} value={schooling} onChange={(e) => setSchooling(Number(e.target.value))} aria-describedby="school-help" />
          </label>
          <p id="school-help" className="text-sm text-muted">Used only to compare scores fairly with people who had similar schooling. Zero is fine.</p>
          <BigButton primary type="submit">Save</BigButton>
          {saved && <p role="status">Saved.</p>}
        </form>
      </section>
      <Faces core={core} />
      <Voices core={core} />
    </div>
  );
}

function Faces({ core }: { core: AppCore }) {
  const faces = listFaces(core);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const thumb = file ? await thumbFromFile(file).catch(() => undefined) : undefined;
    saveFace(core, { id: `f-${Date.now().toString(36)}`, name: name.trim(), relation: relation.trim(), ...(thumb ? { thumb } : {}) });
    setName('');
    setRelation('');
    setFile(null);
    setBusy(false);
  };

  return (
    <section aria-labelledby="h-faces" className="flex flex-col gap-3">
      <h2 id="h-faces" className="text-2xl font-bold">Family and friends for "Faces and Names"</h2>
      <p>Add at least two people. A small photo is kept on the phone and shared only with your family circle. Without a photo, a letter is shown.</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>Name<input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Relation (for example daughter, neighbour)<input className="field" value={relation} onChange={(e) => setRelation(e.target.value)} /></label>
        <label>Photo (optional)<input className="field" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <BigButton primary type="submit" disabled={busy}>Add person</BigButton>
      </form>
      {faces.length === 0 ? (
        <StateNote kind="empty" title="No one added yet." body="Add two or more people to turn on Faces and Names." />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {faces.map((f) => (
            <li key={f.id} className="card flex flex-col items-center gap-2">
              <Avatar face={f} size={96} />
              <p className="font-bold">{f.name}</p>
              <p className="text-muted">{f.relation}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Voices({ core }: { core: AppCore }) {
  const [have, setHave] = useState<Record<string, boolean>>({});
  const [rec, setRec] = useState<{ key: string; r: Recorder } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all(CORE_PROMPTS.map(async (p) => [p.key, await core.hasMedia(recordingId(p.key))] as const)).then((rows) => setHave(Object.fromEntries(rows)));
  }, [core]);

  const start = async (key: string) => {
    setErr(null);
    try {
      setRec({ key, r: await startRecording() });
    } catch {
      setErr('Hillpath cannot use the microphone. Allow it in Settings to record your voice.');
    }
  };
  const stop = async () => {
    if (!rec) return;
    const blob = await rec.r.stop();
    await core.saveMedia(recordingId(rec.key), blob);
    setHave({ ...have, [rec.key]: true });
    setRec(null);
  };

  return (
    <section aria-labelledby="h-voice" className="flex flex-col gap-3">
      <h2 id="h-voice" className="text-2xl font-bold">Your voice for the important messages</h2>
      <p>Record each message once, in your own voice. It plays on this phone or tablet in place of the computer voice. Recordings stay on the device where you make them, so record on the tablet the person uses.</p>
      {err && <StateNote kind="error" title="No microphone." body={err} />}
      <ul className="flex flex-col gap-2">
        {CORE_PROMPTS.map((p) => (
          <li key={p.key} className="card">
            <p>{p.text}</p>
            <p className="text-sm text-muted">{have[p.key] ? 'Recorded in your voice.' : 'Using the computer voice.'}</p>
            {rec?.key === p.key ? (
              <BigButton primary onClick={() => void stop()}>Stop recording</BigButton>
            ) : (
              <BigButton onClick={() => void start(p.key)} disabled={rec !== null}>{have[p.key] ? 'Record again' : 'Record'}</BigButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
