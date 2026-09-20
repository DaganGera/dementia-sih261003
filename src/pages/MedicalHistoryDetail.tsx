import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { MedicalContextService } from '../services/medicalContext';
import { useI18n } from '../i18n';
import {
  ArrowLeft,
  Stethoscope,
  Pill,
  ShieldAlert,
  FileText,
  Heart,
  Upload,
  Plus,
  Trash2,
  Phone,
  UserCheck,
  Building,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { MedicalCondition, Medication, MedicalDocument, PatientProfile } from '../types';

interface MedicalHistoryDetailProps {
  onBack: () => void;
}

export const MedicalHistoryDetail: React.FC<MedicalHistoryDetailProps> = ({ onBack }) => {
  const { t } = useI18n();
  const [patient, setPatient] = useState<PatientProfile>(StorageService.getPatientProfile());

  // Form states for adding items
  const [newCondName, setNewCondName] = useState<string>('');
  const [newCondYear, setNewCondYear] = useState<string>('2024');

  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedDosage, setNewMedDosage] = useState<string>('');
  const [newMedTime, setNewMedTime] = useState<string>('08:00 AM');

  const [newDocName, setNewDocName] = useState<string>('');

  const contextSummary = MedicalContextService.getPersonalizationSummary(patient);

  const handleAddCondition = () => {
    if (!newCondName.trim()) return;
    const newCond: MedicalCondition = {
      id: `mc-${Date.now()}`,
      name: newCondName,
      diagnosedYear: parseInt(newCondYear) || 2024,
    };
    const updated: PatientProfile = {
      ...patient,
      medicalHistory: {
        ...patient.medicalHistory,
        conditions: [...patient.medicalHistory.conditions, newCond],
      },
    };
    StorageService.savePatientProfile(updated);
    setPatient(updated);
    setNewCondName('');
  };

  const handleDeleteCondition = (id: string) => {
    const updated: PatientProfile = {
      ...patient,
      medicalHistory: {
        ...patient.medicalHistory,
        conditions: patient.medicalHistory.conditions.filter(c => c.id !== id),
      },
    };
    StorageService.savePatientProfile(updated);
    setPatient(updated);
  };

  const handleAddMedication = () => {
    if (!newMedName.trim()) return;
    const newMed: Medication = {
      id: `m-${Date.now()}`,
      name: newMedName,
      dosage: newMedDosage || 'Standard',
      time: newMedTime,
      frequency: 'Daily',
      purpose: 'Health reference',
    };
    const updated: PatientProfile = {
      ...patient,
      medications: [...patient.medications, newMed],
    };
    StorageService.savePatientProfile(updated);
    setPatient(updated);
    setNewMedName('');
    setNewMedDosage('');
  };

  const handleDeleteMedication = (id: string) => {
    const updated: PatientProfile = {
      ...patient,
      medications: patient.medications.filter(m => m.id !== id),
    };
    StorageService.savePatientProfile(updated);
    setPatient(updated);
  };

  const handleAddDocument = () => {
    if (!newDocName.trim()) return;
    const newDoc: MedicalDocument = {
      id: `doc-${Date.now()}`,
      name: newDocName.endsWith('.pdf') ? newDocName : `${newDocName}.pdf`,
      type: 'report',
      dateAdded: new Date().toISOString().split('T')[0],
    };
    const updated: PatientProfile = {
      ...patient,
      medicalHistory: {
        ...patient.medicalHistory,
        documents: [...(patient.medicalHistory.documents || []), newDoc],
      },
    };
    StorageService.savePatientProfile(updated);
    setPatient(updated);
    setNewDocName('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Caregiver Access Only
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Patient Care & Medical History Detail
        </h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">
          {patient.basicInfo.name} ({patient.basicInfo.age} yrs) — {patient.basicInfo.state} ({patient.basicInfo.language.toUpperCase()})
        </p>
      </div>

      {/* Overview & Care Summary Card */}
      <div className="bg-teal-50 border border-teal-200 p-5 rounded-2xl space-y-3">
        <h3 className="font-extrabold text-teal-900 text-base flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal-700" /> Care Context Overview
        </h3>
        <p className="text-xs text-teal-900 font-medium leading-relaxed">
          {contextSummary.careSummary}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {contextSummary.sensoryCues.map((cue, i) => (
            <span key={i} className="px-2.5 py-1 bg-white text-teal-900 font-bold text-[11px] rounded-lg border border-teal-200">
              ✓ {cue}
            </span>
          ))}
        </div>
      </div>

      {/* Grid of Sections: Conditions & Medications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Medical Conditions */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" /> Known Conditions
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {patient.medicalHistory.conditions.length} recorded
            </span>
          </div>

          <div className="space-y-2">
            {patient.medicalHistory.conditions.map(c => (
              <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-900">{c.name}</span>
                  {c.diagnosedYear && <span className="text-slate-500 ml-2">({c.diagnosedYear})</span>}
                  {c.notes && <p className="text-[11px] text-slate-600 mt-0.5">{c.notes}</p>}
                </div>
                <button onClick={() => handleDeleteCondition(c.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick Add Condition */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Add condition name"
              value={newCondName}
              onChange={e => setNewCondName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
            <button
              onClick={handleAddCondition}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition"
            >
              Add
            </button>
          </div>
        </div>

        {/* Medications Reference */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-600" /> Medications Reference
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {patient.medications.length} items
            </span>
          </div>

          <div className="space-y-2">
            {patient.medications.map(m => (
              <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-900">{m.name}</span>
                  <span className="text-teal-700 font-bold ml-2">{m.dosage}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.time} ({m.frequency}) — {m.purpose}</p>
                </div>
                <button onClick={() => handleDeleteMedication(m.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick Add Medication */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Medication name"
              value={newMedName}
              onChange={e => setNewMedName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
            <input
              type="text"
              placeholder="Dosage"
              value={newMedDosage}
              onChange={e => setNewMedDosage(e.target.value)}
              className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
            <button
              onClick={handleAddMedication}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition"
            >
              Add
            </button>
          </div>
        </div>

      </div>

      {/* Documents & Allergies & Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Medical Documents */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-teal-600" /> Medical Documents
          </h3>

          <div className="space-y-2">
            {(patient.medicalHistory.documents || []).map(d => (
              <div key={d.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">📄 {d.name}</span>
                <span className="text-[11px] text-slate-400">Added {d.dateAdded}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Document file name (PDF / Image)"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
            <button
              onClick={handleAddDocument}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
          </div>
        </div>

        {/* Important Care Contacts & Allergies */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <Phone className="w-4 h-4 text-teal-600" /> Important Care Contacts
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border rounded-xl flex justify-between">
              <span className="font-semibold text-slate-600">Primary Caregiver:</span>
              <span className="font-bold text-slate-900">{patient.emergencyContact?.primaryCaregiverName || 'Primary Caregiver'}</span>
            </div>

            <div className="p-2.5 bg-slate-50 border rounded-xl flex justify-between">
              <span className="font-semibold text-slate-600">Emergency Phone:</span>
              <span className="font-bold text-teal-700">{patient.emergencyContact?.primaryContactPhone || '+91 98765 43210'}</span>
            </div>

            <div className="p-2.5 bg-slate-50 border rounded-xl flex justify-between">
              <span className="font-semibold text-slate-600">Attending Doctor:</span>
              <span className="font-bold text-slate-900">{patient.emergencyContact?.doctorName || 'Dr. P. Barua'}</span>
            </div>

            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex justify-between text-rose-900">
              <span className="font-semibold">Recorded Allergies:</span>
              <span className="font-bold">{(patient.medicalHistory.allergies || ['Penicillin']).join(', ')}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
