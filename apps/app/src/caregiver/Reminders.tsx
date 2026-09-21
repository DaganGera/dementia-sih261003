import type { ReminderKind } from '@hillpath/contracts';
import type { ReminderRule } from '@hillpath/core';
import { useState } from 'react';
import type { AppCore } from '../lib/core';
import { deleteReminder, listReminders, saveReminder } from '../lib/care';
import { scheduleNative } from '../lib/notify';
import { useVersion } from '../lib/state';
import { BigButton, StateNote } from '../ui/kit';

const KINDS: Array<[ReminderKind, string]> = [
  ['medicine', 'Medicine'],
  ['hydration', 'Drink'],
  ['activity', 'Activity'],
  ['appointment', 'Appointment'],
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReminderManager({ core }: { core: AppCore }) {
  useVersion();
  const rules = listReminders(core);
  const [kind, setKind] = useState<ReminderKind>('medicine');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([]);
  const [window_min, setWindow] = useState(60);
  const [fluid, setFluid] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const add = () => {
    if (!title.trim()) return;
    const rule: ReminderRule = { id: `r-${Date.now().toString(36)}`, kind, title: title.trim(), time, days, window_min, fluid_restriction: kind === 'hydration' && fluid, active: true, created_at: Date.now() };
    saveReminder(core, rule);
    setTitle('');
    void scheduleNative(listReminders(core)).then((r) => setNote(r));
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Reminders">
      <h2 className="text-2xl font-bold">Reminders</h2>
      <p className="card">Hillpath never gives dose advice. Type medicines exactly as the prescription says. If a dose is missed, the app tells the person not to take another and lets you know.</p>
      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label>Kind
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>What is it for
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: morning tablet" />
        </label>
        <label>Time
          <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <fieldset>
          <legend>Days (none ticked means every day)</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <label key={d} className="flex min-h-12 items-center gap-2 rounded-input border-2 border-line px-3">
                <input type="checkbox" checked={days.includes(i)} onChange={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <label>Minutes the person has to confirm
          <input className="field" type="number" min={15} max={240} value={window_min} onChange={(e) => setWindow(Number(e.target.value))} />
        </label>
        {kind === 'hydration' && (
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-6" checked={fluid} onChange={(e) => setFluid(e.target.checked)} />
            The doctor has limited how much they may drink. Use "small sip" wording.
          </label>
        )}
        <BigButton primary type="submit">Add reminder</BigButton>
      </form>
      {note && <p role="status" className="card">{note}</p>}
      {rules.length === 0 ? (
        <StateNote kind="empty" title="No reminders yet." body="Add one above. It will reach the person's tablet the next time you share records." />
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.id} className="card flex items-center justify-between gap-3">
              <span>
                <strong>{r.time}</strong> {r.title} <span className="text-muted">({r.kind}, {r.days.length ? r.days.map((d) => DAYS[d]).join(' ') : 'every day'})</span>
              </span>
              <BigButton className="btn-quiet text-lg" onClick={() => deleteReminder(core, r.id)} aria-label={`Delete ${r.title}`}>Delete</BigButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
