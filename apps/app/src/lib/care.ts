import { deserialise, serialise, type EnrolledWord, type StoredTemplate } from '@hillpath/audio';
import type { GameId, Trial } from '@hillpath/contracts';
import { eventKey, type FestivalEntry, type ReminderEvent, type ReminderRule } from '@hillpath/core';
import { initialModel, isFiniteModel, type AbilityModel } from '@hillpath/ml';
import type { AppCore } from './core';

export interface CircleSettings {
  patient_id: string;
  patient_name: string;
  carer_name: string;
  schooling: number;
  age: number;
  bridge_language: string;
  /** Number for the urgent text message. Optional. */
  escalation_phone: string;
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
    escalation_phone: String(r.escalation_phone ?? ''),
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
  extra: { excess?: number; domain?: string; items?: number; seconds?: number } = {},
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

export interface Place {
  id: string;
  name: string;
  thumb?: string;
}

export function listPlaces(core: AppCore): Place[] {
  return core.replica.list('place').map((r) => ({ id: r.id, name: String(r.name), thumb: typeof r.thumb === 'string' ? r.thumb : undefined }));
}

export function savePlace(core: AppCore, p: Place): void {
  const exists = core.replica.get('place', p.id);
  const { id, ...fields } = p;
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'place', id, fields);
}

// ---------- orientation board ----------

export function listFestivals(core: AppCore): FestivalEntry[] {
  return core.replica
    .list('festival')
    .map((r) => ({ id: r.id, name: String(r.name), month: Number(r.month), day: Number(r.day), source: String(r.source ?? ''), approved: Boolean(r.approved), addedAt: Number(r.added_at ?? 0) }))
    .sort((a, b) => a.month - b.month || a.day - b.day);
}

export function addFestival(core: AppCore, name: string, month: number, day: number, source: string): void {
  const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  // Every new entry starts unapproved: the family must review it before the person can see it.
  core.replica.insert('festival', id, { name, month, day, source, approved: false, added_at: Date.now() });
}

export function setFestivalApproved(core: AppCore, id: string, approved: boolean): void {
  core.replica.set('festival', id, { approved });
}

export function deleteFestival(core: AppCore, id: string): void {
  core.replica.remove('festival', id);
}

/** A fact the family has approved. Life Story only ever shows these, never generated text. */
export interface Fact {
  id: string;
  person: string;
  relation: string;
  place: string;
  year: string;
  text: string;
  do_not_ask: boolean;
  thumb?: string;
}

export function listFacts(core: AppCore): Fact[] {
  return core.replica.list('fact').map((r) => ({
    id: r.id,
    person: String(r.person ?? ''),
    relation: String(r.relation ?? ''),
    place: String(r.place ?? ''),
    year: String(r.year ?? ''),
    text: String(r.text ?? ''),
    do_not_ask: Boolean(r.do_not_ask),
    thumb: typeof r.thumb === 'string' ? r.thumb : undefined,
  }));
}

export function saveFact(core: AppCore, f: Fact): void {
  const exists = core.replica.get('fact', f.id);
  const { id, ...fields } = f;
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'fact', id, fields);
}

export function deleteFact(core: AppCore, id: string): void {
  core.replica.remove('fact', id);
}

export interface Song {
  id: string;
  title: string;
  lyrics: string;
  /** Media id in the device's encrypted store. Family songs stay on the device where they were added. */
  media: string;
}

export function listSongs(core: AppCore): Song[] {
  return core.replica.list('song').map((r) => ({ id: r.id, title: String(r.title ?? ''), lyrics: String(r.lyrics ?? ''), media: String(r.media ?? '') }));
}

export function saveSong(core: AppCore, s: Song): void {
  const { id, ...fields } = s;
  core.replica.insert('song', id, fields);
}

export const wordId = (kind: 'face' | 'place', id: string) => `${kind}:${id}`;

/** Enrolled spoken words (personal keyword spotting). Templates are small and sync with the other records. */
export function listWords(core: AppCore): EnrolledWord[] {
  return core.replica.list('kws').map((r) => deserialise({ id: String(r.id), spread: Number(r.spread ?? 1), templates: (r.templates as StoredTemplate[]) ?? [] }));
}

export function saveWord(core: AppCore, w: EnrolledWord): void {
  const s = serialise(w);
  const exists = core.replica.get('kws', w.id);
  const fields = { spread: s.spread, templates: s.templates as unknown };
  (exists ? core.replica.set : core.replica.insert).call(core.replica, 'kws', w.id, fields);
}

export interface SpeechTiming {
  id: string;
  at: number;
  context: string;
  latency_ms: number;
  speech_ms: number;
  pause_ratio: number;
}

/** Only timing numbers are stored. The audio is never kept. */
export function saveTiming(core: AppCore, t: Omit<SpeechTiming, 'id'>): void {
  core.replica.insert('speech_timing', `st-${t.at.toString(36)}`, { ...t });
}

export function listTimings(core: AppCore): SpeechTiming[] {
  return core.replica
    .list('speech_timing')
    .map((r) => ({ id: r.id, at: Number(r.at), context: String(r.context), latency_ms: Number(r.latency_ms), speech_ms: Number(r.speech_ms), pause_ratio: Number(r.pause_ratio) }))
    .sort((a, b) => b.at - a.at);
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
