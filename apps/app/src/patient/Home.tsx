import type { ScoredGameId } from '@hillpath/contracts';
import { hydrationPrompt, occurrences, statusAt, unconfirmedMessageForPatient, confirmDose, type ReminderRule } from '@hillpath/core';
import { calmingSuggestion, dayPart, GAMES } from '@hillpath/ml';
import { CalendarCheck, HandWaving, Images, MoonStars, MusicNotes, Play } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import type { AppCore } from '../lib/core';
import { getSettings, listEvents, listFaces, listPlaces, listReminders, listSessions, raiseAlert, writeEvent } from '../lib/care';
import { t } from '../lib/i18n';
import { timeOfDayNow } from '../lib/insights';
import { go } from '../lib/router';
import { smsHref } from '../lib/sms';
import { say } from '../lib/voice';
import { useVersion } from '../lib/state';
import { BigButton, PatientScreen, StateNote } from '../ui/kit';
import { SocialButtons } from './Social';

const ORDER: ScoredGameId[] = ['G1', 'G2', 'G3', 'G4', 'G7', 'G5', 'G6', 'G8'];

/** The game least recently played, skipping the ones that need family content until it has been added. */
export function nextGame(core: AppCore): ScoredGameId {
  const hasFaces = listFaces(core).length >= 2;
  const hasPlaces = listPlaces(core).length >= 2;
  const last = new Map<string, number>();
  for (const s of listSessions(core)) if (!last.has(s.game_id)) last.set(s.game_id, s.started_at);
  const candidates = ORDER.filter((g) => (g !== 'G2' || hasFaces) && (g !== 'G8' || hasPlaces));
  return [...candidates].sort((a, b) => (last.get(a) ?? 0) - (last.get(b) ?? 0))[0]!;
}

export function PatientHome({ core }: { core: AppCore }) {
  const v = useVersion();
  const settings = getSettings(core);
  const game = useMemo(() => nextGame(core), [core, v]);
  const evening = useMemo(() => dayPart(new Date().getHours()) === 'evening' && timeOfDayNow(core).eveningDip, [core, v]);
  const due = useDueReminders(core);
  const [active, setActive] = useState<Due | null>(null);
  const [helpSent, setHelpSent] = useState(false);
  const name = settings?.patient_name || 'friend';

  useEffect(() => {
    if (due && !active) setActive(due);
  }, [due, active]);

  useEffect(() => {
    void say(core, 'greeting', `Hello ${name}. It is good to see you. Would you like to play a little?`);
  }, [core, name]);

  if (active) return <DueScreen core={core} rule={active.rule} scheduledFor={active.at} carer={settings?.carer_name ?? 'Your family'} onClose={() => setActive(null)} />;

  return (
    <PatientScreen title={t(core, 'home.greeting', { name })} onHear={() => void say(core, 'greeting', `Hello ${name}. Would you like to play a little?`)}>
      {evening && (
        <div className="card" role="note" data-testid="evening-note">
          <p className="flex items-center gap-2 text-xl font-bold"><MoonStars size={28} aria-hidden />A gentle evening</p>
          <p className="mt-1">{calmingSuggestion()}</p>
        </div>
      )}
      <BigButton primary onClick={() => go('patient', 'play', game)} className="w-full py-6">
        <Play size={36} weight="fill" aria-hidden />
        {t(core, 'home.play', { title: GAMES[game].title })}
      </BigButton>
      <BigButton onClick={() => go('patient', 'day')} className="w-full">
        <CalendarCheck size={32} aria-hidden />
        {t(core, 'home.day')}
      </BigButton>
      <SocialButtons core={core} />
      <div className="grid grid-cols-2 gap-4">
        <BigButton onClick={() => go('patient', 'play', 'G9')} className="btn-quiet">
          <Images size={32} aria-hidden />
          {t(core, 'home.memories')}
        </BigButton>
        <BigButton onClick={() => go('patient', 'play', 'G10')} className="btn-quiet">
          <MusicNotes size={32} aria-hidden />
          {t(core, 'home.music')}
        </BigButton>
      </div>
      <BigButton
        onClick={() => {
          raiseAlert(core, 'urgent', 'help', `${name} asked for help.`);
          setHelpSent(true);
          void say(core, 'help-sent', 'I have told your family. They will come soon.');
        }}
        className="btn-quiet mt-8 w-full"
      >
        <HandWaving size={32} aria-hidden />
        {t(core, 'home.help')}
      </BigButton>
      {helpSent && (
        <StateNote
          kind="loading"
          title={t(core, 'home.help_sent')}
          body="They will come soon."
          action={settings?.escalation_phone ? <a className="btn" href={smsHref(settings.escalation_phone, name === 'friend' ? '' : name)}>Also send a text message</a> : undefined}
        />
      )}
    </PatientScreen>
  );
}

interface Due {
  rule: ReminderRule;
  at: number;
}

/** The reminder whose window is open now and not yet confirmed. Checked every 20 seconds while the app is open. */
export function useDueReminders(core: AppCore): Due | null {
  const [now, setNow] = useState(Date.now());
  const v = useVersion();
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  return useMemo(() => {
    const events = listEvents(core);
    for (const rule of listReminders(core)) {
      for (const at of occurrences(rule, now - rule.window_min * 60_000, now)) {
        const ev = events.find((e) => e.reminder_id === rule.id && e.scheduled_for === at);
        if (statusAt(rule, at, ev, now) === 'due') return { rule, at };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, now, v]);
}

function DueScreen({ core, rule, scheduledFor, carer, onClose }: { core: AppCore; rule: ReminderRule; scheduledFor: number; carer: string; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const line = rule.kind === 'hydration' ? hydrationPrompt(rule) : rule.kind === 'medicine' ? `It is time for your medicine: ${rule.title}.` : `It is time: ${rule.title}.`;
  useEffect(() => {
    void say(core, `reminder-${rule.kind === 'medicine' ? 'medicine' : rule.kind === 'hydration' ? 'water' : 'activity'}`, line);
  }, [core, rule, line]);

  const confirm = () => {
    const existing = listEvents(core).find((e) => e.reminder_id === rule.id && e.scheduled_for === scheduledFor);
    const r = confirmDose(existing, rule, scheduledFor, Date.now());
    if (r.event) writeEvent(core, r.event);
    setMessage(r.message);
  };
  const notSure = () => {
    raiseAlert(core, 'attention', `unsure-${rule.kind}`, `${rule.title}: the person was not sure if it was done. Please check with them.`);
    writeEvent(core, { reminder_id: rule.id, scheduled_for: scheduledFor, status: 'skipped', confirmed_at: Date.now() });
    setMessage(unconfirmedMessageForPatient(rule.kind, carer));
  };

  return (
    <PatientScreen title={rule.title} onHear={() => void say(core, `reminder-${rule.kind}`, line)}>
      <p className="card">{line}</p>
      {message ? (
        <>
          <p className="card" role="status">{message}</p>
          <BigButton primary onClick={onClose} className="w-full">{t(core, 'reminder.back')}</BigButton>
        </>
      ) : (
        <>
          <BigButton primary onClick={confirm} className="w-full py-6">{t(core, 'reminder.confirm')}</BigButton>
          <BigButton onClick={notSure} className="btn-quiet w-full">{t(core, 'reminder.not_sure')}</BigButton>
        </>
      )}
    </PatientScreen>
  );
}
