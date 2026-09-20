import Dexie, { Table } from 'dexie';

export interface LocalPatient {
  id: string;
  user_id?: string;
  full_name: string;
  date_of_birth?: string;
  gender?: string;
  preferred_language?: string;
  medical_history?: any;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  updated_at: string;
  raw_profile?: any;
}

export interface LocalGameAttempt {
  id: string;
  patient_id: string;
  game_type: string;
  difficulty_level: number;
  score: number;
  accuracy: number;
  correct_answers?: number;
  total_questions?: number;
  duration_seconds: number;
  timestamp: string;
  created_at: string;
  device_id?: string;
  sync_status: 'pending' | 'synced' | 'failed';
}

export interface LocalMemory {
  id: string;
  patient_id: string;
  category: string;
  title: string;
  content?: string;
  person_name?: string;
  place_name?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface LocalRoutine {
  id: string;
  patient_id: string;
  title: string;
  description?: string;
  scheduled_time: string;
  repeat_pattern: string;
  enabled: boolean;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface LocalAlert {
  id: string;
  patient_id: string;
  patient_name: string;
  type: 'SOS';
  source: 'accuracy' | 'manual';
  level: 'caution' | 'sos' | 'none';
  accuracy: number | null;
  timestamp: number;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface LocalCognitiveProfile {
  id: string;
  patient_id: string;
  average_accuracy: number;
  recent_accuracy: number;
  games_completed: number;
  current_level: number;
  memory_score: number;
  attention_score: number;
  recall_score: number;
  consistency_score: number;
  updated_at: string;
}

export interface SyncQueueItem {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  lastError?: string;
}

export interface LocalProfile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  relationship?: string;
  caregiving_relationship?: string;
  role: string;
  preferred_language: string;
  setup_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AppMetadata {
  key: string;
  value: any;
}

export class MindCareDatabase extends Dexie {
  patients!: Table<LocalPatient, string>;
  profiles!: Table<LocalProfile, string>;
  gameAttempts!: Table<LocalGameAttempt, string>;
  memories!: Table<LocalMemory, string>;
  routines!: Table<LocalRoutine, string>;
  alerts!: Table<LocalAlert, string>;
  cognitiveProfiles!: Table<LocalCognitiveProfile, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  appMetadata!: Table<AppMetadata, string>;

  constructor() {
    super('MindCareAI_DB');
    this.version(1).stores({
      patients: 'id, user_id, full_name, updated_at',
      gameAttempts: 'id, patient_id, game_type, difficulty_level, score, accuracy, timestamp, created_at, sync_status',
      memories: 'id, patient_id, category, title, updated_at',
      routines: 'id, patient_id, scheduled_time, enabled, updated_at',
      alerts: 'id, patient_id, type, source, level, status, timestamp, created_at',
      cognitiveProfiles: 'id, patient_id, updated_at',
      syncQueue: 'id, operation, table, recordId, createdAt, status, retryCount',
      appMetadata: 'key',
    });

    this.version(2).stores({
      profiles: 'id, full_name, email, phone, phone_number, relationship, caregiving_relationship, role, preferred_language, updated_at',
    });
  }
}

export const db = new MindCareDatabase();

// Device ID Generator & Helper (Requirement #36)
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'device-server';
  const STORAGE_KEY = 'mindcare_device_id';
  let devId = localStorage.getItem(STORAGE_KEY);
  if (!devId) {
    devId = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    localStorage.setItem(STORAGE_KEY, devId);
  }
  return devId;
}
