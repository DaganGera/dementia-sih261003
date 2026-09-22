import { nextFestival, occurrences, SEASON_LABEL, seasonFor, statusAt } from '@hillpath/core';
import { useMemo } from 'react';
import type { AppCore } from '../lib/core';
import { listEvents, listFestivals, listReminders } from '../lib/care';
import { go } from '../lib/router';
import { useVersion } from '../lib/state';
import { PatientScreen, StateNote } from '../ui/kit';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Day, date, season and the next approved festival (F23). Plain calendar facts, never a model estimate. */
function OrientationBoard({ core }: { core: AppCore }) {
  const now = new Date();
  const upcoming = nextFestival(listFestivals(core), now);
  return (
    <div className="card" data-testid="orientation-board">
      <p className="text-2xl font-bold">{now.toLocaleDateString([], { weekday: 'long' })}</p>
      <p className="text-xl">{now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p className="text-muted">{SEASON_LABEL[seasonFor(now.getMonth() + 1)]}</p>
      {upcoming && (
        <p className="mt-2" data-testid="next-festival">
          {upcoming.daysAway === 0 ? `Today is ${upcoming.entry.name}.` : `${upcoming.entry.name} in ${upcoming.daysAway} ${upcoming.daysAway === 1 ? 'day' : 'days'}.`}
        </p>
      )}
    </div>
  );
}

/** Today's reminders in plain words. Nothing here can be failed or missed in red. */
export function PatientDay({ core }: { core: AppCore }) {
  const v = useVersion();
  const rows = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86_400_000 - 1;
    const events = listEvents(core);
    const now = Date.now();
    return listReminders(core)
      .flatMap((rule) => occurrences(rule, start.getTime(), end).map((at) => ({ rule, at, status: statusAt(rule, at, events.find((e) => e.reminder_id === rule.id && e.scheduled_for === at), now) })))
      .sort((a, b) => a.at - b.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, v]);

  const words: Record<string, string> = { upcoming: 'Later', due: 'Now', unconfirmed: 'Your family will check', taken: 'Done', skipped: 'Skipped' };
  return (
    <PatientScreen title="My day" onBack={() => go('patient')}>
      <OrientationBoard core={core} />
      {rows.length === 0 ? (
        <StateNote kind="empty" title="Nothing planned for today." body="Your family can add reminders for you." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={`${r.rule.id}-${r.at}`} className="card">
              <p className="font-bold">{clock(r.at)}: {r.rule.title}</p>
              <p className="text-muted">{words[r.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </PatientScreen>
  );
}
