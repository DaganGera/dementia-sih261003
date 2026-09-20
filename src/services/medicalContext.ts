import { PatientProfile, MedicalCondition, Medication, MedicalDocument } from '../types';
import { StorageService } from './storage';

export interface StructuredMedicalContext {
  conditions: string[];
  medications: string[];
  allergies: string[];
  neurologicalHistory: string[];
  sensoryConsiderations: string[];
  mobilityConsiderations: string[];
  sleepInformation: string[];
  caregiverObservations: string[];
  importantNotes: string[];
}

export const MedicalContextService = {
  /**
   * Constructs a structured medical context object for a patient profile.
   * This is reference & personalization context only — NOT a diagnostic engine.
   */
  getStructuredContext(profile?: PatientProfile | null): StructuredMedicalContext {
    const p = profile || StorageService.getPatientProfile();

    const conditions = p.medicalHistory.conditions.map(c => c.name);
    const medications = p.medications.map(m => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`);
    const allergies = p.medicalHistory.allergies || [];
    const neurologicalHistory = p.medicalHistory.neurologicalHistory || [];
    const caregiverObservations = p.caregiverObservations || [];

    const sensoryConsiderations: string[] = [];
    if (p.medicalHistory.visionDifficulties) sensoryConsiderations.push('Vision assistance required');
    if (p.medicalHistory.hearingDifficulties) sensoryConsiderations.push('Hearing assistance required');
    if (p.medicalHistory.speechDifficulties) sensoryConsiderations.push('Speech communication support');

    const mobilityConsiderations: string[] = [];
    if (p.medicalHistory.mobilityLimitations) mobilityConsiderations.push('Mobility limitations present');

    const sleepInformation: string[] = [];
    if (p.medicalHistory.sleepDifficulties) sleepInformation.push('Sleep routine considerations');

    const importantNotes: string[] = [];
    if (p.medicalHistory.notes) importantNotes.push(p.medicalHistory.notes);
    if (p.emergencyContact?.importantNotes) importantNotes.push(p.emergencyContact.importantNotes);

    return {
      conditions,
      medications,
      allergies,
      neurologicalHistory,
      sensoryConsiderations,
      mobilityConsiderations,
      sleepInformation,
      caregiverObservations,
      importantNotes,
    };
  },

  /**
   * Generates a non-clinical, care-context summary for personalization.
   * NEVER generates statements like "patient has worsening dementia".
   */
  getPersonalizationSummary(profile?: PatientProfile | null): {
    careSummary: string;
    sensoryCues: string[];
    activityModifiers: string[];
  } {
    const context = this.getStructuredContext(profile);

    const sensoryCues: string[] = [];
    if (context.sensoryConsiderations.length > 0) {
      sensoryCues.push(...context.sensoryConsiderations);
    }

    const activityModifiers: string[] = [];
    if (context.sensoryConsiderations.some(c => c.includes('Vision'))) {
      activityModifiers.push('Use large visual cards and contrast text');
    }
    if (context.sensoryConsiderations.some(c => c.includes('Hearing'))) {
      activityModifiers.push('Enable clear subtitle text alongside voice prompts');
    }
    if (context.mobilityConsiderations.length > 0) {
      activityModifiers.push('Prefer tap and simple touch interactions');
    }

    const careSummary = context.conditions.length > 0
      ? `Care context active with ${context.conditions.length} recorded health items and ${context.medications.length} reference daily items.`
      : 'Care context active with standard daily activity routine.';

    return {
      careSummary,
      sensoryCues,
      activityModifiers,
    };
  },
};
