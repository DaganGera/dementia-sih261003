import { isValidFestivalDate, SEASON_LABEL, seasonFor } from '@hillpath/core';
import { useState } from 'react';
import type { AppCore } from '../lib/core';
import { addFestival, deleteFestival, listFestivals, setFestivalApproved } from '../lib/care';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from '../ui/kit';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The orientation board's festival list. A new entry is hidden from the person until a family member approves it,
 * so nothing reaches the tablet unreviewed. A movable (lunar) festival's date needs updating here each year.
 */
export function OrientationSetup({ core }: { core: AppCore }) {
  useVersion();
  const [name, setName] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(1);
  const [source, setSource] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const festivals = listFestivals(core);

  const add = () => {
    setMsg(null);
    if (!name.trim()) return;
    if (!isValidFestivalDate(month, day)) return setMsg('That date does not exist. Please check the day for that month.');
    addFestival(core, name.trim(), month, day, source.trim() || 'Added by family');
    setName('');
    setSource('');
    setMsg('Added. It is not shown to the person yet: approve it below to show it on their orientation board.');
  };

  return (
    <section aria-labelledby="h-orient" className="flex flex-col gap-4">
      <h2 id="h-orient" className="text-2xl font-bold">Orientation board</h2>
      <p>The person's tablet shows today's day, date and season, and the next festival you have approved here.</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label>Festival name<input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="flex gap-3">
          <label className="flex-1">Month
            <select className="field" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label className="flex-1">Day<input className="field" type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} /></label>
        </div>
        <label>Source (where this date comes from)<input className="field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. local temple calendar, community elder" /></label>
        <BigButton primary type="submit" disabled={!name.trim()}>Add festival</BigButton>
      </form>
      {msg && <p role="status" className="card">{msg}</p>}

      {festivals.length === 0 ? (
        <StateNote kind="empty" title="No festivals added yet." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Festivals">
          {festivals.map((f) => (
            <li key={f.id} className="card flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong>{f.name}</strong>: {MONTHS[f.month - 1]} {f.day}
                <br />
                <span className="text-sm text-muted">Source: {f.source}. {f.approved ? 'Shown to the person.' : 'Not shown to the person yet: pending review.'}</span>
              </span>
              <span className="flex gap-2">
                <BigButton
                  aria-pressed={f.approved}
                  primary={!f.approved}
                  className="text-lg"
                  onClick={() => setFestivalApproved(core, f.id, !f.approved)}
                >
                  {f.approved ? 'Hide from the person' : 'Approve for the person'}
                </BigButton>
                <BigButton className="btn-quiet text-lg" onClick={() => deleteFestival(core, f.id)}>Remove</BigButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">This month's season on the board: {SEASON_LABEL[seasonFor(new Date().getMonth() + 1)]}.</p>
    </section>
  );
}
