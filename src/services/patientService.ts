import { PatientProfile } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { StorageService } from './storage';
import { syncManager } from '../offline/syncManager';
import { CareTeamService } from './careTeamService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notifySyncEvent } from './realtime';

export interface UpdatePatientProfileData {
  name: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  language: string;
  state?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  relationship?: string;
  photo?: string;
}

export const PatientService = {
  async savePatientProfile(profile: PatientProfile, caregiverId?: string): Promise<void> {
    // Preserve extra metadata in medical_history for lossless sync
    const medHistory = {
      ...(profile.medicalHistory || {}),
      state: profile.basicInfo.state,
      phone: profile.basicInfo.phone,
      photo: profile.basicInfo.photo,
      relationship: profile.emergencyContact?.relationship,
      age: profile.basicInfo.age,
    };

    const updatedProfile: PatientProfile = {
      ...profile,
      medicalHistory: medHistory as any,
    };

    // 1. Save to IndexedDB (Offline-First)
    try {
      await OfflineStorage.savePatient({
        id: updatedProfile.id,
        full_name: updatedProfile.basicInfo.name,
        date_of_birth: updatedProfile.basicInfo.dateOfBirth,
        gender: updatedProfile.basicInfo.gender,
        preferred_language: updatedProfile.basicInfo.language,
        medical_history: medHistory,
        emergency_contact_name: updatedProfile.emergencyContact?.primaryContactName || updatedProfile.emergencyContact?.primaryCaregiverName,
        emergency_contact_phone: updatedProfile.emergencyContact?.primaryContactPhone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        raw_profile: updatedProfile,
      });
    } catch (e) {
      console.warn('Offline patient profile save warning', e);
    }

    // 2. Keep StorageService updated with multi-patient mapping
    StorageService.savePatientProfile(updatedProfile, caregiverId);

    // 3. Trigger cloud sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }
  },

  async getPatientProfile(id?: string, caregiverId?: string): Promise<PatientProfile> {
    if (id) {
      try {
        const local = await OfflineStorage.getPatient(id);
        if (local && local.raw_profile) {
          return local.raw_profile;
        }
      } catch {}
    }
    return StorageService.getPatientProfile(id, caregiverId);
  },

  async updatePatientProfile(
    patientId: string,
    updates: UpdatePatientProfileData,
    caregiverId?: string
  ): Promise<{ success: boolean; isOffline?: boolean; error?: string }> {
    try {
      // 1. Authorization check
      if (caregiverId && caregiverId !== 'cg-demo-1') {
        const authorizedPatients = CareTeamService.getPatientsForCaregiver(caregiverId);
        // If not in local list, check cloud if configured
        let isAuthorized = authorizedPatients.includes(patientId);
        if (!isAuthorized && isSupabaseConfigured()) {
          try {
            const { data } = await supabase
              .from('caregiver_patients')
              .select('patient_id')
              .eq('caregiver_id', caregiverId)
              .eq('patient_id', patientId)
              .eq('status', 'active')
              .maybeSingle();
            if (data?.patient_id) isAuthorized = true;
          } catch {}
        }
        if (!isAuthorized && patientId !== 'pat-demo-1') {
          return {
            success: false,
            error: 'Authorization error: You do not have permission to edit this patient profile.',
          };
        }
      }

      // 2. Retrieve existing patient profile
      const current = await this.getPatientProfile(patientId, caregiverId);
      if (!current) {
        return { success: false, error: 'Patient profile not found.' };
      }

      // 3. Construct updated profile (preserving medical history, routines, credentials, etc.)
      const medHistory = {
        ...(current.medicalHistory || {}),
        state: updates.state || current.basicInfo.state || 'Assam',
        phone: updates.phone !== undefined ? updates.phone.trim() : (current.basicInfo.phone || ''),
        relationship: updates.relationship?.trim() || current.emergencyContact?.relationship || '',
        photo: updates.photo !== undefined ? updates.photo : (current.basicInfo.photo || ''),
        age: typeof updates.age === 'number' ? updates.age : current.basicInfo.age,
      };

      const updatedProfile: PatientProfile = {
        ...current,
        basicInfo: {
          ...current.basicInfo,
          name: updates.name.trim(),
          dateOfBirth: updates.dateOfBirth || current.basicInfo.dateOfBirth,
          age: typeof updates.age === 'number' ? updates.age : current.basicInfo.age,
          gender: updates.gender || current.basicInfo.gender,
          language: updates.language || current.basicInfo.language,
          state: updates.state || current.basicInfo.state || 'Assam',
          phone: updates.phone !== undefined ? updates.phone.trim() : current.basicInfo.phone,
          photo: updates.photo !== undefined ? updates.photo : current.basicInfo.photo,
        },
        emergencyContact: {
          ...current.emergencyContact,
          primaryContactName: updates.emergencyContactName?.trim() || current.emergencyContact?.primaryContactName || '',
          primaryCaregiverName: updates.emergencyContactName?.trim() || current.emergencyContact?.primaryCaregiverName || '',
          primaryContactPhone: updates.emergencyContactPhone?.trim() || current.emergencyContact?.primaryContactPhone || '',
          relationship: updates.relationship?.trim() || current.emergencyContact?.relationship || '',
        },
        medicalHistory: medHistory as any,
      };

      // 4. Save to IndexedDB & SyncQueue (Offline-First)
      const now = new Date().toISOString();
      await OfflineStorage.savePatient({
        id: updatedProfile.id,
        full_name: updatedProfile.basicInfo.name,
        date_of_birth: updatedProfile.basicInfo.dateOfBirth,
        gender: updatedProfile.basicInfo.gender,
        preferred_language: updatedProfile.basicInfo.language,
        medical_history: medHistory,
        emergency_contact_name: updatedProfile.emergencyContact?.primaryContactName,
        emergency_contact_phone: updatedProfile.emergencyContact?.primaryContactPhone,
        created_at: now,
        updated_at: now,
        raw_profile: updatedProfile,
      });

      // 5. Update local storage & multi-patient dictionary & trigger BroadcastChannel
      StorageService.savePatientProfile(updatedProfile, caregiverId);
      notifySyncEvent('mindcare_patient_profile', updatedProfile);

      // 6. Direct Supabase update if online and configured
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline && isSupabaseConfigured() && patientId && patientId !== 'pat-demo-1') {
        try {
          const { error: sbError } = await supabase
            .from('patients')
            .update({
              full_name: updatedProfile.basicInfo.name,
              date_of_birth: updatedProfile.basicInfo.dateOfBirth || null,
              gender: updatedProfile.basicInfo.gender || null,
              preferred_language: updatedProfile.basicInfo.language || 'en',
              emergency_contact_name: updatedProfile.emergencyContact?.primaryContactName || null,
              emergency_contact_phone: updatedProfile.emergencyContact?.primaryContactPhone || null,
              medical_history: JSON.stringify(medHistory),
              updated_at: now,
            })
            .eq('id', patientId);

          if (sbError) {
            console.warn('Supabase patient update warning:', sbError.message);
          }
        } catch (sbEx) {
          console.warn('Supabase patient update exception:', sbEx);
        }
      }

      return {
        success: true,
        isOffline: !isOnline,
      };
    } catch (err: any) {
      console.error('Failed to update patient profile:', err);
      return {
        success: false,
        error: 'Unable to update the patient profile. Your existing information has not been changed. Please try again.',
      };
    }
  },

  /**
   * Update credentials (login ID and password) for a specific patient.
   * Synchronizes across local storage, IndexedDB, and Supabase cloud.
   */
  async updatePatientCredentials(
    patientId: string,
    credentials: { loginId: string; password: string },
    caregiverId?: string
  ): Promise<{ success: boolean; error?: string; profile?: PatientProfile }> {
    try {
      const cleanLogin = credentials.loginId.trim();
      const cleanPass = credentials.password.trim();

      if (!cleanLogin || !cleanPass) {
        return { success: false, error: 'Both Login ID and Password are required.' };
      }
      if (cleanPass.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      // 1. Retrieve current patient profile
      const current = await this.getPatientProfile(patientId, caregiverId);
      if (!current) {
        return { success: false, error: 'Patient profile not found.' };
      }

      // 2. Build updated credentials object
      const creds = { loginId: cleanLogin, password: cleanPass };

      // 3. Update medical history with credentials
      const updatedMedHistory = {
        ...(current.medicalHistory || {}),
        patientCredentials: creds,
      };

      const updatedProfile: PatientProfile = {
        ...current,
        patientCredentials: creds,
        medicalHistory: updatedMedHistory as any,
      };

      // 4. Save to StorageService (updates mindcare_patients_dict, mindcare_patient_<id>, mindcare_patient_profile)
      StorageService.savePatientProfile(updatedProfile, caregiverId);

      // 5. Save to OfflineStorage (Dexie IndexedDB)
      const now = new Date().toISOString();
      await OfflineStorage.savePatient({
        id: updatedProfile.id,
        full_name: updatedProfile.basicInfo.name,
        date_of_birth: updatedProfile.basicInfo.dateOfBirth,
        gender: updatedProfile.basicInfo.gender,
        preferred_language: updatedProfile.basicInfo.language,
        medical_history: updatedMedHistory,
        emergency_contact_name: updatedProfile.emergencyContact?.primaryContactName,
        emergency_contact_phone: updatedProfile.emergencyContact?.primaryContactPhone,
        created_at: (current as any).created_at || (current as any).createdAt || now,
        updated_at: now,
        raw_profile: updatedProfile,
      });

      // 6. If online and Supabase configured, update patients table in Supabase
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline && isSupabaseConfigured() && patientId && patientId !== 'pat-demo-1') {
        try {
          const { data: dbPat } = await supabase
            .from('patients')
            .select('medical_history')
            .eq('id', patientId)
            .maybeSingle();

          let remoteMed: any = {};
          if (dbPat?.medical_history) {
            try {
              remoteMed = typeof dbPat.medical_history === 'string'
                ? JSON.parse(dbPat.medical_history)
                : dbPat.medical_history;
            } catch {}
          }
          remoteMed.patientCredentials = creds;

          const { error: sbErr } = await supabase
            .from('patients')
            .update({
              medical_history: JSON.stringify(remoteMed),
              updated_at: now,
            })
            .eq('id', patientId);

          if (sbErr) {
            console.warn('Supabase patient credentials update warning:', sbErr.message);
          }
        } catch (sbEx) {
          console.warn('Supabase patient credentials update exception:', sbEx);
        }
      }

      // 7. Broadcast sync event across tabs & windows
      notifySyncEvent('mindcare_patient_profile', updatedProfile);
      notifySyncEvent('mindcare_patient_credentials', updatedProfile);

      return { success: true, profile: updatedProfile };
    } catch (err: any) {
      console.error('Failed to update patient credentials:', err);
      return {
        success: false,
        error: err?.message || 'Failed to update patient password. Please try again.',
      };
    }
  },
};
