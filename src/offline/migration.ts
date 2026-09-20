import { db } from './db';
import { OfflineStorage } from './offlineStorage';
import { syncManager } from './syncManager';

const MIGRATION_VERSION_KEY = 'mindcare_db_version';
const CURRENT_VERSION = 1;

export async function runInitialMigration(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const storedVersion = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10);
    if (storedVersion >= CURRENT_VERSION) {
      return; // Migration already completed
    }

    console.log('🔄 SIROI: Running initial LocalStorage to IndexedDB migration...');

    // 1. Migrate Patient Profile
    const rawPatient = localStorage.getItem('mindcare_patient_profile');
    if (rawPatient) {
      try {
        const patientData = JSON.parse(rawPatient);
        if (patientData && patientData.id) {
          await OfflineStorage.savePatient({
            id: patientData.id || 'pat-demo-1',
            full_name: patientData.basicInfo?.name || 'Meena Sharma',
            date_of_birth: patientData.basicInfo?.dateOfBirth,
            gender: patientData.basicInfo?.gender || 'Female',
            preferred_language: patientData.basicInfo?.language || 'en',
            medical_history: patientData.medicalHistory,
            emergency_contact_name: patientData.emergencyContact?.primaryCaregiverName,
            emergency_contact_phone: patientData.emergencyContact?.primaryContactPhone,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            raw_profile: patientData,
          }, false);
        }
      } catch (e) {
        console.warn('Migration error for patient profile', e);
      }
    }

    // 2. Migrate Game Sessions
    const rawSessions = localStorage.getItem('mindcare_game_sessions');
    if (rawSessions) {
      try {
        const sessions = JSON.parse(rawSessions);
        if (Array.isArray(sessions)) {
          for (const s of sessions) {
            await db.gameAttempts.put({
              id: s.id || `gs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              patient_id: 'pat-demo-1',
              game_type: s.gameId,
              difficulty_level: s.difficultyLevel || 1,
              score: s.score || 0,
              accuracy: s.accuracy || 0,
              correct_answers: s.attempts || 0,
              total_questions: s.attempts || 0,
              duration_seconds: s.timeSeconds || 0,
              timestamp: s.timestamp || new Date().toISOString(),
              created_at: s.timestamp || new Date().toISOString(),
              device_id: 'migrated-local',
              sync_status: 'pending',
            });
          }
        }
      } catch (e) {
        console.warn('Migration error for game sessions', e);
      }
    }

    // 3. Migrate SOS Alerts
    const rawAlerts = localStorage.getItem('mindcare_sos_alerts');
    if (rawAlerts) {
      try {
        const alerts = JSON.parse(rawAlerts);
        if (Array.isArray(alerts)) {
          for (const a of alerts) {
            await db.alerts.put({
              id: a.id,
              patient_id: a.patientId || 'pat-demo-1',
              patient_name: a.patientName || 'Meena Sharma',
              type: 'SOS',
              source: a.source || 'accuracy',
              level: a.level || 'caution',
              accuracy: a.accuracy,
              timestamp: a.timestamp || Date.now(),
              status: a.status || 'active',
              created_at: new Date(a.timestamp || Date.now()).toISOString(),
            });
          }
        }
      } catch (e) {
        console.warn('Migration error for SOS alerts', e);
      }
    }

    // 4. Migrate Routine Items
    const rawRoutine = localStorage.getItem('mindcare_routine');
    if (rawRoutine) {
      try {
        const routines = JSON.parse(rawRoutine);
        if (Array.isArray(routines)) {
          for (const r of routines) {
            await db.routines.put({
              id: r.id,
              patient_id: 'pat-demo-1',
              title: r.activity,
              description: r.description || '',
              scheduled_time: r.time,
              repeat_pattern: 'daily',
              enabled: true,
              category: r.category,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.warn('Migration error for routines', e);
      }
    }

    // 5. Migrate Memories
    const rawPeople = localStorage.getItem('mindcare_familiar_people');
    if (rawPeople) {
      try {
        const people = JSON.parse(rawPeople);
        if (Array.isArray(people)) {
          for (const p of people) {
            await db.memories.put({
              id: p.id,
              patient_id: 'pat-demo-1',
              category: 'family',
              title: p.name,
              content: p.notes || `${p.relationship}`,
              person_name: p.name,
              metadata: { photoUrl: p.photoUrl, relationship: p.relationship },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.warn('Migration error for memories', e);
      }
    }

    // Mark migration version complete
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION.toString());
    console.log('✅ SIROI: LocalStorage to IndexedDB migration finished successfully.');

    // If online and cloud is configured, trigger initial sync
    if (navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }
  } catch (e) {
    console.error('Fatal migration error', e);
  }
}
