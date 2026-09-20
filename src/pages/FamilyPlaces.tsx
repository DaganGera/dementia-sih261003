import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { CareTeamService } from '../services/careTeamService';
import { FamiliarPerson, FamiliarPlace, PatientProfile } from '../types';
import {
  Users,
  MapPin,
  Plus,
  Trash2,
  Upload,
  Heart,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Image as ImageIcon,
  User,
  Info,
} from 'lucide-react';

interface FamilyPlacesProps {
  onNavigate: (page: string) => void;
}

const COMMON_RELATIONSHIPS = [
  'Spouse',
  'Son',
  'Daughter',
  'Grandson',
  'Granddaughter',
  'Brother',
  'Sister',
  'Caregiver',
  'Doctor',
  'Friend',
];

const COMMON_PLACE_TYPES = [
  'Home / Living Room',
  'Bedroom',
  'Kitchen',
  'Ancestral Home',
  'Garden / Backyard',
  'Local Park',
  'Temple / Place of Worship',
  'Doctor’s Clinic',
  'Market / Grocery',
];

export const FamilyPlaces: React.FC<FamilyPlacesProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Active Patient Resolution
  const [patient, setPatient] = useState<PatientProfile>(() =>
    StorageService.getPatientProfile(undefined, user?.id)
  );
  const caregiverPatientIds = user?.id ? CareTeamService.getPatientsForCaregiver(user.id) : [];
  const allPatients = StorageService.getAllPatientProfiles();
  const availablePatients = allPatients.filter(
    (p) => caregiverPatientIds.includes(p.id) || p.id === patient?.id
  );

  // Tab State: 'all' | 'family' | 'places'
  const [activeTab, setActiveTab] = useState<'all' | 'family' | 'places'>('all');

  // People & Places State
  const [people, setPeople] = useState<FamiliarPerson[]>([]);
  const [places, setPlaces] = useState<FamiliarPlace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Family Member Form State
  const [personName, setPersonName] = useState<string>('');
  const [personRelationship, setPersonRelationship] = useState<string>('Son');
  const [customRelationship, setCustomRelationship] = useState<string>('');
  const [personNotes, setPersonNotes] = useState<string>('');
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState<boolean>(false);
  const personFileInputRef = useRef<HTMLInputElement>(null);

  // Add Familiar Place Form State
  const [placeName, setPlaceName] = useState<string>('');
  const [placeDescription, setPlaceDescription] = useState<string>('');
  const [placePhoto, setPlacePhoto] = useState<string | null>(null);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState<boolean>(false);
  const placeFileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  const loadData = async (targetPid?: string) => {
    const pid = targetPid || patient?.id;
    if (!pid) return;
    setLoading(true);
    try {
      // 1. Fetch Cloud & Local People
      let cloudPeople = await StorageService.fetchFamiliarPeopleFromCloud(pid);
      if (!cloudPeople || cloudPeople.length === 0) {
        cloudPeople = StorageService.getFamiliarPeople(pid);
      }
      setPeople(cloudPeople || []);

      // 2. Fetch Cloud & Local Places
      let cloudPlaces = await StorageService.fetchFamiliarPlacesFromCloud(pid);
      if (!cloudPlaces || cloudPlaces.length === 0) {
        cloudPlaces = StorageService.getFamiliarPlaces(pid);
      }
      setPlaces(cloudPlaces || []);
    } catch (e) {
      console.warn('Error loading family and places:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(patient?.id);
  }, [patient?.id]);

  // Handle Photo Uploads with Base64 Conversion
  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Add Person Submit
  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setErrorMsg('Please provide the family member’s name.');
      return;
    }

    const finalRel =
      personRelationship === 'Other' ? customRelationship.trim() || 'Relative' : personRelationship;

    const newPerson = StorageService.addFamiliarPerson(
      {
        name: personName.trim(),
        relationship: finalRel,
        photoUrl: personPhoto || '',
        notes: personNotes.trim() || undefined,
      },
      patient?.id
    );

    setPeople((prev) => [newPerson, ...prev.filter((p) => p.id !== newPerson.id)]);
    setPersonName('');
    setPersonRelationship('Son');
    setCustomRelationship('');
    setPersonNotes('');
    setPersonPhoto(null);
    setShowAddPersonModal(false);

    setSuccessMsg(`Added ${newPerson.name} to familiar family members!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Delete Person
  const handleDeletePerson = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from familiar people?`)) {
      StorageService.deleteFamiliarPerson(id, patient?.id);
      setPeople((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg(`Removed ${name}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Add Place Submit
  const handleAddPlaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim()) {
      setErrorMsg('Please provide the place name.');
      return;
    }

    const newPlace = StorageService.addFamiliarPlace(
      {
        name: placeName.trim(),
        description: placeDescription.trim() || 'A familiar place for the patient',
        photoUrl: placePhoto || '',
      },
      patient?.id
    );

    setPlaces((prev) => [newPlace, ...prev.filter((p) => p.id !== newPlace.id)]);
    setPlaceName('');
    setPlaceDescription('');
    setPlacePhoto(null);
    setShowAddPlaceModal(false);

    setSuccessMsg(`Added ${newPlace.name} to familiar places!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Delete Place
  const handleDeletePlace = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from familiar places?`)) {
      StorageService.deleteFamiliarPlace(id, patient?.id);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg(`Removed "${name}".`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#26332F]">
      {/* ── TOP HEADER & PATIENT SELECTOR ──────────────────────── */}
      <div className="bg-[#FAF9F4] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E4DED4] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-3 py-1 bg-white hover:bg-[#E4DED4]/50 text-[#176B61] text-xs font-bold rounded-full border border-[#B7D4CC] flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            <span className="bg-[#DDE9D9] text-[#176B61] text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border border-[#BFCFC5]">
              Family & Places Hub
            </span>
            {availablePatients.length > 1 ? (
              <select
                value={patient?.id}
                onChange={(e) => {
                  const selected = StorageService.getPatientProfile(e.target.value, user?.id);
                  setPatient(selected);
                  StorageService.setActivePatientId(selected.id, user?.id);
                  loadData(selected.id);
                }}
                className="bg-white border border-[#E4DED4] text-[#26332F] text-xs font-bold rounded-full px-3 py-1 outline-none cursor-pointer"
              >
                {availablePatients.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white text-[#26332F]">
                    Patient: {p.basicInfo.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="bg-[#DDE9D9] text-[#176B61] text-xs font-bold px-3 py-1 rounded-full border border-[#BFCFC5] flex items-center gap-1">
                Patient: {patient?.basicInfo?.name || 'Selected Patient'}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#26332F] flex items-center gap-3">
            <Heart className="w-9 h-9 text-[#176B61]" /> Family & Familiar Places
          </h1>
          <p className="text-sm text-[#66736D] mt-1.5 max-w-2xl">
            Add pictures, names, and memory notes of loved ones and cherished places for{' '}
            <strong>{patient?.basicInfo?.name || 'the patient'}</strong>. These directly power the{' '}
            <strong>"Who Is This?"</strong> face-recall game, <strong>"Familiar Places"</strong>{' '}
            game, and the <strong>AI Memory Assistant</strong>.
          </p>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setErrorMsg(null);
              setShowAddPersonModal(true);
            }}
            className="px-4 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" /> + Add Family Member
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setShowAddPlaceModal(true);
            }}
            className="px-4 py-2.5 bg-[#DCEEEF] hover:bg-[#cce5e7] text-[#176B61] font-extrabold text-sm rounded-xl transition flex items-center gap-2 border border-[#B7D4CC] shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#176B61]" /> + Add Familiar Place
          </button>
        </div>
      </div>

      {/* ── NOTIFICATIONS & FEEDBACK ────────────────────────────── */}
      {successMsg && (
        <div className="bg-[#DDE9D9] text-[#176B61] px-5 py-3.5 rounded-2xl border border-[#BFCFC5] font-bold text-sm flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-[#F4E4C8] text-[#26332F] px-5 py-3.5 rounded-2xl border border-[#E4DED4] font-bold text-sm flex items-center gap-2 shadow-xs animate-fade-in">
          <AlertCircle className="w-5 h-5 text-[#176B61] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── HOW IT WORKS CALLOUT ────────────────────────────────── */}
      <div className="bg-[#F4EBD7] border border-[#E4DED4] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white text-[#176B61] flex items-center justify-center border border-[#E4DED4] shrink-0">
            <Sparkles className="w-5 h-5 text-[#176B61]" />
          </div>
          <div>
            <h4 className="font-extrabold text-[#26332F] text-sm">
              How do these memories help the patient?
            </h4>
            <p className="text-xs text-[#66736D] mt-0.5">
              Photos uploaded here appear as interactive memory cards in the patient's daily exercises,
              helping preserve emotional connection and spatial familiarity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-white text-[#176B61] text-xs font-black px-3 py-1 rounded-full border border-[#B7D4CC]">
            {people.length} Family Members
          </span>
          <span className="bg-white text-[#176B61] text-xs font-black px-3 py-1 rounded-full border border-[#B7D4CC]">
            {places.length} Places
          </span>
        </div>
      </div>

      {/* ── SECTION TABS (All / Family / Places) ────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#E4DED4] pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#176B61] text-white shadow-xs'
              : 'bg-white text-[#66736D] hover:bg-[#FAF9F4] border border-[#E4DED4]'
          }`}
        >
          All Memories ({people.length + places.length})
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'family'
              ? 'bg-[#176B61] text-white shadow-xs'
              : 'bg-white text-[#66736D] hover:bg-[#FAF9F4] border border-[#E4DED4]'
          }`}
        >
          <Users className="w-4 h-4" /> Family Members ({people.length})
        </button>
        <button
          onClick={() => setActiveTab('places')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'places'
              ? 'bg-[#176B61] text-white shadow-xs'
              : 'bg-white text-[#66736D] hover:bg-[#FAF9F4] border border-[#E4DED4]'
          }`}
        >
          <MapPin className="w-4 h-4" /> Familiar Places ({places.length})
        </button>
      </div>

      {/* ── 1. FAMILY MEMBERS SECTION ──────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'family') && (
        <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E4DED4] pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-extrabold text-[#176B61] bg-[#DDE9D9] px-3 py-0.5 rounded-full border border-[#B7D4CC]">
                Face & Identity Orientation
              </span>
              <h2 className="text-2xl font-extrabold text-[#26332F] mt-1 flex items-center gap-2">
                <Users className="w-6 h-6 text-[#176B61]" /> Family Members & Loved Ones ({people.length})
              </h2>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setShowAddPersonModal(true);
              }}
              className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Family Member
            </button>
          </div>

          {people.length === 0 ? (
            <div className="p-8 bg-[#FAF9F4] border-2 border-dashed border-[#E4DED4] rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white text-[#176B61] mx-auto flex items-center justify-center border border-[#E4DED4]">
                <Users className="w-6 h-6 text-[#176B61]" />
              </div>
              <h3 className="font-extrabold text-[#26332F] text-base">No family members added yet</h3>
              <p className="text-xs text-[#66736D] max-w-md mx-auto">
                Add family members, children, grandchildren, or close caregivers with photos so the
                patient can practice recognizing them in the "Who Is This?" game.
              </p>
              <button
                onClick={() => setShowAddPersonModal(true)}
                className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Family Member
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#FAF9F4] border border-[#E4DED4] rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 group hover:border-[#176B61] transition"
                >
                  <div className="flex items-start gap-3">
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-[#B7D4CC] shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#DDE9D9] text-[#176B61] flex items-center justify-center font-black text-xl border border-[#B7D4CC] shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="overflow-hidden">
                      <h4 className="font-black text-base text-[#26332F] truncate">{p.name}</h4>
                      <span className="inline-block bg-[#DDE9D9] text-[#176B61] text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-[#B7D4CC] mt-0.5">
                        {p.relationship}
                      </span>
                    </div>
                  </div>

                  {p.notes && (
                    <div className="text-xs text-[#66736D] bg-white p-2.5 rounded-xl border border-[#E4DED4] italic">
                      "{p.notes}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#E4DED4] text-xs">
                    <span className="text-[11px] text-[#66736D] font-semibold">Active in Games</span>
                    <button
                      onClick={() => handleDeletePerson(p.id, p.name)}
                      className="p-1.5 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={`Remove ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. FAMILIAR PLACES SECTION ─────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'places') && (
        <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E4DED4] pb-4 flex-wrap gap-2">
            <div>
              <span className="text-xs uppercase font-extrabold text-[#176B61] bg-[#DCEEEF] px-3 py-0.5 rounded-full border border-[#B7D4CC]">
                Spatial & Environmental Orientation
              </span>
              <h2 className="text-2xl font-extrabold text-[#26332F] mt-1 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-[#176B61]" /> Familiar Places & Landmarks ({places.length})
              </h2>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setShowAddPlaceModal(true);
              }}
              className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Familiar Place
            </button>
          </div>

          {places.length === 0 ? (
            <div className="p-8 bg-[#FAF9F4] border-2 border-dashed border-[#E4DED4] rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white text-[#176B61] mx-auto flex items-center justify-center border border-[#E4DED4]">
                <MapPin className="w-6 h-6 text-[#176B61]" />
              </div>
              <h3 className="font-extrabold text-[#26332F] text-base">No familiar places added yet</h3>
              <p className="text-xs text-[#66736D] max-w-md mx-auto">
                Add meaningful locations like the patient's home, temple, local park, or favorite room
                to reinforce environmental recognition and recall.
              </p>
              <button
                onClick={() => setShowAddPlaceModal(true)}
                className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Familiar Place
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {places.map((pl) => (
                <div
                  key={pl.id}
                  className="bg-[#FAF9F4] border border-[#E4DED4] rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 group hover:border-[#176B61] transition"
                >
                  <div>
                    {pl.photoUrl ? (
                      <img
                        src={pl.photoUrl}
                        alt={pl.name}
                        className="w-full h-32 rounded-xl object-cover border border-[#B7D4CC] shadow-xs mb-3"
                      />
                    ) : (
                      <div className="w-full h-32 rounded-xl bg-[#DCEEEF] text-[#176B61] flex flex-col items-center justify-center border border-[#B7D4CC] mb-3">
                        <MapPin className="w-8 h-8 mb-1 text-[#176B61]" />
                        <span className="text-[11px] font-bold">No Photo Uploaded</span>
                      </div>
                    )}

                    <h4 className="font-black text-base text-[#26332F]">{pl.name}</h4>
                    <p className="text-xs text-[#66736D] mt-1 line-clamp-3 leading-relaxed">
                      {pl.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E4DED4] text-xs">
                    <span className="text-[11px] text-[#66736D] font-semibold">Active in Games</span>
                    <button
                      onClick={() => handleDeletePlace(pl.id, pl.name)}
                      className="p-1.5 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={`Remove ${pl.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL 1: ADD FAMILY MEMBER ─────────────────────────── */}
      {showAddPersonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E4DED4] space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#DDE9D9] text-[#176B61] flex items-center justify-center border border-[#B7D4CC]">
                  <Users className="w-5 h-5 text-[#176B61]" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#26332F]">Add New Family Member</h3>
                  <p className="text-xs text-[#66736D]">Personalize "Who Is This?" memory exercises</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPersonModal(false)}
                className="text-[#66736D] hover:text-[#26332F] font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPersonSubmit} className="space-y-4">
              {/* Photo Upload & Preview */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1.5">
                  Member Photo (Recommended for face-recognition game)
                </label>
                <div className="flex items-center gap-4">
                  {personPhoto ? (
                    <img
                      src={personPhoto}
                      alt="Preview"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-[#176B61] shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[#FAF9F4] border-2 border-dashed border-[#DDD9D0] flex flex-col items-center justify-center text-[#66736D] shrink-0">
                      <User className="w-6 h-6 text-[#66736D]" />
                      <span className="text-[9px] font-bold mt-0.5">No photo</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={personFileInputRef}
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, setPersonPhoto)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => personFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-[#FAF9F4] hover:bg-[#E4DED4]/60 border border-[#E4DED4] text-[#26332F] font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#176B61]" />
                      {personPhoto ? 'Change Photo' : 'Upload Face Photo'}
                    </button>
                    {personPhoto && (
                      <button
                        type="button"
                        onClick={() => setPersonPhoto(null)}
                        className="text-[11px] text-rose-600 font-bold hover:underline block"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF9F4] border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:border-[#176B61] outline-none"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1.5">
                  Relationship to Patient <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_RELATIONSHIPS.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => setPersonRelationship(rel)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        personRelationship === rel
                          ? 'bg-[#176B61] text-white shadow-xs'
                          : 'bg-[#FAF9F4] text-[#66736D] hover:bg-[#E4DED4]/60 border border-[#E4DED4]'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPersonRelationship('Other')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      personRelationship === 'Other'
                        ? 'bg-[#176B61] text-white shadow-xs'
                        : 'bg-[#FAF9F4] text-[#66736D] hover:bg-[#E4DED4]/60 border border-[#E4DED4]'
                    }`}
                  >
                    Other...
                  </button>
                </div>

                {personRelationship === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify relationship (e.g. Nephew, Neighbor)"
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    className="w-full px-4 py-2 bg-[#FAF9F4] border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:border-[#176B61] outline-none"
                  />
                )}
              </div>

              {/* Memory Clue / Notes */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">
                  Memory Hint / Care Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Calls every Sunday evening; loves playing chess"
                  value={personNotes}
                  onChange={(e) => setPersonNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF9F4] border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:border-[#176B61] outline-none"
                />
                <span className="text-[11px] text-[#66736D] mt-1 block">
                  This clue will be used by the Memory Assistant to help prompt the patient gently.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E4DED4]">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-4 py-2 text-[#66736D] hover:bg-[#FAF9F4] font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save Family Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD FAMILIAR PLACE ────────────────────────── */}
      {showAddPlaceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E4DED4] space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#DCEEEF] text-[#176B61] flex items-center justify-center border border-[#B7D4CC]">
                  <MapPin className="w-5 h-5 text-[#176B61]" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#26332F]">Add Familiar Place</h3>
                  <p className="text-xs text-[#66736D]">Reinforce environmental and spatial orientation</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPlaceModal(false)}
                className="text-[#66736D] hover:text-[#26332F] font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPlaceSubmit} className="space-y-4">
              {/* Photo Upload & Preview */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1.5">
                  Place Photo (Displayed in the "Familiar Places" recognition game)
                </label>
                <div className="flex items-center gap-4">
                  {placePhoto ? (
                    <img
                      src={placePhoto}
                      alt="Preview"
                      className="w-20 h-16 rounded-2xl object-cover border-2 border-[#176B61] shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-16 rounded-2xl bg-[#FAF9F4] border-2 border-dashed border-[#DDD9D0] flex flex-col items-center justify-center text-[#66736D] shrink-0">
                      <ImageIcon className="w-6 h-6 text-[#66736D]" />
                      <span className="text-[9px] font-bold mt-0.5">No photo</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={placeFileInputRef}
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, setPlacePhoto)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => placeFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-[#FAF9F4] hover:bg-[#E4DED4]/60 border border-[#E4DED4] text-[#26332F] font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#176B61]" />
                      {placePhoto ? 'Change Photo' : 'Upload Location Photo'}
                    </button>
                    {placePhoto && (
                      <button
                        type="button"
                        onClick={() => setPlacePhoto(null)}
                        className="text-[11px] text-rose-600 font-bold hover:underline block"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Place Suggestions */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">
                  Common Place Suggestions
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_PLACE_TYPES.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setPlaceName(suggestion)}
                      className="px-2.5 py-1 bg-[#FAF9F4] hover:bg-[#E4DED4]/60 text-[#26332F] border border-[#E4DED4] rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Place Name */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">
                  Place Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Living Room, Central Park, Ancestral Home"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF9F4] border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:border-[#176B61] outline-none"
                />
              </div>

              {/* Description & Significance */}
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">
                  Description / Memory Significance
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Where the family gathers for morning tea and reads the newspaper."
                  value={placeDescription}
                  onChange={(e) => setPlaceDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-[#FAF9F4] border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:border-[#176B61] outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E4DED4]">
                <button
                  type="button"
                  onClick={() => setShowAddPlaceModal(false)}
                  className="px-4 py-2 text-[#66736D] hover:bg-[#FAF9F4] font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save Familiar Place
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
