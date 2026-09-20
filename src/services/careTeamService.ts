import { CaregiverPatientRelation } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db } from '../offline/db';
import { generateUUID } from '../utils/uuid';

const STORAGE_KEY = 'mindcare_care_team';

export const CareTeamService = {
  getCareTeam(patientId?: string): CaregiverPatientRelation[] {
    try {
      if (!patientId) return [];
      const stored = localStorage.getItem(`${STORAGE_KEY}_${patientId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out legacy demo placeholder Anitha Sharma if present
          return parsed.filter(
            (c: CaregiverPatientRelation) =>
              c.caregiverName !== 'Anitha Sharma' && c.caregiverEmail !== 'anitha@mindcare.ai'
          );
        }
      }
    } catch {
      // Fallback
    }

    return [];
  },

  getActivePatientIdForCaregiver(caregiverId: string): string | null {
    try {
      const active = localStorage.getItem(`mindcare_active_patient_${caregiverId}`);
      if (active) return active;
      const list = this.getPatientsForCaregiver(caregiverId);
      if (list.length > 0) return list[0];
    } catch {}
    return null;
  },

  getPatientsForCaregiver(caregiverId: string): string[] {
    try {
      const stored = localStorage.getItem(`mindcare_caregiver_patients_${caregiverId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  },

  async fetchCaregiverPatientFromCloud(caregiverId: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('caregiver_patients')
        .select('patient_id, is_primary')
        .eq('caregiver_id', caregiverId)
        .eq('status', 'active')
        .order('is_primary', { ascending: false });

      if (data && data.length > 0) {
        const patientId = data[0].patient_id;
        localStorage.setItem(`mindcare_active_patient_${caregiverId}`, patientId);
        const currentList = this.getPatientsForCaregiver(caregiverId);
        const merged = Array.from(new Set([patientId, ...data.map((d: any) => d.patient_id), ...currentList]));
        localStorage.setItem(`mindcare_caregiver_patients_${caregiverId}`, JSON.stringify(merged));
        return patientId;
      }
    } catch (e) {
      console.warn('Could not fetch caregiver-patient from cloud', e);
    }
    return null;
  },

  async setPrimaryCaregiver(
    caregiverId: string,
    caregiverName: string,
    caregiverEmail: string,
    patientId: string,
    relationship: string
  ): Promise<CaregiverPatientRelation> {
    // 1. Maintain caregiver's own patient list
    try {
      localStorage.setItem(`mindcare_active_patient_${caregiverId}`, patientId);
      const existingPatients = this.getPatientsForCaregiver(caregiverId);
      if (!existingPatients.includes(patientId)) {
        existingPatients.push(patientId);
        localStorage.setItem(`mindcare_caregiver_patients_${caregiverId}`, JSON.stringify(existingPatients));
      }
    } catch {}

    // 2. Set Care Team for THIS specific patient
    const existing = this.getCareTeam(patientId);
    const updated = existing.map((c) => ({ ...c, isPrimary: false }));

    const relUuid = generateUUID();
    const primaryRelation: CaregiverPatientRelation = {
      id: relUuid,
      caregiverId,
      caregiverName,
      caregiverEmail,
      patientId,
      relationship: `${relationship} (Primary)`,
      status: 'active',
      isPrimary: true,
      createdAt: new Date().toISOString(),
    };

    const finalTeam = [primaryRelation, ...updated.filter((c) => c.caregiverId !== caregiverId)];
    try {
      localStorage.setItem(`${STORAGE_KEY}_${patientId}`, JSON.stringify(finalTeam));
    } catch {
      // Ignore
    }

    // 3. Upsert specifically for this (caregiver_id, patient_id) pair in Supabase
    if (isSupabaseConfigured()) {
      try {
        const payload: any = {
          caregiver_id: caregiverId,
          patient_id: patientId,
          relationship: primaryRelation.relationship,
          status: 'active',
          is_primary: true,
          updated_at: new Date().toISOString(),
        };
        // Use valid UUID for id column
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relUuid)) {
          payload.id = relUuid;
        }

        const { error } = await supabase.from('caregiver_patients').upsert(
          payload,
          { onConflict: 'caregiver_id, patient_id' }
        );
        if (error) {
          console.error('Error syncing caregiver_patients to Supabase:', error.message, error.details);
        } else {
          console.log('✅ caregiver_patients link successfully synced to Supabase for caregiver:', caregiverId);
        }
      } catch (e) {
        console.warn('Could not sync primary caregiver to Supabase', e);
      }
    }

    return primaryRelation;
  },

  async inviteCaregiver(
    patientId: string,
    name: string,
    email: string,
    relationship: string
  ): Promise<CaregiverPatientRelation> {
    const team = this.getCareTeam(patientId);
    const memberUuid = generateUUID();

    const newMember: CaregiverPatientRelation = {
      id: memberUuid,
      caregiverId: `inv-${Date.now()}`,
      caregiverName: name,
      caregiverEmail: email,
      patientId,
      relationship,
      status: 'active',
      isPrimary: false,
      createdAt: new Date().toISOString(),
    };

    const updated = [...team, newMember];
    try {
      localStorage.setItem(`${STORAGE_KEY}_${patientId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('caregiver_patients').insert({
          id: memberUuid,
          caregiver_id: newMember.caregiverId,
          patient_id: patientId,
          relationship: newMember.relationship,
          status: 'active',
          is_primary: false,
        });
        if (error) {
          console.warn('Could not save invited caregiver to Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Could not save invited caregiver to Supabase', e);
      }
    }

    return newMember;
  },

  async fetchCareTeamFromCloud(patientId: string): Promise<CaregiverPatientRelation[]> {
    if (!patientId) return [];
    if (!isSupabaseConfigured()) {
      return this.getCareTeam(patientId);
    }

    try {
      // 1. Fetch links for this patient
      const { data: rels, error: relError } = await supabase
        .from('caregiver_patients')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (relError || !rels || rels.length === 0) {
        return this.getCareTeam(patientId);
      }

      // 2. Fetch caregiver profile names and emails
      const caregiverIds = rels.map((r: any) => r.caregiver_id).filter(Boolean);
      let profilesMap: Record<string, { full_name?: string; email?: string }> = {};

      if (caregiverIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', caregiverIds);

        if (profs) {
          profs.forEach((p: any) => {
            profilesMap[p.id] = { full_name: p.full_name, email: p.email };
          });
        }
      }

      const team: CaregiverPatientRelation[] = rels.map((r: any) => {
        const prof = profilesMap[r.caregiver_id] || {};
        return {
          id: r.id || generateUUID(),
          caregiverId: r.caregiver_id,
          caregiverName: prof.full_name || 'Caregiver',
          caregiverEmail: prof.email || '',
          patientId: r.patient_id,
          relationship: r.relationship || 'Caregiver',
          status: r.status || 'active',
          isPrimary: !!r.is_primary,
          createdAt: r.created_at || new Date().toISOString(),
        };
      });

      // Filter out any unwanted placeholder Anitha Sharma
      const sanitizedTeam = team.filter(
        (c) => c.caregiverName !== 'Anitha Sharma' && c.caregiverEmail !== 'anitha@mindcare.ai'
      );

      // Cache locally for this patient
      localStorage.setItem(`${STORAGE_KEY}_${patientId}`, JSON.stringify(sanitizedTeam));
      return sanitizedTeam;
    } catch (err) {
      console.warn('Error fetching care team from cloud:', err);
      return this.getCareTeam(patientId);
    }
  },

  async removeCaregiver(patientId: string, memberId: string): Promise<CaregiverPatientRelation[]> {
    const current = this.getCareTeam(patientId);
    const updated = current.filter((m) => m.id !== memberId);
    try {
      localStorage.setItem(`${STORAGE_KEY}_${patientId}`, JSON.stringify(updated));
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('caregiver_patients').delete().eq('id', memberId);
      } catch (e) {
        console.warn('Could not delete caregiver from Supabase', e);
      }
    }

    return updated;
  },
};
