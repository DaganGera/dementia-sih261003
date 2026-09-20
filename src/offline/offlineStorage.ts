import {
  db,
  LocalPatient,
  LocalProfile,
  LocalGameAttempt,
  LocalMemory,
  LocalRoutine,
  LocalAlert,
  LocalCognitiveProfile,
  getDeviceId,
} from './db';
import { SyncQueue } from './syncQueue';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const OfflineStorage = {
  // ── Patients ──────────────────────────────────────────────
  async savePatient(patient: LocalPatient, enqueue = true): Promise<LocalPatient> {
    const existing = await db.patients.get(patient.id);
    const record: LocalPatient = {
      ...patient,
      created_at: patient.created_at || existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.patients.put(record);

    const payload = {
      id: record.id,
      full_name: record.full_name,
      date_of_birth: record.date_of_birth,
      gender: record.gender,
      preferred_language: record.preferred_language,
      medical_history: typeof record.medical_history === 'string'
        ? record.medical_history
        : JSON.stringify(record.medical_history || {}),
      emergency_contact_name: record.emergency_contact_name,
      emergency_contact_phone: record.emergency_contact_phone,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };

    if (enqueue) {
      const op = existing ? 'UPDATE' : 'INSERT';
      await SyncQueue.enqueue(op, 'patients', record.id, payload);
    }

    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('patients').upsert(payload, { onConflict: 'id' });
      } catch (e) {
        console.warn('Direct Supabase patient sync notice:', e);
      }
    }

    return record;
  },

  async getPatient(id: string): Promise<LocalPatient | undefined> {
    return await db.patients.get(id);
  },

  async getAllPatients(): Promise<LocalPatient[]> {
    return await db.patients.toArray();
  },

  // ── Game Attempts ─────────────────────────────────────────
  async saveGameAttempt(
    attempt: Omit<LocalGameAttempt, 'device_id' | 'sync_status'>,
    enqueue = true
  ): Promise<LocalGameAttempt> {
    const record: LocalGameAttempt = {
      ...attempt,
      device_id: getDeviceId(),
      sync_status: 'pending',
    };
    await db.gameAttempts.put(record);
    if (enqueue) {
      await SyncQueue.enqueue('INSERT', 'game_attempts', record.id, {
        id: record.id,
        patient_id: record.patient_id,
        game_type: record.game_type,
        difficulty_level: record.difficulty_level,
        score: record.score,
        accuracy: record.accuracy,
        correct_answers: record.correct_answers || 0,
        total_questions: record.total_questions || 0,
        duration_seconds: record.duration_seconds,
        created_at: record.created_at,
        device_id: record.device_id,
      });
    }
    return record;
  },

  async getGameAttempts(patientId?: string): Promise<LocalGameAttempt[]> {
    if (patientId) {
      return await db.gameAttempts
        .where('patient_id')
        .equals(patientId)
        .reverse()
        .sortBy('timestamp');
    }
    return await db.gameAttempts.orderBy('created_at').reverse().toArray();
  },

  // ── Memories ──────────────────────────────────────────────
  async saveMemory(memory: Omit<LocalMemory, 'updated_at'>, enqueue = true): Promise<LocalMemory> {
    const record: LocalMemory = {
      ...memory,
      updated_at: new Date().toISOString(),
    };
    await db.memories.put(record);
    if (enqueue) {
      await SyncQueue.enqueue('INSERT', 'memories', record.id, record);
    }
    return record;
  },

  async getMemories(patientId?: string): Promise<LocalMemory[]> {
    if (patientId) {
      return await db.memories.where('patient_id').equals(patientId).toArray();
    }
    return await db.memories.toArray();
  },

  async deleteMemory(id: string, enqueue = true): Promise<void> {
    await db.memories.delete(id);
    if (enqueue) {
      await SyncQueue.enqueue('DELETE', 'memories', id, { id });
    }
  },

  // ── Routines ──────────────────────────────────────────────
  async saveRoutine(routine: Omit<LocalRoutine, 'updated_at'>, enqueue = true): Promise<LocalRoutine> {
    const record: LocalRoutine = {
      ...routine,
      updated_at: new Date().toISOString(),
    };
    await db.routines.put(record);
    if (enqueue) {
      await SyncQueue.enqueue('INSERT', 'routines', record.id, record);
    }
    return record;
  },

  async getRoutines(patientId?: string): Promise<LocalRoutine[]> {
    if (patientId) {
      return await db.routines.where('patient_id').equals(patientId).toArray();
    }
    return await db.routines.toArray();
  },

  async toggleRoutine(id: string, enqueue = true): Promise<LocalRoutine | undefined> {
    const routine = await db.routines.get(id);
    if (routine) {
      const updated: LocalRoutine = {
        ...routine,
        enabled: !routine.enabled,
        updated_at: new Date().toISOString(),
      };
      await db.routines.put(updated);
      if (enqueue) {
        await SyncQueue.enqueue('UPDATE', 'routines', id, updated);
      }
      return updated;
    }
    return undefined;
  },

  async deleteRoutine(id: string, enqueue = true): Promise<void> {
    await db.routines.delete(id);
    if (enqueue) {
      await SyncQueue.enqueue('DELETE', 'routines', id, { id });
    }
  },

  // ── Alerts (SOS) ──────────────────────────────────────────
  async saveAlert(alert: LocalAlert, enqueue = true): Promise<LocalAlert> {
    await db.alerts.put(alert);
    if (enqueue) {
      await SyncQueue.enqueue('INSERT', 'alerts', alert.id, {
        id: alert.id,
        patient_id: alert.patient_id,
        patient_name: alert.patient_name,
        type: alert.type,
        source: alert.source,
        level: alert.level,
        accuracy: alert.accuracy,
        timestamp: new Date(alert.timestamp).toISOString(),
        status: alert.status,
        created_at: alert.created_at,
      });
    }
    return alert;
  },

  async getAlerts(patientId?: string): Promise<LocalAlert[]> {
    if (patientId) {
      return await db.alerts
        .where('patient_id')
        .equals(patientId)
        .reverse()
        .sortBy('timestamp');
    }
    return await db.alerts.orderBy('timestamp').reverse().toArray();
  },

  async updateAlertStatus(
    id: string,
    status: 'active' | 'acknowledged' | 'resolved',
    enqueue = true
  ): Promise<void> {
    let existing = await db.alerts.get(id);

    // If not found in IndexedDB, fallback to LocalStorage
    if (!existing) {
      try {
        const stored = localStorage.getItem('mindcare_accuracy_alerts');
        if (stored) {
          const list: any[] = JSON.parse(stored);
          const found = list.find((a) => a.id === id);
          if (found) {
            existing = {
              id: found.id,
              patient_id: found.patientId,
              patient_name: found.patientName,
              type: found.type || 'SOS',
              source: found.source || 'manual',
              level: found.level || 'sos',
              accuracy: found.accuracy,
              timestamp: found.timestamp || Date.now(),
              status: found.status,
              created_at: new Date(found.timestamp || Date.now()).toISOString(),
            };
          }
        }
      } catch (e) {
        console.warn('LocalStorage alert lookup fallback error', e);
      }
    }

    if (status === 'resolved') {
      try {
        const resolvedList = JSON.parse(localStorage.getItem('mindcare_resolved_alerts') || '[]');
        if (!resolvedList.includes(id)) {
          resolvedList.push(id);
          localStorage.setItem('mindcare_resolved_alerts', JSON.stringify(resolvedList));
        }
      } catch {}
    }

    if (existing) {
      const updated: LocalAlert = {
        ...existing,
        status,
        acknowledged_at: status === 'acknowledged' ? new Date().toISOString() : existing.acknowledged_at,
        resolved_at: status === 'resolved' ? (existing.resolved_at || new Date().toISOString()) : existing.resolved_at,
      };
      await db.alerts.put(updated);

      if (enqueue) {
        await SyncQueue.enqueue('UPDATE', 'alerts', id, {
          id,
          status,
          acknowledged_at: updated.acknowledged_at,
          resolved_at: updated.resolved_at,
        });
      }

      // Direct cloud update if connected
      if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { error } = await supabase
            .from('alerts')
            .update({
              status,
              acknowledged_at: updated.acknowledged_at,
              resolved_at: updated.resolved_at,
            })
            .eq('id', id);
          if (error) console.warn('Supabase alert status update error:', error.message);
        } catch (e) {
          console.warn('Supabase alert status update exception:', e);
        }
      }
    }
  },

  /**
   * Reconciles alerts between LocalStorage and IndexedDB (e.g. if resolved in one store)
   */
  async reconcileAlerts(): Promise<void> {
    try {
      let resolvedIds: string[] = [];
      try {
        resolvedIds = JSON.parse(localStorage.getItem('mindcare_resolved_alerts') || '[]');
      } catch {}

      const stored = localStorage.getItem('mindcare_accuracy_alerts');
      if (stored) {
        const list: any[] = JSON.parse(stored);
        for (const item of list) {
          if (item.status === 'resolved' && !resolvedIds.includes(item.id)) {
            resolvedIds.push(item.id);
          }
        }
      }

      for (const resId of resolvedIds) {
        const dbAlert = await db.alerts.get(resId);
        const resolvedAt = dbAlert?.resolved_at || new Date().toISOString();
        if (dbAlert && dbAlert.status !== 'resolved') {
          dbAlert.status = 'resolved';
          dbAlert.resolved_at = resolvedAt;
          await db.alerts.put(dbAlert);
        }

        if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await supabase
              .from('alerts')
              .update({ status: 'resolved', resolved_at: resolvedAt })
              .eq('id', resId);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Alert reconciliation notice:', e);
    }
  },

  // ── Cognitive Profiles ────────────────────────────────────
  async saveCognitiveProfile(profile: LocalCognitiveProfile, enqueue = true): Promise<void> {
    const record: LocalCognitiveProfile = {
      ...profile,
      updated_at: new Date().toISOString(),
    };
    await db.cognitiveProfiles.put(record);
    if (enqueue) {
      await SyncQueue.enqueue('INSERT', 'cognitive_profiles', record.id, record);
    }
  },

  async getCognitiveProfile(patientId: string): Promise<LocalCognitiveProfile | undefined> {
    return await db.cognitiveProfiles.where('patient_id').equals(patientId).first();
  },

  // ── Profiles ──────────────────────────────────────────────
  async saveProfile(profile: LocalProfile): Promise<LocalProfile> {
    const existing = await db.profiles.get(profile.id);
    const record: LocalProfile = {
      ...profile,
      created_at: profile.created_at || existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.profiles.put(record);
    return record;
  },

  async getProfile(id: string): Promise<LocalProfile | undefined> {
    return await db.profiles.get(id);
  },

  async getAllProfiles(): Promise<LocalProfile[]> {
    return await db.profiles.toArray();
  },
};
