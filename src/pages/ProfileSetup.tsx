import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { StorageService } from '../services/storage';
import { PatientService } from '../services/patientService';
import { AuthService } from '../services/authService';
import { CareTeamService } from '../services/careTeamService';
import { generateUUID } from '../utils/uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useI18n, SUPPORTED_LANGUAGES_LIST } from '../i18n';
import {
  CheckCircle2,
  User,
  Users,
  MapPin,
  Calendar,
  Bell,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Globe,
  Stethoscope,
  Pill,
  ShieldCheck,
  FileText,
  Clock,
  Heart,
  Upload,
  Camera,
  AlertTriangle,
  Eye,
  EyeOff,
  Volume2,
  Activity,
  HeartHandshake,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Check,
} from 'lucide-react';
import {
  FamiliarPerson,
  FamiliarPlace,
  RoutineItem,
  MedicalCondition,
  Medication,
  MedicalDocument,
  DailyFunctionProfile,
  PatientProfile,
} from '../types';

interface ProfileSetupProps {
  onComplete: () => void;
}

const COMMON_CONDITIONS = [
  'Dementia',
  "Alzheimer's disease",
  "Parkinson's disease",
  'Stroke history',
  'Diabetes',
  'Hypertension',
  'Arthritis',
  'Mild Cognitive Impairment (MCI)',
];

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

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { language, setLanguage, state, setStateAndSuggestLanguage, t, languageProfile } = useI18n();

  const [step, setStep] = useState<number>(1);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Step 1: Caregiver Profile ─────────────────────────────────────────────
  const [caregiverName, setCaregiverName] = useState<string>(user?.name || '');
  const [caregiverEmail, setCaregiverEmail] = useState<string>(user?.email || '');
  const [caregiverPhone, setCaregiverPhone] = useState<string>(
    user?.phone || user?.phoneNumber || user?.phone_number || ''
  );
  const [caregiverRelationship, setCaregiverRelationship] = useState<string>(
    user?.relationship || user?.caregivingRelationship || user?.caregiving_relationship || ''
  );
  const [caregiverLang, setCaregiverLang] = useState<string>(
    user?.preferredLanguage || user?.preferred_language || language || 'en'
  );

  // ── Step 2: Patient Information ──────────────────────────────────────────
  const [patientName, setPatientName] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<string>('');
  const [patientPhoto, setPatientPhoto] = useState<string>('');
  const patientPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // ── Step 3: Medical Information ──────────────────────────────────────────
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [conditionsList, setConditionsList] = useState<MedicalCondition[]>([]);
  const [customCondName, setCustomCondName] = useState<string>('');
  const [customCondYear, setCustomCondYear] = useState<string>(String(new Date().getFullYear()));

  const [visionDifficulties, setVisionDifficulties] = useState<boolean>(false);
  const [hearingDifficulties, setHearingDifficulties] = useState<boolean>(false);
  const [speechDifficulties, setSpeechDifficulties] = useState<boolean>(false);
  const [mobilityLimitations, setMobilityLimitations] = useState<boolean>(false);
  const [allergies, setAllergies] = useState<string>('');
  const [medicalNotes, setMedicalNotes] = useState<string>('');

  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedDosage, setNewMedDosage] = useState<string>('');
  const [newMedFreq, setNewMedFreq] = useState<string>('Daily');
  const [newMedTime, setNewMedTime] = useState<string>('08:00 AM');
  const [newMedPurpose, setNewMedPurpose] = useState<string>('');

  // ── Step 4: Family Members & Places ──────────────────────────────────────
  const [people, setPeople] = useState<FamiliarPerson[]>([]);
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [newPersonRel, setNewPersonRel] = useState<string>('');
  const [newPersonPhoto, setNewPersonPhoto] = useState<string | null>(null);
  const personFileInputRef = useRef<HTMLInputElement | null>(null);

  const [places, setPlaces] = useState<FamiliarPlace[]>([]);
  const [newPlaceName, setNewPlaceName] = useState<string>('');
  const [newPlaceDesc, setNewPlaceDesc] = useState<string>('');
  const [newPlacePhoto, setNewPlacePhoto] = useState<string | null>(null);
  const placeFileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Step 5: Patient Login Credentials (Caregiver-Created) ─────────────────
  const [patientLoginId, setPatientLoginId] = useState<string>('');
  const [patientPassword, setPatientPassword] = useState<string>('');
  const [confirmPatientPassword, setConfirmPatientPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // ── Step 6: Daily Reminders & Preferences ─────────────────────────────────
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [newRoutineTime, setNewRoutineTime] = useState<string>('08:00 AM');
  const [newRoutineActivity, setNewRoutineActivity] = useState<string>('');
  const [newRoutineCategory, setNewRoutineCategory] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [emergencyPhone, setEmergencyPhone] = useState<string>(
    user?.phone || user?.phoneNumber || user?.phone_number || ''
  );

  React.useEffect(() => {
    if (user) {
      if (user.name && !caregiverName) setCaregiverName(user.name);
      if (user.email && !caregiverEmail) setCaregiverEmail(user.email);
      const ph = user.phone || user.phoneNumber || user.phone_number;
      if (ph) {
        if (!caregiverPhone) setCaregiverPhone(ph);
        if (!emergencyPhone) setEmergencyPhone(ph);
      }
      const rel = user.relationship || user.caregivingRelationship || user.caregiving_relationship;
      if (rel && !caregiverRelationship) setCaregiverRelationship(rel);
      const l = user.preferredLanguage || user.preferred_language;
      if (l && (!caregiverLang || caregiverLang === 'en')) setCaregiverLang(l);
    }
  }, [user]);

  // Handle DOB change with auto-age calculation
  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    if (newDob) {
      const birthDate = new Date(newDob);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
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

  // Photo handlers
  const handlePatientPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setPatientPhoto(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePersonPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setNewPersonPhoto(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePlacePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setNewPlacePhoto(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Condition toggling
  const toggleCondition = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter(c => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const handleAddCustomCondition = () => {
    if (!customCondName.trim()) return;
    const newCond: MedicalCondition = {
      id: `mc-${Date.now()}`,
      name: customCondName.trim(),
      diagnosedYear: parseInt(customCondYear) || 2024,
    };
    setConditionsList([...conditionsList, newCond]);
    setSelectedConditions([...selectedConditions, customCondName.trim()]);
    setCustomCondName('');
  };

  // Medication add
  const handleAddMedication = () => {
    if (!newMedName.trim()) return;
    const newM: Medication = {
      id: `m-${Date.now()}`,
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || 'Standard Dose',
      frequency: newMedFreq,
      time: newMedTime,
      purpose: newMedPurpose.trim() || 'Health Maintenance',
      doctorName: '',
    };
    setMedications(prev => [...prev, newM]);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedPurpose('');
  };

  // Routine add
  const handleAddRoutine = () => {
    if (!newRoutineActivity.trim()) return;
    const item: RoutineItem = {
      id: `r-${Date.now()}`,
      time: newRoutineTime,
      activity: newRoutineActivity.trim(),
      category: newRoutineCategory,
    };
    setRoutines(prev => [...prev, item]);
    setNewRoutineActivity('');
  };

  // Family add
  const handleAddPerson = () => {
    if (!newPersonName.trim() || !newPersonRel.trim()) return;
    const newPerson: FamiliarPerson = {
      id: generateUUID(),
      name: newPersonName.trim(),
      relationship: newPersonRel.trim(),
      photoUrl: newPersonPhoto || '',
    };
    setPeople(prev => [...prev, newPerson]);
    setNewPersonName('');
    setNewPersonRel('');
    setNewPersonPhoto(null);
  };

  // Place add
  const handleAddPlace = () => {
    if (!newPlaceName.trim()) return;
    const newPlace: FamiliarPlace = {
      id: generateUUID(),
      name: newPlaceName.trim(),
      description: newPlaceDesc.trim(),
      photoUrl: newPlacePhoto || '',
    };
    setPlaces(prev => [...prev, newPlace]);
    setNewPlaceName('');
    setNewPlaceDesc('');
    setNewPlacePhoto(null);
  };

  // Step Validation
  const validateStep = (): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!caregiverName.trim()) {
        setErrorMsg('Please enter your full name as the primary caregiver.');
        return false;
      }
      if (!caregiverRelationship.trim()) {
        setErrorMsg('Please select your relationship to the patient.');
        return false;
      }
    } else if (step === 2) {
      if (!patientName.trim()) {
        setErrorMsg('Please enter the patient’s full name.');
        return false;
      }
    } else if (step === 5) {
      if (!patientLoginId.trim()) {
        setErrorMsg('Please specify a Login ID or Email for the patient.');
        return false;
      }
      if (patientPassword.length < 6) {
        setErrorMsg('Temporary password must be at least 6 characters.');
        return false;
      }
      if (patientPassword !== confirmPatientPassword) {
        setErrorMsg('Passwords do not match. Please verify.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 7));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setErrorMsg(null);
    setStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Step: Complete Caregiver Setup & Provision Patient Account
  const handleSaveProfile = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    setErrorMsg(null);

    const isValidUUID = (str?: string | null): boolean =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    let effectiveCaregiverId = user?.id;
    if (!isValidUUID(effectiveCaregiverId) && isSupabaseConfigured()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id && isValidUUID(sessionData.session.user.id)) {
          effectiveCaregiverId = sessionData.session.user.id;
        }
      } catch {}
    }
    const caregiverId = effectiveCaregiverId || user?.id || 'user-demo-cg';

    // If this caregiver already has an assigned patient, update that patient; otherwise generate a new unique UUID
    const existingPatientId = CareTeamService.getActivePatientIdForCaregiver(caregiverId);
    const patientId = existingPatientId && isValidUUID(existingPatientId) ? existingPatientId : generateUUID();

    try {
      // 1. Mark setup_completed = true in caregiver profile and persist latest caregiver details in Supabase & local DB
      await AuthService.updateProfile(caregiverId, {
        full_name: caregiverName.trim(),
        email: caregiverEmail.trim(),
        phone: caregiverPhone.trim(),
        relationship: caregiverRelationship.trim(),
        preferred_language: caregiverLang,
        setup_completed: true,
      });

      // 2. Save custom registered family members and familiar places to local storage
      for (const p of people) {
        StorageService.addFamiliarPerson(p, patientId);
      }
      for (const pl of places) {
        StorageService.addFamiliarPlace(pl, patientId);
      }

      // 3. Construct structured Patient Profile
      const parsedAge = typeof age === 'number' ? age : Number(age);
      const fullPatientProfile: PatientProfile = {
        id: patientId,
        familiarPeople: people,
        familiarPlaces: places,
        basicInfo: {
          name: patientName.trim(),
          dateOfBirth: dob,
          age: !isNaN(parsedAge) && parsedAge > 0 ? parsedAge : 0,
          gender: gender || 'Not Specified',
          state,
          language,
          photo: patientPhoto,
        },
        medicalHistory: {
          conditions: conditionsList,
          neurologicalHistory: [],
          surgeries: [],
          hospitalizations: [],
          allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
          documents: [],
          visionDifficulties,
          hearingDifficulties,
          speechDifficulties,
          mobilityLimitations,
          sleepDifficulties: false,
          notes: medicalNotes.trim(),
        },
        medications,
        dailyRoutine: routines,
        cognitiveProfile: {
          memory: 70,
          attention: 70,
          recognition: 70,
          recall: 70,
          language: 70,
          familiarity: 70,
        },
        dailyFunction: {
          memoryDifficulty: 'none',
          attentionDifficulty: 'none',
          peopleRecognitionDifficulty: 'none',
          placeRecognitionDifficulty: 'none',
          routineDifficulty: 'none',
          communicationDifficulty: 'none',
          dailyTaskDifficulty: 'none',
        },
        caregiverObservations: [
          people.length > 0 ? `Responds to familiar family members (${people.map(p => p.name).join(', ')}).` : '',
        ].filter(Boolean),
        emergencyContact: {
          primaryContactName: caregiverName.trim(),
          primaryContactPhone: emergencyPhone.trim() || caregiverPhone.trim(),
          primaryCaregiverName: `${caregiverName.trim()}${caregiverRelationship ? ` (${caregiverRelationship.trim()})` : ''}`,
          doctorName: '',
          allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
        },
        patientCredentials: {
          loginId: patientLoginId.trim(),
          password: patientPassword.trim(),
        },
        accessibility: {
          largeText: visionDifficulties,
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

      // 4. Save Patient record into Supabase patients table (and IndexedDB) FIRST so foreign keys are satisfied
      if (isValidUUID(patientId) && isSupabaseConfigured()) {
        try {
          const patientDbPayload = {
            id: patientId,
            user_id: isValidUUID(caregiverId) ? caregiverId : null,
            full_name: patientName.trim(),
            date_of_birth: dob || null,
            gender: gender || 'Not Specified',
            preferred_language: language || 'en',
            medical_history: JSON.stringify({
              ...(fullPatientProfile.medicalHistory || {}),
              familiarPeople: people,
              familiarPlaces: places,
              patientCredentials: {
                loginId: patientLoginId.trim(),
                password: patientPassword.trim(),
              },
            }),
            emergency_contact_name: `${caregiverName.trim()}${caregiverRelationship ? ` (${caregiverRelationship.trim()})` : ''}`,
            emergency_contact_phone: emergencyPhone.trim() || caregiverPhone.trim(),
            updated_at: new Date().toISOString(),
          };
          const { error: patientDbErr } = await supabase.from('patients').upsert(patientDbPayload, { onConflict: 'id' });
          if (patientDbErr) {
            console.error('Patient record upsert in Supabase error:', patientDbErr.message);
          } else {
            console.log('✅ Patient record successfully saved in Supabase patients table:', patientId);
          }
        } catch (patSyncErr) {
          console.warn('Patient table sync notice:', patSyncErr);
        }
      }

      // 5. Automatically link Caregiver as PRIMARY CAREGIVER in caregiver_patients table (Foreign Key satisfied!)
      await CareTeamService.setPrimaryCaregiver(
        caregiverId,
        caregiverName,
        caregiverEmail,
        patientId,
        caregiverRelationship
      );

      // 5b. Save Daily Routines directly to Supabase routines table and local storage
      if (routines.length > 0) {
        for (const r of routines) {
          const routineUuid = generateUUID();
          let formattedTime = '08:00:00';
          const timeStr = (r.time || '08:00 AM').trim();
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

          if (isValidUUID(patientId) && isSupabaseConfigured()) {
            try {
              const routinePayload = {
                id: routineUuid,
                patient_id: patientId,
                title: r.activity,
                description: r.category ? `Category: ${r.category}` : 'Daily routine checkpoint',
                scheduled_time: formattedTime,
                repeat_pattern: 'daily',
                enabled: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              const { error: routineErr } = await supabase.from('routines').upsert(routinePayload, { onConflict: 'id' });
              if (routineErr) {
                console.error('Failed to sync routine to Supabase:', routineErr.message);
              } else {
                console.log('✅ Routine checkpoint synced to Supabase routines table:', r.activity);
              }
            } catch (rErr) {
              console.warn('Routine Supabase sync error:', rErr);
            }
          }

          // Save to local storage for patient
          StorageService.addReminder(
            {
              id: routineUuid,
              title: r.activity,
              time: r.time,
              category: (r.category as any) || 'routine',
              repeat: 'daily',
              description: r.category ? `Category: ${r.category}` : 'Daily routine checkpoint',
              isCompleted: false,
            },
            patientId
          );
        }
      }

      // 6. Provision patient login credentials via secure auth service
      const patientAccountResult = await AuthService.createPatientAccount({
        loginId: patientLoginId,
        password: patientPassword,
        fullName: patientName,
        patientId,
        caregiverId,
        relationship: caregiverRelationship,
      });

      if (patientAccountResult.error) {
        console.warn('Patient account creation notice:', patientAccountResult.error);
      }

      await PatientService.savePatientProfile(fullPatientProfile, caregiverId);

      // Cleanse password state immediately after provisioning (Security Requirement)
      setPatientPassword('');
      setConfirmPatientPassword('');

      // 7. Complete wizard navigation
      onComplete();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to complete patient setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const STEP_TITLES = [
    'Caregiver Profile',
    'Patient Info',
    'Medical Info',
    'Family & Places',
    'Patient Login Credentials',
    'Daily Reminders & Routine',
    'Review & Finish',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-900">
      {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border border-teal-500/40">
              Caregiver Setup Wizard
            </span>
            <span className="bg-rose-500/20 text-rose-300 text-xs font-bold px-3 py-1 rounded-full border border-rose-500/40 flex items-center gap-1">
              {languageProfile.flag} {languageProfile.nativeName} ({state})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Patient Care & Account Setup
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Configure personalized cognitive support, medical profile, and patient login access{patientName.trim() ? <span> for <strong>{patientName.trim()}</strong></span> : ''}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPrivacyNotice(!showPrivacyNotice)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Privacy & Consent
        </button>
      </div>

      {/* Privacy Notice Banner */}
      {showPrivacyNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-950 p-4 rounded-2xl text-xs font-semibold space-y-1.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-extrabold flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Medical Data & Credential Security
            </span>
            <button onClick={() => setShowPrivacyNotice(false)} className="text-emerald-700 font-bold hover:underline">
              Dismiss
            </button>
          </div>
          <p>
            Patient login credentials created here allow elderly access without requiring independent patient registration.
            All medical records, medication routines, and photos are encrypted in offline-first storage and synchronized securely with Row Level Security.
          </p>
        </div>
      )}

      {/* Error notification */}
      {errorMsg && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── STEP WIZARD CONTAINER ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
        
        {/* Step Indicator Header */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-extrabold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Step {step} of 7
            </span>
            <span className="text-xs font-extrabold text-slate-700">
              {STEP_TITLES[step - 1]}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
            {STEP_TITLES[step - 1]}
          </h2>

          {/* Progress dots */}
          <div className="grid grid-cols-7 gap-2 mt-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div
                key={i}
                className={`h-2 rounded-full transition ${
                  i <= step ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── STEP 1: CAREGIVER PROFILE ──────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 flex items-start gap-3">
              <HeartHandshake className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs text-teal-900 leading-relaxed">
                <strong>Primary Caregiver Assignment:</strong> Completing this wizard establishes you as the verified primary caregiver with full administrative oversight, SOS escalation authority, and care team invitation privileges.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={caregiverName}
                    onChange={e => setCaregiverName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. Caregiver Full Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    value={caregiverPhone}
                    onChange={e => setCaregiverPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    value={caregiverEmail}
                    onChange={e => setCaregiverEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. caregiver@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Relationship to Patient *</label>
                <select
                  value={caregiverRelationship}
                  onChange={e => setCaregiverRelationship(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">Select Relationship</option>
                  {RELATIONSHIP_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Preferred Language</label>
              <select
                value={caregiverLang}
                onChange={e => setCaregiverLang(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES_LIST.map(lang => (
                  <option key={lang.languageCode} value={lang.languageCode}>
                    {lang.flag} {lang.languageName} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── STEP 2: PATIENT INFORMATION ────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" /> Patient Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Patient Full Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => handleDobChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. 74"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">Select Gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* State & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Region / North Eastern State</label>
                <select
                  value={state}
                  onChange={e => setStateAndSuggestLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="Assam">Assam (অসম)</option>
                  <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                  <option value="Manipur">Manipur (মণিপুর)</option>
                  <option value="Meghalaya">Meghalaya</option>
                  <option value="Mizoram">Mizoram</option>
                  <option value="Nagaland">Nagaland</option>
                  <option value="Tripura">Tripura (ত্রিপুরা)</option>
                  <option value="Sikkim">Sikkim (सिक्किम)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Patient Primary Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-teal-50 border border-teal-300 text-teal-900 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {SUPPORTED_LANGUAGES_LIST.map(lang => (
                    <option key={lang.languageCode} value={lang.languageCode}>
                      {lang.flag} {lang.nativeName} ({lang.languageName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Patient Photo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Patient Photo</label>
              <div className="flex items-center gap-4">
                {patientPhoto ? (
                  <img
                    src={patientPhoto}
                    alt={patientName || 'Patient'}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <User className="w-6 h-6 text-slate-300" />
                    <span className="text-[9px] font-bold mt-0.5">No photo</span>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    ref={patientPhotoInputRef}
                    accept="image/*"
                    onChange={handlePatientPhotoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patientPhotoInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-teal-600" /> {patientPhoto ? 'Change Photo' : 'Upload Patient Photo'}
                    </button>
                    {patientPhoto && (
                      <button
                        type="button"
                        onClick={() => setPatientPhoto('')}
                        className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: MEDICAL INFORMATION ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" /> Clinical History & Medications
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Record diagnosed conditions and scheduled medications for adaptive game pacing and routine prompts.
              </p>
            </div>

            {/* Diagnosed Conditions Checkboxes */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Diagnosed Conditions
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COMMON_CONDITIONS.map(cond => {
                  const isChecked = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
                      className={`p-3 rounded-xl border text-xs font-extrabold text-left transition flex items-center justify-between ${
                        isChecked
                          ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cond}</span>
                      {isChecked && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sensory & Physical Adaptations */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                Sensory Adaptations (Auto-Applies to UI)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-slate-800">
                <label className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visionDifficulties}
                    onChange={e => setVisionDifficulties(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <Eye className="w-4 h-4 text-teal-600" /> Vision Difficulties (Large Font Enabled)
                </label>

                <label className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hearingDifficulties}
                    onChange={e => setHearingDifficulties(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <Volume2 className="w-4 h-4 text-teal-600" /> Hearing Difficulties (High Volume Audio)
                </label>

                <label className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={speechDifficulties}
                    onChange={e => setSpeechDifficulties(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <Activity className="w-4 h-4 text-teal-600" /> Speech & Expression Support
                </label>

                <label className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mobilityLimitations}
                    onChange={e => setMobilityLimitations(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <User className="w-4 h-4 text-teal-600" /> Mobility Limitations
                </label>
              </div>
            </div>

            {/* Medications Schedule */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-teal-600" /> Scheduled Medications ({medications.length})
              </span>

              {medications.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                  No scheduled medications added yet. Use the form below to add prescribed medicines if applicable.
                </div>
              ) : (
                <div className="space-y-2">
                  {medications.map(m => (
                    <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900 block">{m.name} ({m.dosage})</span>
                        <span className="text-slate-500 font-semibold">{m.frequency} — {m.time} | {m.purpose}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter(med => med.id !== m.id))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Medication Inputs */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-extrabold text-slate-800 block">+ Add Medication</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Medication Name (e.g. Donepezil)"
                    value={newMedName}
                    onChange={e => setNewMedName(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Dosage (e.g. 5mg)"
                    value={newMedDosage}
                    onChange={e => setNewMedDosage(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Time (e.g. 09:00 PM)"
                    value={newMedTime}
                    onChange={e => setNewMedTime(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Medication
                </button>
              </div>
            </div>

            {/* Allergies & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Known Allergies</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                  placeholder="e.g. Penicillin, Peanuts"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clinical / Caregiver Notes</label>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={e => setMedicalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                  placeholder="Caregiver observations or precautions"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: FAMILY MEMBERS & PLACES ────────────────────── */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-600" /> Familiar Family Members & Places
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add photos and names of loved ones and meaningful locations. These power the "Who Is This?" and "Familiar Places" memory games!
              </p>
            </div>

            {/* Familiar People */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-600" /> Family Members ({people.length})
              </span>

              {people.length === 0 ? (
                <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                  No family members added yet. Add family members below to personalize memory games like "Who Is This?".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {people.map(p => (
                    <div key={p.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate">
                          <div className="font-extrabold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-teal-700 font-bold">{p.relationship}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPeople(people.filter(item => item.id !== p.id))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Person Inputs */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <input
                  type="file"
                  ref={personFileInputRef}
                  accept="image/*"
                  onChange={handlePersonPhotoUpload}
                  className="hidden"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Rahul Sharma)"
                    value={newPersonName}
                    onChange={e => setNewPersonName(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Grandson)"
                    value={newPersonRel}
                    onChange={e => setNewPersonRel(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => personFileInputRef.current?.click()}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                    {newPersonPhoto ? 'Change Photo' : '📷 Upload Member Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPerson}
                    className="ml-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Family Member
                  </button>
                </div>
              </div>
            </div>

            {/* Familiar Places */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-600" /> Familiar Places ({places.length})
              </span>

              {places.length === 0 ? (
                <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                  No familiar places added yet. Add meaningful locations (e.g. Home, Temple, Park) to strengthen memory orientation.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {places.map(pl => (
                    <div key={pl.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {pl.photoUrl ? (
                          <img src={pl.photoUrl} alt={pl.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="truncate">
                          <div className="font-extrabold text-slate-900 truncate">{pl.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{pl.description}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlaces(places.filter(item => item.id !== pl.id))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Place Inputs */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <input
                  type="file"
                  ref={placeFileInputRef}
                  accept="image/*"
                  onChange={handlePlacePhotoUpload}
                  className="hidden"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Place Name (e.g. Ancestral Home in Tezpur)"
                    value={newPlaceName}
                    onChange={e => setNewPlaceName(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Description (e.g. Where family gathers for Bihu)"
                    value={newPlaceDesc}
                    onChange={e => setNewPlaceDesc(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => placeFileInputRef.current?.click()}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                    {newPlacePhoto ? 'Change Photo' : '📷 Upload Place Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPlace}
                    className="ml-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: PATIENT LOGIN CREDENTIALS (KEY MEDICAL MODEL) ─── */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sky-950 font-extrabold text-sm">
                <KeyRound className="w-5 h-5 text-sky-700" /> Caregiver-Provisioned Patient Account
              </div>
              <p className="text-xs text-sky-800 leading-relaxed">
                Elderly dementia patients should not undergo complex self-signup procedures. You are creating the patient's device access credentials.
                The patient will simply enter this <strong>Login ID</strong> and <strong>Password</strong> to sign in from their tablet or home terminal.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Patient Login ID or Email *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={patientLoginId}
                    onChange={e => setPatientLoginId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. username or patient email"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Can be an easy username or email address.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Temporary Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={patientPassword}
                      onChange={e => setPatientPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder="Min. 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPatientPassword}
                      onChange={e => setConfirmPatientPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder="Repeat password"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>Security Protection:</strong> Passwords are authenticated via Supabase Auth Admin hash protocols and are never stored in plaintext within medical records or client state.
              </span>
            </div>
          </div>
        )}

        {/* ── STEP 6: DAILY REMINDERS & PREFERENCES ───────────────── */}
        {step === 6 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" /> Daily Reminders & Routine Schedule
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set routine checkpoints for the Memory Assistant and regional voice assistant to announce to the patient.
              </p>
            </div>

            {/* Daily Routine Items */}
            {/* Daily Routine Items */}
            {routines.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">No routine checkpoints added yet. Add checkpoints below, or load a standard routine template.</span>
                <button
                  type="button"
                  onClick={() => setRoutines([
                    { id: `r-${Date.now()}-1`, time: '08:00 AM', activity: 'Morning Wakeup & Hydration', category: 'morning' },
                    { id: `r-${Date.now()}-2`, time: '01:00 PM', activity: 'Lunch & Relax', category: 'afternoon' },
                    { id: `r-${Date.now()}-3`, time: '05:00 PM', activity: 'Evening Walk & Tea', category: 'evening' },
                    { id: `r-${Date.now()}-4`, time: '09:00 PM', activity: 'Bedtime', category: 'night' },
                  ])}
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg border border-teal-200 transition shrink-0 cursor-pointer"
                >
                  + Load Standard Routine
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {routines.map(r => (
                  <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-slate-900 block">{r.time} — {r.activity}</span>
                      <span className="text-[10px] text-teal-700 font-bold uppercase">{r.category}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoutines(routines.filter(item => item.id !== r.id))}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Routine Input */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold text-slate-800 block">+ Add Routine Checkpoint</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Time (e.g. 04:00 PM)"
                  value={newRoutineTime}
                  onChange={e => setNewRoutineTime(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                />
                <input
                  type="text"
                  placeholder="Activity (e.g. Tea & Music)"
                  value={newRoutineActivity}
                  onChange={e => setNewRoutineActivity(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                />
                <select
                  value={newRoutineCategory}
                  onChange={e => setNewRoutineCategory(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddRoutine}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Routine Item
              </button>
            </div>

            {/* Emergency Phone Number */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Patient Emergency Call Contact (Linked to Patient SOS Button)
              </label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
        )}

        {/* ── STEP 7: REVIEW & FINISH ─────────────────────────────── */}
        {step === 7 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" /> Review Setup & Activate Patient Account
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Please verify the patient details and login credentials below before completing setup.
              </p>
            </div>

            {/* Summary Overview */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="font-extrabold text-slate-900 text-base">{patientName || 'Patient Name Not Set'}</span>
                  <span className="text-slate-500 ml-2 font-bold">
                    ({age ? `${age} years` : 'Age not specified'}{gender ? ` • ${gender}` : ''})
                  </span>
                </div>
                <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full font-bold">
                  {languageProfile.flag} {languageProfile.nativeName} ({state})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase">Primary Caregiver</div>
                  <div className="font-bold text-slate-900">{caregiverName || 'Caregiver'} ({caregiverRelationship || 'Not set'})</div>
                  <div className="text-slate-500">{caregiverEmail || 'No email'} • {caregiverPhone || 'No phone'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase">Patient Login Credentials</div>
                  <div className="font-mono font-bold text-teal-800">Login ID: {patientLoginId || 'Not set'}</div>
                  <div className="font-mono text-slate-600">Password: {patientPassword ? '••••••••' : 'Not set'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase">Medical Summary</div>
                  <div>Conditions: {selectedConditions.length > 0 ? selectedConditions.join(', ') : 'None recorded'}</div>
                  <div>Medications: {medications.length} items scheduled</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase">Cognitive Memory Assets</div>
                  <div>Family Members: {people.length} registered</div>
                  <div>Familiar Places: {places.length} registered</div>
                  <div>Daily Routines: {routines.length} checkpoints</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveProfile}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Activating Patient Account...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Finish Setup & Launch Caregiver Dashboard
                </>
              )}
            </button>
          </div>
        )}

        {/* ── WIZARD STEP NAVIGATION BUTTONS ─────────────────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 7 && (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
