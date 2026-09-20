import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SyncQueue } from './syncQueue';
import { db, SyncQueueItem } from './db';

export type SyncState = 'online' | 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncStatusInfo {
  state: SyncState;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
  isCloudConfigured: boolean;
}

type SyncStatusListener = (info: SyncStatusInfo) => void;

class SyncManagerClass {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncStatusListener> = new Set();
  private timer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network online detected. Triggering Sync...');
        this.startSync();
      });

      window.addEventListener('offline', () => {
        console.log('🟠 Network offline detected.');
        this.broadcastStatus();
      });

      // Periodic sync every 30 seconds if online
      this.timer = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.startSync();
        }
      }, 30000);
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): SyncStatusInfo {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    let state: SyncState = 'online';

    if (!isOnline) {
      state = 'offline';
    } else if (this.isSyncing) {
      state = 'syncing';
    } else if (this.lastError) {
      state = 'error';
    } else if (this.lastSyncTime) {
      state = 'synced';
    }

    return {
      state,
      pendingCount: 0,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      isCloudConfigured: isSupabaseConfigured(),
    };
  }

  private broadcastStatus(pendingCount = 0): void {
    const status = {
      ...this.getStatus(),
      pendingCount,
    };
    this.listeners.forEach((cb) => cb(status));
  }

  public async startSync(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = await SyncQueue.countPending();
      this.broadcastStatus(pending);
      return;
    }

    if (!isSupabaseConfigured()) {
      const pending = await SyncQueue.countPending();
      this.broadcastStatus(pending);
      return;
    }

    this.isSyncing = true;
    this.lastError = null;
    let pendingCount = await SyncQueue.countPending();
    this.broadcastStatus(pendingCount);

    try {
      // 1. Process Pending Local Queue (Upload to Supabase)
      const tasks = await SyncQueue.getPending();
      for (const task of tasks) {
        await this.processTask(task);
      }

      // 2. Pull Remote Cloud Data (Download updates to IndexedDB)
      await this.pullCloudData();

      this.lastSyncTime = Date.now();
      pendingCount = await SyncQueue.countPending();
    } catch (e: any) {
      console.warn('Sync manager execution warning', e);
      this.lastError = e?.message || 'Sync encountered a temporary issue';
    } finally {
      this.isSyncing = false;
      const finalCount = await SyncQueue.countPending();
      this.broadcastStatus(finalCount);
    }
  }

  private async processTask(task: SyncQueueItem): Promise<void> {
    await SyncQueue.markProcessing(task.id);
    try {
      const { table, operation, recordId, payload } = task;
      let error: any = null;

      if (table === 'cognitive_profiles') {
        const sanitizedPayload = this.sanitizePayloadForPostgres(table, payload);
        const { data: existing } = await supabase
          .from('cognitive_profiles')
          .select('id')
          .eq('patient_id', sanitizedPayload.patient_id)
          .maybeSingle();

        if (existing?.id) {
          const res = await supabase.from('cognitive_profiles').update(sanitizedPayload).eq('id', existing.id);
          error = res.error;
        } else {
          const res = await supabase.from('cognitive_profiles').insert(sanitizedPayload);
          error = res.error;
        }
      } else if (operation === 'UPDATE') {
        // Format payload to match PostgreSQL schema constraints
        const sanitizedPayload = this.sanitizePayloadForPostgres(table, payload);
        const res = await supabase.from(table).update(sanitizedPayload).eq('id', recordId);
        error = res.error;
      } else if (operation === 'INSERT') {
        const sanitizedPayload = this.sanitizePayloadForPostgres(table, payload);
        const res = await supabase.from(table).upsert(sanitizedPayload, { onConflict: 'id' });
        error = res.error;
      } else if (operation === 'DELETE') {
        const res = await supabase.from(table).delete().eq('id', recordId);
        error = res.error;
      }

      if (error) {
        // If row-level security rejects because unauthenticated, log but don't crash
        console.warn(`Sync failed for table ${table}:`, error.message);
        await SyncQueue.markFailed(task.id, error.message);
      } else {
        await SyncQueue.markCompleted(task.id);
        // If it was a game attempt, mark local sync_status as 'synced'
        if (table === 'game_attempts') {
          await db.gameAttempts.update(recordId, { sync_status: 'synced' });
        }
      }
    } catch (e: any) {
      console.warn('Unexpected error during task sync', e);
      await SyncQueue.markFailed(task.id, e?.message || 'Unknown network error');
    }
  }

  private sanitizePayloadForPostgres(table: string, payload: any): any {
    const copy = { ...payload };

    // Format fields per table
    if (table === 'game_attempts') {
      // Ensure numeric scores and ISO dates
      copy.score = Number(copy.score) || 0;
      copy.accuracy = Number(copy.accuracy) || 0;
      copy.difficulty_level = Number(copy.difficulty_level) || 1;
      copy.duration_seconds = Number(copy.duration_seconds) || 0;
      delete copy.timestamp; // Postgres uses created_at
    }

    if (table === 'alerts') {
      if (typeof copy.timestamp === 'number') {
        copy.timestamp = new Date(copy.timestamp).toISOString();
      }
    }

    if (table === 'patients') {
      if (copy.medical_history && typeof copy.medical_history === 'object') {
        copy.medical_history = JSON.stringify(copy.medical_history);
      }
      delete copy.raw_profile;
    }

    if (table === 'routines') {
      // Postgres TIME accepts 'HH:MM:SS'
      if (copy.scheduled_time) {
        const timeStr = String(copy.scheduled_time).trim();
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2];
          const modifier = match[3] ? match[3].toUpperCase() : 'AM';
          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          copy.scheduled_time = `${hours.toString().padStart(2, '0')}:${minutes}:00`;
        } else if (/^\d{2}:\d{2}$/.test(timeStr)) {
          copy.scheduled_time = `${timeStr}:00`;
        }
      }
      // If id is not a valid UUID, delete it so Postgres auto-generates gen_random_uuid()
      if (copy.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(copy.id)) {
        delete copy.id;
      }
    }

    if (table === 'cognitive_profiles') {
      copy.average_accuracy = Number(copy.average_accuracy) || 0;
      copy.recent_accuracy = Number(copy.recent_accuracy) || 0;
      copy.games_completed = Number(copy.games_completed) || 0;
      copy.current_level = Number(copy.current_level) || 1;
      copy.memory_score = Number(copy.memory_score) || 0;
      copy.attention_score = Number(copy.attention_score) || 0;
      copy.recall_score = Number(copy.recall_score) || 0;
      copy.consistency_score = Number(copy.consistency_score) || 0;
      if (copy.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(copy.id)) {
        delete copy.id;
      }
    }

    return copy;
  }

  private async pullCloudData(): Promise<void> {
    try {
      // Pull recent alerts
      const { data: cloudAlerts } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (cloudAlerts && Array.isArray(cloudAlerts)) {
        let resolvedIds: string[] = [];
        try {
          resolvedIds = JSON.parse(localStorage.getItem('mindcare_resolved_alerts') || '[]');
        } catch {}

        for (const a of cloudAlerts) {
          const existing = await db.alerts.get(a.id);
          const isLocallyResolved = existing?.status === 'resolved' || resolvedIds.includes(a.id);

          if (isLocallyResolved && a.status !== 'resolved') {
            // Push resolved status up to cloud so it doesn't stay active in PostgreSQL
            const resolvedAt = existing?.resolved_at || new Date().toISOString();
            await supabase.from('alerts').update({
              status: 'resolved',
              resolved_at: resolvedAt
            }).eq('id', a.id);
            if (existing && existing.status !== 'resolved') {
              await db.alerts.update(a.id, { status: 'resolved', resolved_at: resolvedAt });
            }
            continue;
          }

          const cloudTimestamp = new Date(a.timestamp).getTime();
          if (!existing || existing.timestamp < cloudTimestamp || (!isLocallyResolved && existing.status !== a.status)) {
            await db.alerts.put({
              id: a.id,
              patient_id: a.patient_id,
              patient_name: a.patient_name || 'Meena Sharma',
              type: a.type || 'SOS',
              source: a.source,
              level: a.level,
              accuracy: a.accuracy,
              timestamp: cloudTimestamp,
              status: a.status,
              created_at: a.created_at,
              acknowledged_at: a.acknowledged_at,
              resolved_at: a.resolved_at,
            });
          }
        }
      }

      // Pull cognitive profiles
      const { data: cloudProfiles } = await supabase
        .from('cognitive_profiles')
        .select('*');

      if (cloudProfiles && Array.isArray(cloudProfiles)) {
        for (const cp of cloudProfiles) {
          await db.cognitiveProfiles.put({
            id: cp.id,
            patient_id: cp.patient_id,
            average_accuracy: Number(cp.average_accuracy) || 0,
            recent_accuracy: Number(cp.recent_accuracy) || 0,
            games_completed: Number(cp.games_completed) || 0,
            current_level: Number(cp.current_level) || 1,
            memory_score: Number(cp.memory_score) || 0,
            attention_score: Number(cp.attention_score) || 0,
            recall_score: Number(cp.recall_score) || 0,
            consistency_score: Number(cp.consistency_score) || 0,
            updated_at: cp.updated_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Ignore background pull errors
    }
  }
}

export const syncManager = new SyncManagerClass();
