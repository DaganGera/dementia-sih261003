import {
  CaregiverProfile,
  ElderlyProfile,
  FamiliarPerson,
  FamiliarPlace,
  RoutineItem,
  Reminder,
  GameSession,
  GameType,
  CognitiveCategory,
  DeviceConnection,
  AccessibilitySettings,
  NotificationItem,
  PatientProfile,
} from '../types';
import { db } from '../offline/db';

import {
  INITIAL_CAREGIVER_PROFILE,
  INITIAL_ELDERLY_PROFILE,
  INITIAL_PATIENT_PROFILE,
  INITIAL_FAMILIAR_PEOPLE,
  INITIAL_FAMILIAR_PLACES,
  INITIAL_ROUTINE,
  INITIAL_REMINDERS,
  INITIAL_GAME_SESSIONS,
  INITIAL_DEVICE_CONNECTION,
  INITIAL_NOTIFICATIONS,
} from '../utils/demoData';

import { notifySyncEvent } from './realtime';
import { AlertEngineService } from './alertEngine';
import { OfflineStorage } from '../offline/offlineStorage';
import { generateUUID } from '../utils/uuid';
import { CognitiveProfileService } from './cognitiveProfileService';

function isValidUUID(str: any): boolean {
  return Boolean(str && typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}
import { syncManager } from '../offline/syncManager';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const KEYS = {
  CAREGIVER_PROFILE: 'mindcare_caregiver_profile',
  ELDERLY_PROFILE: 'mindcare_elderly_profile',
  PATIENT_PROFILE: 'mindcare_patient_profile',
  FAMILIAR_PEOPLE: 'mindcare_familiar_people',
  FAMILIAR_PLACES: 'mindcare_familiar_places',
  ROUTINE: 'mindcare_routine',
  REMINDERS: 'mindcare_reminders',
  GAME_SESSIONS: 'mindcare_game_sessions',
  DEVICE_CONNECTION: 'mindcare_device_connection',
  ACCESSIBILITY: 'mindcare_accessibility',
  NOTIFICATIONS: 'mindcare_notifications',
};

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  textSize: 'medium',
  highContrast: false,
  voiceGuidance: true,
};

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from storage`, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T, syncChannel = true): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (syncChannel) {
      notifySyncEvent(key, value);
    }
  } catch (e) {
    console.error(`Error writing ${key} to storage`, e);
  }
}

export const StorageService = {
  resetDemoData(): void {
    setItem(KEYS.CAREGIVER_PROFILE, INITIAL_CAREGIVER_PROFILE);
    setItem(KEYS.ELDERLY_PROFILE, INITIAL_ELDERLY_PROFILE);
    setItem(KEYS.PATIENT_PROFILE, INITIAL_PATIENT_PROFILE);
    setItem(KEYS.FAMILIAR_PEOPLE, INITIAL_FAMILIAR_PEOPLE);
    setItem(KEYS.FAMILIAR_PLACES, INITIAL_FAMILIAR_PLACES);
    setItem(KEYS.ROUTINE, INITIAL_ROUTINE);
    setItem(KEYS.REMINDERS, INITIAL_REMINDERS);
    setItem(KEYS.GAME_SESSIONS, INITIAL_GAME_SESSIONS);
    setItem(KEYS.DEVICE_CONNECTION, INITIAL_DEVICE_CONNECTION);
    setItem(KEYS.ACCESSIBILITY, DEFAULT_ACCESSIBILITY);
    setItem(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  },

  getCaregiverProfile(): CaregiverProfile {
    return getItem<CaregiverProfile>(KEYS.CAREGIVER_PROFILE, INITIAL_CAREGIVER_PROFILE);
  },
  saveCaregiverProfile(profile: CaregiverProfile): void {
    setItem(KEYS.CAREGIVER_PROFILE, profile);
  },

  getActivePatientId(caregiverId?: string): string {
    // 1. If caregiverId is provided, check caregiver-patient mapping
    if (caregiverId) {
      const cgMap = getItem<Record<string, string>>('mindcare_caregiver_patient_map', {});
      if (cgMap[caregiverId]) {
        return cgMap[caregiverId];
      }
      const activeForCg = localStorage.getItem(`mindcare_active_patient_${caregiverId}`);
      if (activeForCg) return activeForCg;
      const cgPatients = getItem<string[]>(`mindcare_caregiver_patients_${caregiverId}`, []);
      if (cgPatients.length > 0) return cgPatients[0];
    }

    // 2. Check if a patient session is active
    try {
      const patientSessionStr = localStorage.getItem('mindcare_patient_session');
      if (patientSessionStr) {
        const ps = JSON.parse(patientSessionStr);
        if (ps?.id) return ps.id;
      }
    } catch {}

    // 3. Check explicitly selected active patient
    const current = localStorage.getItem('mindcare_current_active_patient_id');
    if (current && current !== 'pat-demo-1') return current;

    // 4. Check if multi-patient dictionary has real patients
    const dict = getItem<Record<string, PatientProfile>>('mindcare_patients_dict', {});
    const realPatients = Object.values(dict).filter(p => p.id && p.id !== 'pat-demo-1');
    if (realPatients.length > 0) {
      return realPatients[realPatients.length - 1].id;
    }

    // 5. Default to standard patient profile ID or demo
    const defaultProfile = getItem<PatientProfile>(KEYS.PATIENT_PROFILE, INITIAL_PATIENT_PROFILE);
    if (defaultProfile?.id && defaultProfile.id !== 'pat-demo-1') {
      return defaultProfile.id;
    }
    return 'pat-demo-1';
  },

  setActivePatientId(patientId: string, caregiverId?: string): void {
    localStorage.setItem('mindcare_current_active_patient_id', patientId);
    if (caregiverId) {
      const cgMap = getItem<Record<string, string>>('mindcare_caregiver_patient_map', {});
      cgMap[caregiverId] = patientId;
      setItem('mindcare_caregiver_patient_map', cgMap);
      localStorage.setItem(`mindcare_active_patient_${caregiverId}`, patientId);
    }
  },

  getAllPatientProfiles(): PatientProfile[] {
    const dict = getItem<Record<string, PatientProfile>>('mindcare_patients_dict', {});
    const list = Object.values(dict);
    if (list.length > 0) return list;
    const single = getItem<PatientProfile>(KEYS.PATIENT_PROFILE, INITIAL_PATIENT_PROFILE);
    return [single];
  },

  getElderlyProfile(patientId?: string): ElderlyProfile {
    const patient = this.getPatientProfile(patientId);
    return {
      id: patient.id,
      name: patient.basicInfo.name,
      age: patient.basicInfo.age,
      dateOfBirth: patient.basicInfo.dateOfBirth,
      gender: patient.basicInfo.gender,
      state: patient.basicInfo.state,
      preferredLanguage: patient.basicInfo.language,
      phone: patient.basicInfo.phone || '',
      emergencyContact: patient.emergencyContact?.primaryContactPhone || '',
      relationship: patient.emergencyContact?.relationship || '',
      caregiverName: patient.emergencyContact?.primaryCaregiverName || '',
      dailyWakeUpTime: '07:00 AM',
      preferredActivityTime: '10:30 AM',
      photoUrl: patient.basicInfo.photo,
    };
  },
  saveElderlyProfile(profile: ElderlyProfile): void {
    setItem(KEYS.ELDERLY_PROFILE, profile);
    setItem(`${KEYS.ELDERLY_PROFILE}_${profile.id}`, profile);
  },

  getPatientProfile(patientId?: string, caregiverId?: string): PatientProfile {
    const dict = getItem<Record<string, PatientProfile>>('mindcare_patients_dict', {});

    // If specific patient ID is requested
    if (patientId && dict[patientId]) {
      return dict[patientId];
    }

    // If caregiver ID is requested, find their assigned patient
    if (caregiverId) {
      const cgMap = getItem<Record<string, string>>('mindcare_caregiver_patient_map', {});
      const mappedId = cgMap[caregiverId] || localStorage.getItem(`mindcare_active_patient_${caregiverId}`);
      if (mappedId && dict[mappedId]) {
        return dict[mappedId];
      }
    }

    // Check currently active patient ID
    const activeId = this.getActivePatientId(caregiverId);
    if (activeId && dict[activeId]) {
      return dict[activeId];
    }

    // If dict has real created patients, prefer the most recent real patient over demo
    const realPatients = Object.values(dict).filter(p => p.id && p.id !== 'pat-demo-1');
    if (realPatients.length > 0) {
      return realPatients[realPatients.length - 1];
    }

    // Fallback to legacy single-patient profile or initial profile
    const profile = getItem<PatientProfile>(KEYS.PATIENT_PROFILE, INITIAL_PATIENT_PROFILE);
    if (!profile.patientCredentials) {
      if (profile.id === 'pat-demo-1') {
        profile.patientCredentials = {
          loginId: 'meena.sharma',
          password: 'patient123',
        };
      } else {
        profile.patientCredentials = {
          loginId: profile.basicInfo?.name || '',
          password: '',
        };
      }
    }
    return profile;
  },

  savePatientProfile(profile: PatientProfile, caregiverId?: string): void {
    // 1. Save in multi-patient dictionary
    const dict = getItem<Record<string, PatientProfile>>('mindcare_patients_dict', {});
    dict[profile.id] = profile;
    setItem('mindcare_patients_dict', dict);
    setItem(`mindcare_patient_${profile.id}`, profile);

    // 2. Map caregiver to this patient if provided
    if (caregiverId) {
      const cgMap = getItem<Record<string, string>>('mindcare_caregiver_patient_map', {});
      cgMap[caregiverId] = profile.id;
      setItem('mindcare_caregiver_patient_map', cgMap);
      localStorage.setItem(`mindcare_active_patient_${caregiverId}`, profile.id);
    }

    // 3. Mark as current active patient
    localStorage.setItem('mindcare_current_active_patient_id', profile.id);
    setItem(KEYS.PATIENT_PROFILE, profile);

    // 4. Save corresponding elderly profile
    this.saveElderlyProfile({
      id: profile.id,
      name: profile.basicInfo.name,
      age: profile.basicInfo.age,
      dateOfBirth: profile.basicInfo.dateOfBirth,
      gender: profile.basicInfo.gender,
      state: profile.basicInfo.state,
      preferredLanguage: profile.basicInfo.language,
      emergencyContact: profile.emergencyContact?.primaryContactPhone || '',
      caregiverName: profile.emergencyContact?.primaryCaregiverName || '',
      dailyWakeUpTime: '07:00 AM',
      preferredActivityTime: '10:30 AM',
      photoUrl: profile.basicInfo.photo,
    });

    // 5. Offline-first IndexedDB persistence
    OfflineStorage.savePatient({
      id: profile.id,
      full_name: profile.basicInfo.name,
      date_of_birth: profile.basicInfo.dateOfBirth,
      gender: profile.basicInfo.gender,
      preferred_language: profile.basicInfo.language,
      medical_history: profile.medicalHistory,
      emergency_contact_name: profile.emergencyContact?.primaryCaregiverName,
      emergency_contact_phone: profile.emergencyContact?.primaryContactPhone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw_profile: profile,
    }).then(() => {
      CognitiveProfileService.initializeProfile(profile.id).catch(() => {});
    }).catch(() => {});
  },

  /**
   * Sync all registered patients from Supabase cloud database to local storage
   * Essential for mobile devices and fresh browsers connecting to the server
   */
  async syncPatientsFromCloud(): Promise<PatientProfile[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data: dbPatients, error } = await supabase.from('patients').select('*');
      if (error || !dbPatients || dbPatients.length === 0) return [];

      const dict = getItem<Record<string, PatientProfile>>('mindcare_patients_dict', {});
      const synced: PatientProfile[] = [];

      for (const dp of dbPatients) {
        let medHistory: any = {};
        try {
          medHistory = typeof dp.medical_history === 'string' ? JSON.parse(dp.medical_history) : (dp.medical_history || {});
        } catch {}

        const creds = medHistory?.patientCredentials || {};
        const patName = dp.full_name || 'Patient';
        const patNameLower = patName.toLowerCase();

        // Infer or read credentials
        let defaultPass = 'password123';
        if (patNameLower.includes('kalanjiam')) defaultPass = '234567';

        const patProfile: PatientProfile = {
          id: dp.id,
          basicInfo: {
            name: patName,
            age: dp.date_of_birth ? Math.floor((Date.now() - new Date(dp.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : (medHistory?.age || 76),
            gender: dp.gender || 'Not Specified',
            dateOfBirth: dp.date_of_birth || '',
            language: dp.preferred_language || 'en',
            state: medHistory?.state || 'Assam',
            phone: medHistory?.phone || '',
            photo: medHistory?.photo || '',
          },
          medicalHistory: medHistory,
          emergencyContact: {
            primaryCaregiverName: dp.emergency_contact_name || '',
            primaryContactName: dp.emergency_contact_name || '',
            primaryContactPhone: dp.emergency_contact_phone || '',
            relationship: medHistory?.relationship || 'Family Member',
            doctorName: '',
            allergies: [],
          },
          patientCredentials: {
            loginId: (creds.loginId || patName).trim(),
            password: (creds.password || defaultPass).trim(),
          },
          medications: [],
          dailyRoutine: [],
          cognitiveProfile: {
            memory: 75,
            attention: 70,
            recognition: 80,
            recall: 65,
            language: 75,
            familiarity: 85,
          },
          dailyFunction: {
            memoryDifficulty: 'occasional',
            attentionDifficulty: 'occasional',
            peopleRecognitionDifficulty: 'none',
            placeRecognitionDifficulty: 'none',
            routineDifficulty: 'occasional',
            communicationDifficulty: 'none',
            dailyTaskDifficulty: 'none',
          },
          caregiverObservations: [],
          accessibility: {
            largeText: !!medHistory?.visionDifficulties,
            highContrast: false,
            voiceEnabled: true,
            reduceMotion: false,
          },
          gamification: {
            xp: 0,
            mindPoints: 0,
            userLevel: 1,
            currentStreak: 0,
            lastActiveDate: new Date().toISOString(),
            unlockedBadges: [],
          },
        };

        dict[patProfile.id] = patProfile;
        setItem(`mindcare_patient_${patProfile.id}`, patProfile);
        synced.push(patProfile);
      }

      setItem('mindcare_patients_dict', dict);
      return synced;
    } catch (e) {
      console.warn('syncPatientsFromCloud notice:', e);
      return [];
    }
  },


  getFamiliarPeople(patientId?: string): FamiliarPerson[] {
    const pid = patientId || this.getActivePatientId();
    if (pid && pid !== 'pat-demo-1') {
      const patientSpecific = getItem<FamiliarPerson[]>(`${KEYS.FAMILIAR_PEOPLE}_${pid}`, []);
      const filteredSpecific = patientSpecific.filter(p => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
      if (filteredSpecific.length > 0) {
        return filteredSpecific;
      }
    }

    // Check if active patient id is different and has items
    const activePid = this.getActivePatientId();
    if (activePid && activePid !== pid && activePid !== 'pat-demo-1') {
      const activeSpecific = getItem<FamiliarPerson[]>(`${KEYS.FAMILIAR_PEOPLE}_${activePid}`, []);
      const filteredActive = activeSpecific.filter(p => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
      if (filteredActive.length > 0) {
        return filteredActive;
      }
    }

    // Check all localStorage keys matching mindcare_familiar_people_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${KEYS.FAMILIAR_PEOPLE}_`)) {
          const list = getItem<FamiliarPerson[]>(k, []);
          const valid = list.filter(p => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
          if (valid.length > 0) return valid;
        }
      }
    } catch {}

    // Patient profile from Profile Creation
    const profile = this.getPatientProfile(pid);
    if (profile?.familiarPeople && Array.isArray(profile.familiarPeople) && profile.familiarPeople.length > 0) {
      const valid = profile.familiarPeople.filter(p => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
      if (valid.length > 0) return valid;
    }
    const medHist = profile?.medicalHistory as any;
    if (medHist?.familiarPeople && Array.isArray(medHist.familiarPeople) && medHist.familiarPeople.length > 0) {
      const valid = medHist.familiarPeople.filter((p: any) => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
      if (valid.length > 0) return valid;
    }

    // Generic list (ensure demo items excluded)
    const genericList = getItem<FamiliarPerson[]>(KEYS.FAMILIAR_PEOPLE, []);
    const filteredGeneric = genericList.filter(p => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
    if (filteredGeneric.length > 0) return filteredGeneric;

    return [];
  },

  async fetchFamiliarPeopleFromCloud(patientId?: string): Promise<FamiliarPerson[]> {
    if (!isSupabaseConfigured()) {
      return this.getFamiliarPeople(patientId);
    }

    try {
      const pid = patientId || this.getActivePatientId();
      const candidateIds = new Set<string>();
      if (pid && pid !== 'pat-demo-1') {
        candidateIds.add(pid);
      }

      // Check current auth user session
      const { data: sessionData } = await supabase.auth.getSession();
      const currentAuthId = sessionData?.session?.user?.id;
      if (currentAuthId) {
        candidateIds.add(currentAuthId);
      }

      // Find any associated patients from patients table (by id or user_id)
      const searchIds = Array.from(candidateIds);
      if (searchIds.length > 0) {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, user_id')
          .or(searchIds.map(id => `id.eq.${id},user_id.eq.${id}`).join(','));

        if (pats && pats.length > 0) {
          for (const p of pats) {
            if (p.id) candidateIds.add(p.id);
          }
        }

        // Also check caregiver_patients link table
        const { data: cgLinks } = await supabase
          .from('caregiver_patients')
          .select('patient_id')
          .in('caregiver_id', searchIds);

        if (cgLinks && cgLinks.length > 0) {
          for (const link of cgLinks) {
            if (link.patient_id) candidateIds.add(link.patient_id);
          }
        }
      }

      const queryIds = Array.from(candidateIds).filter(id => id && id !== 'pat-demo-1');

      if (queryIds.length > 0) {
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .in('patient_id', queryIds)
          .eq('category', 'family');

        if (!error && data && data.length > 0) {
          const cloudPeople: FamiliarPerson[] = data.map((m: any) => ({
            id: m.id,
            name: m.person_name || m.title,
            relationship: (m.metadata && m.metadata.relationship) || m.content || '',
            photoUrl: (m.metadata && m.metadata.photoUrl) || '',
            notes: m.content || '',
          }));

          // Cache for all associated IDs so future queries find them immediately
          for (const cid of queryIds) {
            setItem(`${KEYS.FAMILIAR_PEOPLE}_${cid}`, cloudPeople);
          }
          setItem(KEYS.FAMILIAR_PEOPLE, cloudPeople);

          // Update active patient mapping in localStorage if patient was found
          const resolvedPatientId = queryIds.find(id => id !== currentAuthId);
          if (resolvedPatientId) {
            this.setActivePatientId(resolvedPatientId, currentAuthId);
          }

          return cloudPeople;
        }

        // Fallback: Check if stored directly on patients table in medical_history JSON
        const { data: patData } = await supabase
          .from('patients')
          .select('id, medical_history')
          .in('id', queryIds);

        if (patData && patData.length > 0) {
          for (const pRow of patData) {
            if (pRow.medical_history) {
              const med = typeof pRow.medical_history === 'string' ? JSON.parse(pRow.medical_history) : pRow.medical_history;
              if (med?.familiarPeople && Array.isArray(med.familiarPeople) && med.familiarPeople.length > 0) {
                const filtered = med.familiarPeople.filter((p: any) => p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');
                if (filtered.length > 0) {
                  for (const cid of queryIds) {
                    setItem(`${KEYS.FAMILIAR_PEOPLE}_${cid}`, filtered);
                  }
                  setItem(KEYS.FAMILIAR_PEOPLE, filtered);
                  return filtered;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch familiar people from Supabase', e);
    }
    return this.getFamiliarPeople(patientId);
  },

  addFamiliarPerson(person: Omit<FamiliarPerson, 'id'>, patientId?: string): FamiliarPerson {
    const pid = patientId || this.getActivePatientId();
    const people = this.getFamiliarPeople(pid);
    const personId = (person as any).id && isValidUUID((person as any).id) ? (person as any).id : generateUUID();
    const newPerson: FamiliarPerson = { ...person, id: personId };
    const updated = [newPerson, ...people.filter(p => p.name !== newPerson.name)];
    setItem(`${KEYS.FAMILIAR_PEOPLE}_${pid}`, updated);

    OfflineStorage.saveMemory({
      id: newPerson.id,
      patient_id: pid,
      category: 'family',
      title: newPerson.name,
      content: newPerson.notes || newPerson.relationship,
      person_name: newPerson.name,
      metadata: { photoUrl: newPerson.photoUrl || '', relationship: newPerson.relationship },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          const { error } = await supabase.from('memories').upsert({
            id: newPerson.id,
            patient_id: pid,
            category: 'family',
            title: newPerson.name,
            content: newPerson.notes || newPerson.relationship,
            person_name: newPerson.name,
            metadata: { photoUrl: newPerson.photoUrl || '', relationship: newPerson.relationship },
            created_at: new Date().toISOString(),
          }, { onConflict: 'id' });
          if (error) console.warn('Supabase memory upsert error:', error.message);
        } catch (e) {
          console.warn('Supabase memory save exception:', e);
        }
      })();
    }

    return newPerson;
  },

  deleteFamiliarPerson(id: string, patientId?: string): void {
    const pid = patientId || this.getActivePatientId();
    const people = this.getFamiliarPeople(pid);
    const filtered = people.filter(p => p.id !== id);
    setItem(`${KEYS.FAMILIAR_PEOPLE}_${pid}`, filtered);
    OfflineStorage.deleteMemory(id).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          await supabase.from('memories').delete().eq('id', id);
        } catch (e) {
          console.warn('Supabase memory delete exception:', e);
        }
      })();
    }
  },

  getFamiliarPlaces(patientId?: string): FamiliarPlace[] {
    const pid = patientId || this.getActivePatientId();
    if (pid && pid !== 'pat-demo-1') {
      const patientSpecific = getItem<FamiliarPlace[]>(`${KEYS.FAMILIAR_PLACES}_${pid}`, []);
      const filteredSpecific = patientSpecific.filter(p => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
      if (filteredSpecific.length > 0) {
        return filteredSpecific;
      }
    }

    // Check if active patient id is different and has items
    const activePid = this.getActivePatientId();
    if (activePid && activePid !== pid && activePid !== 'pat-demo-1') {
      const activeSpecific = getItem<FamiliarPlace[]>(`${KEYS.FAMILIAR_PLACES}_${activePid}`, []);
      const filteredActive = activeSpecific.filter(p => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
      if (filteredActive.length > 0) {
        return filteredActive;
      }
    }

    // Check all localStorage keys matching mindcare_familiar_places_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${KEYS.FAMILIAR_PLACES}_`)) {
          const list = getItem<FamiliarPlace[]>(k, []);
          const valid = list.filter(p => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
          if (valid.length > 0) return valid;
        }
      }
    } catch {}

    // Patient profile from Profile Creation
    const profile = this.getPatientProfile(pid);
    if (profile?.familiarPlaces && Array.isArray(profile.familiarPlaces) && profile.familiarPlaces.length > 0) {
      const valid = profile.familiarPlaces.filter(p => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
      if (valid.length > 0) return valid;
    }
    const medHist = profile?.medicalHistory as any;
    if (medHist?.familiarPlaces && Array.isArray(medHist.familiarPlaces) && medHist.familiarPlaces.length > 0) {
      const valid = medHist.familiarPlaces.filter((p: any) => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
      if (valid.length > 0) return valid;
    }

    // Generic list (ensure demo items excluded)
    const genericList = getItem<FamiliarPlace[]>(KEYS.FAMILIAR_PLACES, []);
    const filteredGeneric = genericList.filter(p => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
    if (filteredGeneric.length > 0) return filteredGeneric;

    return [];
  },

  async fetchFamiliarPlacesFromCloud(patientId?: string): Promise<FamiliarPlace[]> {
    if (!isSupabaseConfigured()) {
      return this.getFamiliarPlaces(patientId);
    }

    try {
      const pid = patientId || this.getActivePatientId();
      const candidateIds = new Set<string>();
      if (pid && pid !== 'pat-demo-1') {
        candidateIds.add(pid);
      }

      // Check current auth user session
      const { data: sessionData } = await supabase.auth.getSession();
      const currentAuthId = sessionData?.session?.user?.id;
      if (currentAuthId) {
        candidateIds.add(currentAuthId);
      }

      // Find any associated patients from patients table (by id or user_id)
      const searchIds = Array.from(candidateIds);
      if (searchIds.length > 0) {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, user_id')
          .or(searchIds.map(id => `id.eq.${id},user_id.eq.${id}`).join(','));

        if (pats && pats.length > 0) {
          for (const p of pats) {
            if (p.id) candidateIds.add(p.id);
          }
        }

        // Also check caregiver_patients link table
        const { data: cgLinks } = await supabase
          .from('caregiver_patients')
          .select('patient_id')
          .in('caregiver_id', searchIds);

        if (cgLinks && cgLinks.length > 0) {
          for (const link of cgLinks) {
            if (link.patient_id) candidateIds.add(link.patient_id);
          }
        }
      }

      const queryIds = Array.from(candidateIds).filter(id => id && id !== 'pat-demo-1');

      if (queryIds.length > 0) {
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .in('patient_id', queryIds)
          .eq('category', 'place');

        if (!error && data && data.length > 0) {
          const cloudPlaces: FamiliarPlace[] = data.map((m: any) => ({
            id: m.id,
            name: m.place_name || m.title,
            description: m.content || '',
            photoUrl: (m.metadata && m.metadata.photoUrl) || '',
          }));

          // Cache for all associated IDs so future queries find them immediately
          for (const cid of queryIds) {
            setItem(`${KEYS.FAMILIAR_PLACES}_${cid}`, cloudPlaces);
          }
          setItem(KEYS.FAMILIAR_PLACES, cloudPlaces);

          // Update active patient mapping in localStorage if patient was found
          const resolvedPatientId = queryIds.find(id => id !== currentAuthId);
          if (resolvedPatientId) {
            this.setActivePatientId(resolvedPatientId, currentAuthId);
          }

          return cloudPlaces;
        }

        // Fallback: Check if stored directly on patients table in medical_history JSON
        const { data: patData } = await supabase
          .from('patients')
          .select('id, medical_history')
          .in('id', queryIds);

        if (patData && patData.length > 0) {
          for (const pRow of patData) {
            if (pRow.medical_history) {
              const med = typeof pRow.medical_history === 'string' ? JSON.parse(pRow.medical_history) : pRow.medical_history;
              if (med?.familiarPlaces && Array.isArray(med.familiarPlaces) && med.familiarPlaces.length > 0) {
                const filtered = med.familiarPlaces.filter((p: any) => p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');
                if (filtered.length > 0) {
                  for (const cid of queryIds) {
                    setItem(`${KEYS.FAMILIAR_PLACES}_${cid}`, filtered);
                  }
                  setItem(KEYS.FAMILIAR_PLACES, filtered);
                  return filtered;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch familiar places from Supabase', e);
    }
    return this.getFamiliarPlaces(patientId);
  },

  addFamiliarPlace(place: Omit<FamiliarPlace, 'id'>, patientId?: string): FamiliarPlace {
    const pid = patientId || this.getActivePatientId();
    const places = this.getFamiliarPlaces(pid);
    const placeId = (place as any).id && isValidUUID((place as any).id) ? (place as any).id : generateUUID();
    const newPlace: FamiliarPlace = { ...place, id: placeId };
    const updated = [newPlace, ...places.filter(p => p.name !== newPlace.name)];
    setItem(`${KEYS.FAMILIAR_PLACES}_${pid}`, updated);

    OfflineStorage.saveMemory({
      id: newPlace.id,
      patient_id: pid,
      category: 'place',
      title: newPlace.name,
      content: newPlace.description,
      place_name: newPlace.name,
      metadata: { photoUrl: newPlace.photoUrl || '' },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          const { error } = await supabase.from('memories').upsert({
            id: newPlace.id,
            patient_id: pid,
            category: 'place',
            title: newPlace.name,
            content: newPlace.description,
            place_name: newPlace.name,
            metadata: { photoUrl: newPlace.photoUrl || '' },
            created_at: new Date().toISOString(),
          }, { onConflict: 'id' });
          if (error) console.warn('Supabase place memory upsert error:', error.message);
        } catch (e) {
          console.warn('Supabase place memory save exception:', e);
        }
      })();
    }

    return newPlace;
  },

  deleteFamiliarPlace(id: string, patientId?: string): void {
    const pid = patientId || this.getActivePatientId();
    const places = this.getFamiliarPlaces(pid);
    const filtered = places.filter(p => p.id !== id);
    setItem(`${KEYS.FAMILIAR_PLACES}_${pid}`, filtered);
    OfflineStorage.deleteMemory(id).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          await supabase.from('memories').delete().eq('id', id);
        } catch (e) {
          console.warn('Supabase memory delete exception:', e);
        }
      })();
    }
  },

  getRoutine(): RoutineItem[] {
    return getItem<RoutineItem[]>(KEYS.ROUTINE, INITIAL_ROUTINE);
  },
  addRoutineItem(item: Omit<RoutineItem, 'id'>, patientId?: string): RoutineItem {
    const routine = this.getRoutine();
    const newItem: RoutineItem = { ...item, id: `r-${Date.now()}` };
    const updated = [...routine, newItem];
    setItem(KEYS.ROUTINE, updated);

    const pid = patientId || this.getActivePatientId();
    OfflineStorage.saveRoutine({
      id: newItem.id,
      patient_id: pid,
      title: newItem.activity,
      description: newItem.description,
      scheduled_time: newItem.time,
      repeat_pattern: 'daily',
      enabled: true,
      category: newItem.category,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return newItem;
  },
  deleteRoutineItem(id: string): void {
    const routine = this.getRoutine();
    setItem(KEYS.ROUTINE, routine.filter(r => r.id !== id));
    OfflineStorage.deleteRoutine(id).catch(() => {});
  },

  savePatientReminders(reminders: Reminder[], patientId?: string): void {
    const pid = patientId || this.getActivePatientId();
    setItem(`${KEYS.REMINDERS}_${pid}`, reminders);
    if (!pid || pid === 'pat-demo-1') {
      setItem(KEYS.REMINDERS, reminders);
    }
  },

  getReminders(patientId?: string): Reminder[] {
    const pid = patientId || this.getActivePatientId();

    if (!pid || pid === 'pat-demo-1') {
      const genericReminders = getItem<Reminder[]>(KEYS.REMINDERS, []);
      return genericReminders.filter(
        r => r.id !== 'rem-1' && r.id !== 'rem-2' && r.id !== 'rem-3' &&
             r.title !== 'Breakfast & Morning Routine' &&
             r.title !== 'Daily Brain Exercise Game' &&
             r.title !== 'Daughter Anitha Visit'
      );
    }

    // 1. Check if patient has custom reminders saved under their specific patient ID
    const patientReminders = getItem<Reminder[]>(`${KEYS.REMINDERS}_${pid}`, []);
    if (patientReminders && patientReminders.length > 0) {
      return patientReminders.filter(
        r => r.id !== 'rem-1' && r.id !== 'rem-2' && r.id !== 'rem-3' &&
             r.title !== 'Breakfast & Morning Routine' &&
             r.title !== 'Daily Brain Exercise Game' &&
             r.title !== 'Daughter Anitha Visit'
      );
    }

    // 2. Check if patient has dailyRoutine items in their registered Patient Profile
    const profile = this.getPatientProfile(pid);
    if (profile && profile.dailyRoutine && profile.dailyRoutine.length > 0) {
      const converted: Reminder[] = profile.dailyRoutine.map((r, i) => ({
        id: r.id || `routine-${pid}-${i}`,
        title: r.activity,
        time: r.time,
        category: (r.category as any) || 'routine',
        repeat: 'daily',
        description: r.description || '',
        isCompleted: false,
        createdAt: new Date().toISOString(),
      }));
      setItem(`${KEYS.REMINDERS}_${pid}`, converted);
      return converted;
    }

    // Real patient with no custom routines - return empty array. Never fall back to generic list of other patients!
    return [];
  },

  async fetchRemindersFromCloud(patientId?: string): Promise<Reminder[]> {
    const pid = patientId || this.getActivePatientId();
    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      try {
        const { data: cloudRoutines, error } = await supabase
          .from('routines')
          .select('*')
          .eq('patient_id', pid)
          .order('scheduled_time', { ascending: true });

        if (!error && cloudRoutines) {
          const reminders: Reminder[] = cloudRoutines.map((r: any) => {
            let displayTime = '08:00 AM';
            if (r.scheduled_time) {
              const match = r.scheduled_time.match(/^(\d{1,2}):(\d{2})/);
              if (match) {
                let hours = parseInt(match[1], 10);
                const minutes = match[2];
                const modifier = hours >= 12 ? 'PM' : 'AM';
                if (hours > 12) hours -= 12;
                if (hours === 0) hours = 12;
                displayTime = `${hours.toString().padStart(2, '0')}:${minutes} ${modifier}`;
              } else {
                displayTime = r.scheduled_time;
              }
            }

            return {
              id: r.id,
              title: r.title,
              time: displayTime,
              category: (r.description && r.description.startsWith('Category: ')
                ? r.description.replace('Category: ', '')
                : 'routine') as any,
              repeat: r.repeat_pattern || 'daily',
              description: r.description || '',
              isCompleted: !r.enabled,
              createdAt: r.created_at,
            };
          });

          const cleaned = reminders.filter(
            r => r.id !== 'rem-1' && r.id !== 'rem-2' && r.id !== 'rem-3' &&
                 r.title !== 'Breakfast & Morning Routine' &&
                 r.title !== 'Daily Brain Exercise Game' &&
                 r.title !== 'Daughter Anitha Visit'
          );

          this.savePatientReminders(cleaned, pid);
          return cleaned;
        }
      } catch (cloudErr) {
        console.warn('Cloud routines fetch error:', cloudErr);
      }
    }
    return this.getReminders(pid);
  },

  addReminder(reminder: Partial<Reminder> & { title: string; time: string }, patientId?: string): Reminder {
    const pid = patientId || this.getActivePatientId();
    const reminders = this.getReminders(pid);
    const newReminder: Reminder = {
      id: reminder.id || `rem-${Date.now()}`,
      title: reminder.title,
      time: reminder.time,
      repeat: reminder.repeat || 'daily',
      category: reminder.category || 'general',
      description: reminder.description || '',
      isCompleted: reminder.isCompleted || false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newReminder, ...reminders.filter(r => r.id !== newReminder.id && !(r.title.toLowerCase() === newReminder.title.toLowerCase() && r.time === newReminder.time))];
    setItem(`${KEYS.REMINDERS}_${pid}`, updated);
    if (!pid || pid === 'pat-demo-1') {
      setItem(KEYS.REMINDERS, updated);
    }

    OfflineStorage.saveRoutine({
      id: newReminder.id,
      patient_id: pid,
      title: newReminder.title,
      description: newReminder.description,
      scheduled_time: newReminder.time,
      repeat_pattern: newReminder.repeat || 'daily',
      enabled: !newReminder.isCompleted,
      category: newReminder.category,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          let formattedTime = '08:00:00';
          const timeStr = (newReminder.time || '08:00 AM').trim();
          const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = match[2];
            const modifier = match[3] ? match[3].toUpperCase() : 'AM';
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}:00`;
          } else if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
            formattedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
          }

          await supabase.from('routines').upsert({
            id: newReminder.id,
            patient_id: pid,
            title: newReminder.title,
            description: newReminder.description || (newReminder.category ? `Category: ${newReminder.category}` : 'Daily routine checkpoint'),
            scheduled_time: formattedTime,
            repeat_pattern: newReminder.repeat || 'daily',
            enabled: !newReminder.isCompleted,
            created_at: newReminder.createdAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        } catch (e) {
          console.warn('Supabase routine save error:', e);
        }
      })();
    }

    return newReminder;
  },

  toggleReminder(id: string, patientId?: string): void {
    const pid = patientId || this.getActivePatientId();
    const reminders = this.getReminders(pid);
    const updated = reminders.map(r => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r));
    setItem(`${KEYS.REMINDERS}_${pid}`, updated);
    if (!pid || pid === 'pat-demo-1') {
      setItem(KEYS.REMINDERS, updated);
    }
    OfflineStorage.toggleRoutine(id).catch(() => {});

    const target = updated.find(r => r.id === id);
    if (target && isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          await supabase.from('routines').update({
            enabled: !target.isCompleted,
            updated_at: new Date().toISOString(),
          }).eq('id', id);
        } catch (e) {
          console.warn('Supabase routine toggle error:', e);
        }
      })();
    }
  },

  toggleReminderComplete(id: string, patientId?: string): void {
    this.toggleReminder(id, patientId);
  },

  deleteReminder(id: string, patientId?: string): void {
    const pid = patientId || this.getActivePatientId();
    const reminders = this.getReminders(pid);
    const updated = reminders.filter(r => r.id !== id);
    setItem(`${KEYS.REMINDERS}_${pid}`, updated);
    if (!pid || pid === 'pat-demo-1') {
      setItem(KEYS.REMINDERS, updated);
    }
    OfflineStorage.deleteRoutine(id).catch(() => {});

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      (async () => {
        try {
          await supabase.from('routines').delete().eq('id', id);
        } catch (e) {
          console.warn('Supabase routine delete error:', e);
        }
      })();
    }
  },

  getAccessibility(): AccessibilitySettings {
    return getItem<AccessibilitySettings>(KEYS.ACCESSIBILITY, DEFAULT_ACCESSIBILITY);
  },
  saveAccessibility(settings: AccessibilitySettings): void {
    setItem(KEYS.ACCESSIBILITY, settings);
  },

  getGameSessions(patientId?: string): GameSession[] {
    const pid = patientId || this.getActivePatientId();
    if (pid && pid !== 'pat-demo-1') {
      const stored = getItem<GameSession[]>(`${KEYS.GAME_SESSIONS}_${pid}`, []);
      if (stored && stored.length > 0) return stored;
      return [];
    }
    return getItem<GameSession[]>(KEYS.GAME_SESSIONS, INITIAL_GAME_SESSIONS);
  },

  /**
   * Fetches real game attempts and scores directly from Supabase cloud database
   */
  async fetchGameSessionsFromCloud(patientId?: string): Promise<GameSession[]> {
    const pid = patientId || this.getActivePatientId();
    if (!isSupabaseConfigured()) {
      return this.getGameSessions(pid);
    }

    try {
      let query = supabase
        .from('game_attempts')
        .select('*')
        .order('created_at', { ascending: false });

      if (pid && isValidUUID(pid)) {
        query = query.eq('patient_id', pid);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching game_attempts from Supabase:', error.message);
        return this.getGameSessions(pid);
      }

      if (data && data.length > 0) {
        const GAME_METADATA: Record<string, { title: string; category: CognitiveCategory }> = {
          'memory-match': { title: '🧩 Memory Match', category: 'memory' },
          'sequence-recall': { title: '🔴 Sequence Recall', category: 'attention' },
          'name-face': { title: '👤 Who Is This?', category: 'recognition' },
          'familiar-places': { title: '🏠 Familiar Places', category: 'familiarity' },
          'number-memory': { title: '🔢 Number Memory', category: 'memory' },
          'voice-recall': { title: '🗣️ Voice Recall', category: 'language' },
          'object-recall': { title: '📸 Object Recall', category: 'recall' },
          'story-recall': { title: '📖 Story Recall', category: 'recall' },
          'familiar-sounds': { title: '🎵 Familiar Sounds', category: 'recognition' },
        };

        const sessions: GameSession[] = data.map((row: any) => {
          const meta = GAME_METADATA[row.game_type] || {
            title: row.game_type || 'Cognitive Activity',
            category: 'memory' as CognitiveCategory,
          };
          const rawScore = Number(row.score);
          const rawAccuracy = Number(row.accuracy);
          const score = !isNaN(rawScore) ? rawScore : (!isNaN(rawAccuracy) ? rawAccuracy : 0);
          const accuracy = !isNaN(rawAccuracy) ? rawAccuracy : score;

          return {
            id: row.id || `gs-${Date.now()}`,
            gameId: (row.game_type || 'memory-match') as GameType,
            gameTitle: meta.title,
            category: meta.category,
            score,
            accuracy,
            timeSeconds: Number(row.duration_seconds) || 0,
            difficultyLevel: Number(row.difficulty_level) || 1,
            timestamp: row.created_at || new Date().toISOString(),
            attempts: Number(row.total_questions) || Number(row.correct_answers) || 1,
          };
        });

        // Cache locally for this patient
        if (pid) {
          setItem(`${KEYS.GAME_SESSIONS}_${pid}`, sessions);
        }
        setItem(KEYS.GAME_SESSIONS, sessions);

        // Also update IndexedDB for offline resilience
        for (const row of data) {
          try {
            await db.gameAttempts.put({
              id: row.id,
              patient_id: row.patient_id,
              game_type: row.game_type,
              difficulty_level: row.difficulty_level || 1,
              score: row.score || 0,
              accuracy: row.accuracy || 0,
              correct_answers: row.correct_answers || 0,
              total_questions: row.total_questions || 0,
              duration_seconds: row.duration_seconds || 0,
              timestamp: row.created_at,
              created_at: row.created_at,
              device_id: row.device_id,
              sync_status: 'synced',
            });
          } catch {}
        }

        return sessions;
      } else if (pid && isValidUUID(pid)) {
        // Real patient with no attempts yet in Supabase
        setItem(`${KEYS.GAME_SESSIONS}_${pid}`, []);
        return [];
      }
    } catch (err) {
      console.warn('Failed to fetch game attempts from Supabase:', err);
    }

    return this.getGameSessions(pid);
  },
  saveGameSession(session: Omit<GameSession, 'id' | 'timestamp'>, patientId?: string): GameSession {
    const pid = patientId || this.getActivePatientId();
    const sessions = this.getGameSessions(pid);
    const newSession: GameSession = {
      ...session,
      id: `gs-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newSession, ...sessions];
    setItem(`${KEYS.GAME_SESSIONS}_${pid}`, updated);
    if (!pid || pid === 'pat-demo-1') {
      setItem(KEYS.GAME_SESSIONS, updated);
    }

    // Save attempt to IndexedDB and update aggregate cognitive profile
    OfflineStorage.saveGameAttempt({
      id: newSession.id,
      patient_id: pid,
      game_type: newSession.gameId,
      difficulty_level: newSession.difficultyLevel || 1,
      score: newSession.score,
      accuracy: newSession.accuracy,
      correct_answers: newSession.attempts || 1,
      total_questions: newSession.attempts || 1,
      duration_seconds: newSession.timeSeconds,
      timestamp: newSession.timestamp,
      created_at: newSession.timestamp,
    }).then(() => {
      CognitiveProfileService.syncPatientCognitiveProfile(pid).catch(() => {});
    }).catch(() => {});

    // Immediately evaluate accuracy alert level after game session logged
    try {
      AlertEngineService.checkAccuracyAlert();
    } catch (e) {
      console.warn('Error checking accuracy alert after game session log', e);
    }

    // Trigger cloud sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return newSession;
  },

  getDeviceConnection(): DeviceConnection {
    return getItem<DeviceConnection>(KEYS.DEVICE_CONNECTION, INITIAL_DEVICE_CONNECTION);
  },
  saveDeviceConnection(conn: DeviceConnection): void {
    setItem(KEYS.DEVICE_CONNECTION, conn);
  },

  getNotifications(): NotificationItem[] {
    return getItem<NotificationItem[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  },
  addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): void {
    const notifications = this.getNotifications();
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setItem(KEYS.NOTIFICATIONS, [newNotif, ...notifications]);
  },
  markNotificationAsRead(id: string): void {
    const notifications = this.getNotifications();
    setItem(KEYS.NOTIFICATIONS, notifications.map(n => (n.id === id ? { ...n, read: true } : n)));
  },
};
