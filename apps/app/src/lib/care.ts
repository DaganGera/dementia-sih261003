import type { GameId, Trial } from '@hillpath/contracts';
import { eventKey, type ReminderEvent, type ReminderRule } from '@hillpath/core';
import { initialModel, isFiniteModel, type AbilityModel } from '@hillpath/ml';
import type { AppCore } from './core';

export interface CircleSettings {
  patient_id: string;
  patient_name: string;
  carer_name: string;
  schooling: number;
  age: number;
  bridge_language: string;
}

const MAIN = 'main';

export function getSettings(core: AppCore): CircleSettings | null {
  const r = core.replica.get('settings', MAIN);
  if (!r) return null;
  return {
    patient_id: String(r.patient_id ?? 'patient'),
    patient_name: String(r.patient_name ?? ''),
    carer_name: String(r.carer_name ?? 'Your family'),
    schooling: Number(r.schooling ?? 5),
    age: Number(r.age ?? 75),
    bridge_language: 'English',
  };
}

export function saveSettings(core: AppCore, s: Omit<CircleSettings, 'bridge_language'>): void {
  const exists = core.replica.get('settings', MAIN);
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'settings', MAIN, s);
}

export function loadModel(core: AppCore): AbilityModel {
  const row = core.replica.get('ability', MAIN);
  if (row && typeof row.json === 'string') {
    try {
      return JSON.parse(row.json) as AbilityModel;
    } catch {
      // A corrupted model restarts from the prior rather than blocking play.
    }
  }
  return initialModel();
}

export function saveModel(core: AppCore, m: AbilityModel): void {
  // A model with a non-finite value is never stored; the last good one stays.
  if (!isFiniteModel(m)) return;
  const exists = core.replica.get('ability', MAIN);
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'ability', MAIN, { json: JSON.stringify(m), at: Date.now() });
}

export function newSessionId(core: AppCore): string {
  return `s-${core.deviceId}-${Date.now().toString(36)}`;
}

export function writeSession(
  core: AppCore,
  id: string,
  gameId: GameId,
  patientId: string,
  started: number,
  ended: number | null,
  extra: { excess?: number; domain?: string } = {},
): void {
  const exists = core.replica.get('session', id);
  const fields = { patient_id: patientId, game_id: gameId, started_at: started, ended_at: ended, device_id: core.deviceId, synthetic: false, ...extra };
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'session', id, fields);
}

export function writeTrial(core: AppCore, t: Trial): void {
  core.replica.insert('trial', `${t.session_id}:${t.idx}`, { ...t });
}

export function listTrials(core: AppCore): Trial[] {
  return core.replica.list('trial').map((r) => {
    const { id: _id, ...rest } = r;
    return rest as unknown as Trial;
  });
}

export interface SessionRow {
  id: string;
  game_id: GameId;
  started_at: number;
  ended_at: number | null;
  synthetic: boolean;
}

export function listSessions(core: AppCore): SessionRow[] {
  return core.replica
    .list('session')
    .map((r) => ({ id: r.id, game_id: r.game_id as GameId, started_at: Number(r.started_at), ended_at: r.ended_at == null ? null : Number(r.ended_at), synthetic: Boolean(r.synthetic) }))
    .sort((a, b) => b.started_at - a.started_at);
}

// ---------- reminders ----------

export function listReminders(core: AppCore): ReminderRule[] {
  return core.replica.list('reminder').map((r) => ({
    id: r.id,
    kind: (r.kind as ReminderRule['kind']) ?? 'activity',
    title: String(r.title ?? ''),
    time: String(r.time ?? '08:00'),
    days: (r.days as number[]) ?? [],
    window_min: Number(r.window_min ?? 60),
    fluid_restriction: Boolean(r.fluid_restriction),
    active: r.active !== false,
    created_at: typeof r.created_at === 'number' ? r.created_at : 0,
  }));
}

export function saveReminder(core: AppCore, rule: ReminderRule): void {
  const exists = core.replica.get('reminder', rule.id);
  const { id, ...fields } = rule;
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'reminder', id, fields);
}

export function deleteReminder(core: AppCore, id: string): void {
  core.replica.remove('reminder', id);
}

export function listEvents(core: AppCore): ReminderEvent[] {
  return core.replica.list('reminder_event').map((r) => ({
    reminder_id: String(r.reminder_id),
    scheduled_for: Number(r.scheduled_for),
    status: r.status === 'skipped' ? 'skipped' : 'taken',
    confirmed_at: Number(r.confirmed_at),
  }));
}

export function writeEvent(core: AppCore, e: ReminderEvent): void {
  core.replica.insert('reminder_event', eventKey(e.reminder_id, e.scheduled_for), { ...e });
}

// ---------- alerts ----------

export function raiseAlert(core: AppCore, tier: 'info' | 'attention' | 'urgent', kind: string, text: string): string {
  const id = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  core.replica.insert('alert', id, { tier, kind, text, at: Date.now(), acknowledged_at: null, snoozed_until: null });
  return id;
}

export function listAlerts(core: AppCore) {
  return core.replica
    .list('alert')
    .map((r) => ({ id: r.id, tier: r.tier as 'info' | 'attention' | 'urgent', kind: String(r.kind), text: String(r.text), at: Number(r.at), acknowledged_at: r.acknowledged_at ? Number(r.acknowledged_at) : undefined, snoozed_until: r.snoozed_until ? Number(r.snoozed_until) : undefined }))
    .sort((a, b) => b.at - a.at);
}

// ---------- faces and instruments ----------

export interface Face {
  id: string;
  name: string;
  relation: string;
  thumb?: string;
}

export function listFaces(core: AppCore): Face[] {
  return core.replica.list('face').map((r) => ({ id: r.id, name: String(r.name), relation: String(r.relation ?? ''), thumb: typeof r.thumb === 'string' ? r.thumb : undefined }));
}

export function saveFace(core: AppCore, f: Face): void {
  const exists = core.replica.get('face', f.id);
  const { id, ...fields } = f;
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'face', id, fields);
}

export async function thumbFromFile(file: File, size = 96): Promise<string> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const s = Math.min(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.6);
}

export interface InstrumentRecord {
  id: string;
  at: number;
  informant: number;
  adl: number;
  fluency: number;
  recall: number;
  orientation: number;
  acute: Record<string, boolean>;
  vision_hearing_problem: boolean;
  depression_positive: boolean;
}

export function saveInstrument(core: AppCore, r: InstrumentRecord): void {
  const { id, ...fields } = r;
  core.replica.insert('instrument', id, fields);
}

export function listInstruments(core: AppCore): InstrumentRecord[] {
  return core.replica
    .list('instrument')
    .map((r) => ({ ...(r as unknown as InstrumentRecord), id: r.id }))
    .sort((a, b) => b.at - a.at);
}
