import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StorageService } from '../services/storage';
import { PatientService, UpdatePatientProfileData } from '../services/patientService';
import { CareTeamService } from '../services/careTeamService';
import { SUPPORTED_LANGUAGES_LIST, useI18n } from '../i18n';
import { PatientProfile } from '../types';
import {
  User,
  Calendar,
  Phone,
  HeartHandshake,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Globe,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronDown,
  UserCheck,
} from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  'Daughter',
  'Son',
  'Spouse / Partner',
  'Grandchild',
  'Sibling',
  'Professional Nurse / Caregiver',
  'Family Doctor',
  'Close Family Friend',
  'Other Guardian',
];

const NORTH_EAST_STATES = [
  'Assam',
  'Arunachal Pradesh',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim',
];

interface ElderlyPatientProfileEditorProps {
  onProfileUpdated?: (updated: PatientProfile) => void;
  onPatientSelected?: (patient: PatientProfile) => void;
}

export const ElderlyPatientProfileEditor: React.FC<ElderlyPatientProfileEditorProps> = ({
  onProfileUpdated,
  onPatientSelected,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();

  // Multi-patient authorization handling
  const [authorizedPatients, setAuthorizedPatients] = useState<PatientProfile[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(() =>
    StorageService.getActivePatientId(user?.id)
  );
  const [patient, setPatient] = useState<PatientProfile>(() =>
    StorageService.getPatientProfile(undefined, user?.id)
  );

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [offlineNotice, setOfflineNotice] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<string>('');
  const [preferredLang, setPreferredLang] = useState<string>('en');
  const [state, setState] = useState<string>('Assam');
  const [phone, setPhone] = useState<string>('');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('Family Caregiver');

  // Inline Validation errors
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    dob?: string;
    phone?: string;
    emergencyPhone?: string;
  }>({});

  // 1. Load authorized patients for this caregiver
  useEffect(() => {
    const loadPatients = async () => {
      await StorageService.syncPatientsFromCloud();
      const allPatients = StorageService.getAllPatientProfiles();

      let allowedList: PatientProfile[] = [];
      if (user?.id) {
        let caregiverPatientIds = CareTeamService.getPatientsForCaregiver(user.id);
        if (caregiverPatientIds.length === 0) {
          const cloudPid = await CareTeamService.fetchCaregiverPatientFromCloud(user.id);
          if (cloudPid) caregiverPatientIds = [cloudPid];
        }
        allowedList = allPatients.filter(
          (p) => caregiverPatientIds.includes(p.id) || p.id === patient.id || p.id === 'pat-demo-1'
        );
      } else {
        allowedList = allPatients;
      }

      if (allowedList.length === 0) {
        allowedList = [StorageService.getPatientProfile(undefined, user?.id)];
      }

      setAuthorizedPatients(allowedList);

      // Verify selected patient is authorized
      const currentActiveId = StorageService.getActivePatientId(user?.id);
      const isAllowed = allowedList.some((p) => p.id === currentActiveId);
      const targetId = isAllowed ? currentActiveId : allowedList[0]?.id;

      if (targetId) {
        setSelectedPatientId(targetId);
        const p = StorageService.getPatientProfile(targetId, user?.id);
        setPatient(p);
        if (onPatientSelected) {
          onPatientSelected(p);
        }
      }
    };

    loadPatients();
  }, [user?.id]);

  // Sync form inputs when patient changes
  const populateFormFields = (p: PatientProfile) => {
    setFullName(p.basicInfo?.name || '');
    setDob(p.basicInfo?.dateOfBirth || '');
    setAge(p.basicInfo?.age || '');
    setGender(p.basicInfo?.gender || '');
    setPreferredLang(p.basicInfo?.language || 'en');
    setState(p.basicInfo?.state || 'Assam');
    setPhone(p.basicInfo?.phone || '');
    setEmergencyName(
      p.emergencyContact?.primaryContactName ||
        p.emergencyContact?.primaryCaregiverName ||
        user?.name ||
        ''
    );
    setEmergencyPhone(
      p.emergencyContact?.primaryContactPhone ||
        user?.phone ||
        user?.phoneNumber ||
        user?.phone_number ||
        ''
    );
    setRelationship(
      p.emergencyContact?.relationship ||
        user?.relationship ||
        user?.caregivingRelationship ||
        'Family Caregiver'
    );
    setFormErrors({});
  };

  useEffect(() => {
    if (patient) {
      populateFormFields(patient);
    }
  }, [patient]);

  // Handle switching patient from selector
  const handleSelectPatient = (patientId: string) => {
    if (isEditing && isFormDirty()) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes for this patient. Discard changes and switch patient?'
      );
      if (!confirmSwitch) return;
    }

    const selected = StorageService.getPatientProfile(patientId, user?.id);
    setSelectedPatientId(patientId);
    setPatient(selected);
    StorageService.setActivePatientId(patientId, user?.id);
    if (onPatientSelected) {
      onPatientSelected(selected);
    }
    setIsEditing(false);
    setShowDiscardConfirm(false);
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Auto-calculate age from DOB
  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    if (newDob) {
      const birthDate = new Date(newDob);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        if (birthDate > today) {
          setFormErrors((prev) => ({ ...prev, dob: 'Date of birth cannot be in the future.' }));
          return;
        } else {
          setFormErrors((prev) => ({ ...prev, dob: undefined }));
        }

        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0 && calculatedAge <= 130) {
          setAge(calculatedAge);
        }
      }
    }
  };

  // Check if form has unsaved modifications
  const isFormDirty = (): boolean => {
    if (!patient) return false;
    return (
      fullName !== (patient.basicInfo?.name || '') ||
      dob !== (patient.basicInfo?.dateOfBirth || '') ||
      (age !== '' && age !== patient.basicInfo?.age) ||
      gender !== (patient.basicInfo?.gender || '') ||
      preferredLang !== (patient.basicInfo?.language || 'en') ||
      state !== (patient.basicInfo?.state || 'Assam') ||
      phone !== (patient.basicInfo?.phone || '') ||
      emergencyName !==
        (patient.emergencyContact?.primaryContactName ||
          patient.emergencyContact?.primaryCaregiverName ||
          '') ||
      emergencyPhone !== (patient.emergencyContact?.primaryContactPhone || '') ||
      relationship !== (patient.emergencyContact?.relationship || 'Family Caregiver')
    );
  };

  // Validation rules
  const validateForm = (): boolean => {
    const errors: {
      fullName?: string;
      dob?: string;
      phone?: string;
      emergencyPhone?: string;
    } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Patient full name is required.';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Patient full name must be at least 2 characters.';
    }

    if (dob) {
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) {
        errors.dob = 'Please enter a valid date.';
      } else if (birthDate > new Date()) {
        errors.dob = 'Date of birth cannot be in the future.';
      }
    }

    if (phone.trim() && !/^[+0-9\s-]{6,20}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid phone number format (e.g. +91 98765 43210).';
    }

    if (emergencyPhone.trim() && !/^[+0-9\s-]{6,20}$/.test(emergencyPhone.trim())) {
      errors.emergencyPhone =
        'Please enter a valid emergency contact phone number format.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save changes handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    setOfflineNotice(false);

    try {
      const updateData: UpdatePatientProfileData = {
        name: fullName.trim(),
        dateOfBirth: dob || undefined,
        age: typeof age === 'number' ? age : undefined,
        gender: gender || undefined,
        language: preferredLang,
        state,
        phone: phone.trim() || undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
        relationship: relationship.trim() || undefined,
      };

      const result = await PatientService.updatePatientProfile(
        selectedPatientId,
        updateData,
        user?.id
      );

      if (!result.success) {
        setSaveError(
          result.error ||
            'Unable to update the patient profile. Your existing information has not been changed. Please try again.'
        );
        return;
      }

      // Refresh local patient state
      const refreshed = StorageService.getPatientProfile(selectedPatientId, user?.id);
      setPatient(refreshed);
      populateFormFields(refreshed);

      if (onProfileUpdated) {
        onProfileUpdated(refreshed);
      }
      if (onPatientSelected) {
        onPatientSelected(refreshed);
      }

      setSaveSuccess(true);
      if (result.isOffline) {
        setOfflineNotice(true);
      }

      setIsEditing(false);
      setTimeout(() => {
        setSaveSuccess(false);
        setOfflineNotice(false);
      }, 4000);
    } catch (err: any) {
      setSaveError(
        'Unable to update the patient profile. Your existing information has not been changed. Please try again.'
      );
    } finally {
      setSaveLoading(false);
    }
  };

  // Cancel editing handler
  const handleCancelEdit = () => {
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
    } else {
      setIsEditing(false);
      populateFormFields(patient);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setIsEditing(false);
    populateFormFields(patient);
    setFormErrors({});
  };

  // Find language display metadata
  const selectedLangMeta =
    SUPPORTED_LANGUAGES_LIST.find((l) => l.languageCode === (patient.basicInfo?.language || 'en')) ||
    SUPPORTED_LANGUAGES_LIST[0];

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E4DED4] shadow-xs space-y-5 text-[#26332F]">
      {/* ── HEADER & PATIENT SELECTOR ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DED4] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#DDE9D9] text-[#176B61] flex items-center justify-center border border-[#B7D4CC] shadow-xs shrink-0">
            <HeartHandshake className="w-6 h-6 text-[#176B61]" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[#26332F]">Elderly Patient Profile</h3>
            <p className="text-xs text-[#66736D] font-medium">
              View and edit elderly patient identity, demographics, language, and emergency contacts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-patient authorized selector */}
          {authorizedPatients.length > 1 && (
            <div className="relative">
              <label className="sr-only">Select Patient</label>
              <div className="flex items-center gap-1.5 bg-[#FAF9F4] border border-[#E4DED4] rounded-xl px-3 py-1.5 shadow-xs">
                <UserCheck className="w-3.5 h-3.5 text-[#176B61]" />
                <span className="text-[11px] font-bold text-[#66736D]">Patient:</span>
                <select
                  value={selectedPatientId}
                  onChange={(e) => handleSelectPatient(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-[#26332F] outline-none cursor-pointer pr-1"
                >
                  {authorizedPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.basicInfo?.name || 'Patient'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setSaveSuccess(false);
                setSaveError(null);
              }}
              className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Editing Banner / Confirmation of selected target */}
      <div className="bg-[#FAF9F4] px-4 py-2 rounded-xl border border-[#E4DED4] flex items-center justify-between text-xs font-semibold">
        <span className="text-[#66736D]">
          Currently active record: <strong className="text-[#176B61] font-bold">{patient.basicInfo?.name || 'Patient'}</strong>
        </span>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-[#DDE9D9] text-[#176B61] rounded-full border border-[#B7D4CC]">
          ID: {patient.id.substring(0, 8)}...
        </span>
      </div>

      {/* ── NOTIFICATIONS & FEEDBACK ──────────────────────────────────── */}
      {saveSuccess && (
        <div className="p-3.5 bg-[#DDE9D9] border border-[#B7D4CC] text-[#176B61] rounded-2xl text-xs font-extrabold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#176B61] shrink-0" />
          <span>✓ Patient profile updated successfully</span>
        </div>
      )}

      {offlineNotice && (
        <div className="p-3.5 bg-[#F4EBD7] border border-[#E4DED4] text-[#26332F] rounded-2xl text-xs font-bold flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-[#176B61] shrink-0" />
          <span>Offline mode: Changes saved locally in IndexedDB and will sync automatically once connectivity returns.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 bg-[#EFD4D3] border border-[#DEAFB5] text-[#26332F] rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#8C2A31] shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ── UNSAVED CHANGES DISCARD MODAL ─────────────────────────────── */}
      {showDiscardConfirm && (
        <div className="p-4 bg-[#F8E9D9] border border-[#E8CDB5] rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#9E5536] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-extrabold text-[#26332F]">Unsaved Changes Detected</h4>
              <p className="text-xs text-[#66736D] mt-0.5">
                You have modified patient profile fields. Discarding will revert to previous information without saving.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
              className="px-3 py-1.5 bg-white border border-[#E4DED4] hover:bg-[#FAF9F4] text-[#26332F] font-bold text-xs rounded-xl cursor-pointer"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={handleConfirmDiscard}
              className="px-3.5 py-1.5 bg-[#EFD4D3] hover:bg-[#ebcecd] border border-[#DEAFB5] text-[#8C2A31] font-extrabold text-xs rounded-xl cursor-pointer"
            >
              Discard Changes
            </button>
          </div>
        </div>
      )}

      {/* ── VIEW MODE (READ-ONLY) ────────────────────────────────────── */}
      {!isEditing && (
        <div className="space-y-5 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Full Name */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Full Name
              </span>
              <span className="text-base font-extrabold text-[#26332F] block">
                {patient.basicInfo?.name || 'Not provided'}
              </span>
            </div>

            {/* Date of Birth & Age */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Date of Birth / Age
              </span>
              <span className="text-base font-extrabold text-[#26332F] block">
                {patient.basicInfo?.dateOfBirth
                  ? new Date(patient.basicInfo.dateOfBirth).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Not specified'}
                {patient.basicInfo?.age ? ` (${patient.basicInfo.age} yrs)` : ''}
              </span>
            </div>

            {/* Gender */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Gender
              </span>
              <span className="text-base font-extrabold text-[#26332F] block">
                {patient.basicInfo?.gender || 'Not specified'}
              </span>
            </div>

            {/* Preferred Language */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Preferred Language
              </span>
              <span className="text-sm font-extrabold text-[#26332F] flex items-center gap-1.5 mt-0.5">
                <span>{selectedLangMeta.flag}</span>
                <span>{selectedLangMeta.nativeName} ({selectedLangMeta.languageName})</span>
              </span>
            </div>

            {/* Region / State */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Region / State
              </span>
              <span className="text-base font-extrabold text-[#26332F] block">
                {patient.basicInfo?.state || 'Assam'}
              </span>
            </div>

            {/* Patient Phone */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Patient Phone Number
              </span>
              <span className="text-base font-extrabold text-[#26332F] block font-mono">
                {patient.basicInfo?.phone || 'Not provided'}
              </span>
            </div>

            {/* Emergency Contact Name */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Emergency Contact Name
              </span>
              <span className="text-base font-extrabold text-[#26332F] block">
                {patient.emergencyContact?.primaryContactName ||
                  patient.emergencyContact?.primaryCaregiverName ||
                  'Not provided'}
              </span>
            </div>

            {/* Relationship */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Relationship
              </span>
              <span className="text-base font-extrabold text-[#176B61] block">
                {patient.emergencyContact?.relationship || 'Family Caregiver'}
              </span>
            </div>

            {/* Emergency Contact Phone */}
            <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase font-black tracking-wider block">
                Emergency Contact Phone
              </span>
              <span className="text-base font-extrabold text-[#26332F] block font-mono">
                {patient.emergencyContact?.primaryContactPhone || 'Not provided'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODE (FORM CONTROLS) ────────────────────────────────── */}
      {isEditing && (
        <form onSubmit={handleSaveProfile} className="space-y-5 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Full Name <span className="text-[#176B61]">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className={`w-full px-3.5 py-2.5 bg-white border ${
                  formErrors.fullName ? 'border-[#DEAFB5] ring-2 ring-[#EFD4D3]' : 'border-[#DDD9D0]'
                } rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]`}
                required
              />
              {formErrors.fullName && (
                <span className="text-xs text-[#8C2A31] font-bold block mt-1">
                  {formErrors.fullName}
                </span>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => handleDobChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-3.5 py-2.5 bg-white border ${
                  formErrors.dob ? 'border-[#DEAFB5] ring-2 ring-[#EFD4D3]' : 'border-[#DDD9D0]'
                } rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]`}
              />
              {formErrors.dob && (
                <span className="text-xs text-[#8C2A31] font-bold block mt-1">
                  {formErrors.dob}
                </span>
              )}
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Age
              </label>
              <input
                type="number"
                min="1"
                max="130"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 76"
                className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61] cursor-pointer"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Not Specified">Prefer not to say</option>
              </select>
            </div>

            {/* Preferred Language */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Preferred Language
              </label>
              <select
                value={preferredLang}
                onChange={(e) => setPreferredLang(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F4] border border-[#DDD9D0] text-[#176B61] rounded-xl text-sm font-bold outline-none focus:border-[#176B61] cursor-pointer"
              >
                {SUPPORTED_LANGUAGES_LIST.map((lang) => (
                  <option key={lang.languageCode} value={lang.languageCode}>
                    {lang.flag} {lang.nativeName} ({lang.languageName})
                  </option>
                ))}
              </select>
            </div>

            {/* Region / State */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Region / North Eastern State
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61] cursor-pointer"
              >
                {NORTH_EAST_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Patient Phone Number */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Patient Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={`w-full px-3.5 py-2.5 bg-white border ${
                  formErrors.phone ? 'border-[#DEAFB5] ring-2 ring-[#EFD4D3]' : 'border-[#DDD9D0]'
                } rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61] font-mono`}
              />
              {formErrors.phone && (
                <span className="text-xs text-[#8C2A31] font-bold block mt-1">
                  {formErrors.phone}
                </span>
              )}
            </div>

            {/* Emergency Contact Name */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="e.g. Anitha Sharma"
                className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]"
              />
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Relationship to Patient
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61] cursor-pointer"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Emergency Contact Phone */}
            <div>
              <label className="block text-xs font-black text-[#26332F] mb-1">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={`w-full px-3.5 py-2.5 bg-white border ${
                  formErrors.emergencyPhone
                    ? 'border-[#DEAFB5] ring-2 ring-[#EFD4D3]'
                    : 'border-[#DDD9D0]'
                } rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61] font-mono`}
              />
              {formErrors.emergencyPhone && (
                <span className="text-xs text-[#8C2A31] font-bold block mt-1">
                  {formErrors.emergencyPhone}
                </span>
              )}
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4DED4]">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saveLoading}
              className="px-4 py-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-xs rounded-xl border border-[#E4DED4] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveLoading}
              className="px-5 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveLoading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
