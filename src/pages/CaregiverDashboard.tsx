import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { AIEngineService } from '../services/ai';
import { RecommendationEngineService } from '../services/recommendationEngine';
import { GamificationService } from '../services/gamification';
import { AlertEngineService, playEmergencyAlarmSound } from '../services/alertEngine';
import { OfflineStorage } from '../offline/offlineStorage';
import { ProgressChart } from '../components/ProgressChart';
import { subscribeToSync } from '../services/realtime';
import { useI18n } from '../i18n';
import {
  Brain,
  QrCode,
  Globe,
  Languages,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  Target,
  Clock,
  PhoneCall,
  AlertTriangle,
  Siren,
  ShieldCheck,
  Check,
  XCircle,
  Database,
  Users,
  UserPlus,
  ExternalLink,
  Crown,
  Mail,
  User,
  Trash2,
  Heart,
  MapPin,
  Edit3,
} from 'lucide-react';
import { DatabaseViewerModal } from '../components/DatabaseViewerModal';
import { CognitiveActivityProfile, GameSession, GamificationProfile, PatientProfile, SOSAlert, CaregiverPatientRelation } from '../types';
import { CareTeamService } from '../services/careTeamService';
import { useAuth } from '../context/AuthContext';

interface CaregiverDashboardProps {
  onNavigate: (page: string) => void;
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { language, setLanguage, state, setStateAndSuggestLanguage, bilingualMode, toggleBilingualMode, languageProfile, t } = useI18n();

  const [patient, setPatient] = useState<PatientProfile>(() => StorageService.getPatientProfile(undefined, user?.id));
  const [sessions, setSessions] = useState<GameSession[]>(() => {
    const p = StorageService.getPatientProfile(undefined, user?.id);
    return StorageService.getGameSessions(p?.id);
  });
  const [gamification, setGamification] = useState<GamificationProfile>(GamificationService.getProfile());
  const [recommendation, setRecommendation] = useState(() => RecommendationEngineService.getRecommendations(sessions));
  const [profile, setProfile] = useState<CognitiveActivityProfile>(() => {
    return AIEngineService.computeActivityProfile(sessions);
  });

  const [alertsList, setAlertsList] = useState<SOSAlert[]>(() => AlertEngineService.getAllAlerts());
  const [showDbViewer, setShowDbViewer] = useState<boolean>(false);
  const [careTeam, setCareTeam] = useState<CaregiverPatientRelation[]>(() => CareTeamService.getCareTeam(patient?.id || 'pat-demo-1'));
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRel, setInviteRel] = useState<string>('Family Member');
  const [inviting, setInviting] = useState<boolean>(false);
  const [peopleCount, setPeopleCount] = useState<number>(() => StorageService.getFamiliarPeople(patient?.id).length);
  const [placesCount, setPlacesCount] = useState<number>(() => StorageService.getFamiliarPlaces(patient?.id).length);
  const playedSOSAlertIdsRef = useRef<Set<string>>(new Set());

  const elderly = StorageService.getElderlyProfile(patient?.id);
  const routines = StorageService.getRoutine();

  const refreshData = async (targetPatientId?: string) => {
    const pid = targetPatientId || patient?.id;
    const p = StorageService.getPatientProfile(pid, user?.id);
    setPatient(p);

    // Fetch real game sessions and scores directly from Supabase
    const s = await StorageService.fetchGameSessionsFromCloud(p?.id || pid);
    setSessions(s);
    setProfile(AIEngineService.computeActivityProfile(s));
    setGamification(GamificationService.getProfile());
    setRecommendation(RecommendationEngineService.getRecommendations(s));

    // Update people & places count
    setPeopleCount(StorageService.getFamiliarPeople(p?.id || pid).length);
    setPlacesCount(StorageService.getFamiliarPlaces(p?.id || pid).length);
    StorageService.fetchFamiliarPeopleFromCloud(p?.id || pid).then(list => setPeopleCount((list || []).length));
    StorageService.fetchFamiliarPlacesFromCloud(p?.id || pid).then(list => setPlacesCount((list || []).length));

    AlertEngineService.fetchAlertsFromCloud().then(list => setAlertsList(list));
    if (p?.id) {
      CareTeamService.fetchCareTeamFromCloud(p.id).then((team) => {
        setCareTeam(team);
      });
    }
  };

  const handleInviteCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await CareTeamService.inviteCaregiver(
        patient.id || 'pat-demo-1',
        inviteName.trim(),
        inviteEmail.trim(),
        inviteRel
      );
      if (patient.id) {
        const team = await CareTeamService.fetchCareTeamFromCloud(patient.id);
        setCareTeam(team);
      }
      setInviteName('');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (e) {
      console.warn('Invite failed', e);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCaregiver = async (memberId: string) => {
    if (!patient?.id) return;
    const updated = await CareTeamService.removeCaregiver(patient.id, memberId);
    setCareTeam(updated);
  };

  const playSOSAlarmSound = (times = 3) => {
    playEmergencyAlarmSound(times, 5);
  };

  useEffect(() => {
    // Proactively unlock AudioContext on first user interaction
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const dummy = new AudioCtx();
          if (dummy.state === 'suspended') {
            dummy.resume().catch(() => {});
          }
        }
      } catch {}
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const initDashboard = async () => {
      // 1. Only mark alerts as already played if they are resolved or older than 60s
      // Fresh active SOS alerts (< 60s) will sound the alarm for the caregiver
      const initialAlerts = AlertEngineService.getAllAlerts();
      const now = Date.now();
      initialAlerts.forEach(a => {
        if (a.status !== 'active' || (now - a.timestamp) > 60000) {
          playedSOSAlertIdsRef.current.add(a.id);
        }
      });

      // 2. Sync patients list from Supabase cloud
      await StorageService.syncPatientsFromCloud();

      // 3. Fetch assigned patient for current caregiver if logged in
      let targetPid = patient?.id;
      if (user?.id) {
        try {
          const cloudPid = await CareTeamService.fetchCaregiverPatientFromCloud(user.id);
          if (cloudPid) {
            targetPid = cloudPid;
            const p = StorageService.getPatientProfile(cloudPid, user.id);
            setPatient(p);
            const team = await CareTeamService.fetchCareTeamFromCloud(p.id);
            setCareTeam(team);
          }
        } catch {}
      }

      // 4. Load real game sessions and scores directly from Supabase
      await refreshData(targetPid);
      const cloudAlerts = await AlertEngineService.fetchAlertsFromCloud();
      setAlertsList(cloudAlerts);
    };

    initDashboard();

    // Fast polling interval (every 3s) to guarantee instant mobile-to-laptop SOS alert detection & fresh metrics
    const pollInterval = setInterval(async () => {
      const latest = await AlertEngineService.fetchAlertsFromCloud();
      setAlertsList(latest);

      // Play audio alarm exactly 3 times only when a new active SOS arrives
      const activeSOSItem = latest.find(a => a.level === 'sos' && a.status === 'active');
      if (activeSOSItem && !playedSOSAlertIdsRef.current.has(activeSOSItem.id)) {
        playedSOSAlertIdsRef.current.add(activeSOSItem.id);
        playSOSAlarmSound(3);
      }
    }, 3000);

    // Subscribe to BroadcastChannel & WebSocket cross-device sync for instant real-time alerts & game scores
    const unsubscribe = subscribeToSync(async (payload) => {
      await refreshData();
      const latest = await AlertEngineService.fetchAlertsFromCloud();
      setAlertsList(latest);

      // Play audio alarm on caregiver dashboard when a new active SOS arrives
      // Plays exactly 3 times, and will not repeat for the same alert ID
      const activeSOSItem = latest.find(a => a.level === 'sos' && a.status === 'active');
      if (activeSOSItem && !playedSOSAlertIdsRef.current.has(activeSOSItem.id)) {
        playedSOSAlertIdsRef.current.add(activeSOSItem.id);
        playSOSAlarmSound(3);
      }
    });

    return () => {
      clearInterval(pollInterval);
      unsubscribe();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [user?.id]);

  const handleUpdateStatus = async (alertId: string, newStatus: 'acknowledged' | 'resolved') => {
    AlertEngineService.updateAlertStatus(alertId, newStatus);
    await OfflineStorage.updateAlertStatus(alertId, newStatus);
    const updated = await AlertEngineService.fetchAlertsFromCloud();
    setAlertsList(updated);
  };

  // Find most relevant active/unresolved SOS alert and Caution alert
  const activeSOS = alertsList.find(a => a.level === 'sos' && a.status !== 'resolved');
  const activeCaution = alertsList.find(a => a.level === 'caution' && a.status !== 'resolved');

  const emergencyPhone = patient.emergencyContact?.primaryContactPhone || elderly.emergencyContact || '+91 98765 43210';

  const caregiverPatientIds = user?.id ? CareTeamService.getPatientsForCaregiver(user.id) : [];
  const allPatients = StorageService.getAllPatientProfiles();
  const availablePatients = allPatients.filter(p => caregiverPatientIds.includes(p.id) || p.id === patient.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#26332F]">

      {/* ── 1. PROMINENT SOS ALERT BANNER (TOP OF DASHBOARD) ─────── */}
      {activeSOS && (
        <div className="bg-[#D9A7A8] text-[#26332F] rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-[#A56F72] space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#26332F]/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/40 text-[#26332F] flex items-center justify-center border-2 border-[#26332F]/30 shrink-0">
                <Siren className="w-8 h-8 animate-bounce text-[#26332F]" />
              </div>
              <div>
                <span className="bg-white text-[#26332F] text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-xs border border-[#E4DED4]">
                  🚨 {activeSOS.source === 'manual' ? 'MANUAL SOS' : 'ACCURACY SOS'} ALERT
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-[#26332F]">
                  PATIENT SOS EMERGENCY ALERT
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`tel:${emergencyPhone}`}
                className="px-5 py-3 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-2xl shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-white" /> CONTACT NOW ({emergencyPhone})
              </a>

              {activeSOS.status === 'active' && (
                <button
                  onClick={() => handleUpdateStatus(activeSOS.id, 'acknowledged')}
                  className="px-4 py-3 bg-[#DCEEEF] hover:bg-[#cbe6e8] text-[#176B61] font-extrabold text-xs rounded-2xl transition flex items-center gap-1.5 border border-[#B7D4CC] cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#176B61]" /> ACKNOWLEDGE
                </button>
              )}

              <button
                onClick={() => handleUpdateStatus(activeSOS.id, 'resolved')}
                className="px-4 py-3 bg-[#DDE9D9] hover:bg-[#cde0c9] text-[#176B61] font-extrabold text-xs rounded-2xl transition flex items-center gap-1.5 shadow-xs border border-[#BFCFC5] cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#176B61]" /> RESOLVE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
            <div className="bg-white/60 p-3.5 rounded-2xl border border-white/80 space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase block">Patient Name</span>
              <span className="text-lg font-extrabold text-[#26332F]">{activeSOS.patientName}</span>
            </div>

            <div className="bg-white/60 p-3.5 rounded-2xl border border-white/80 space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase block">Recent Rolling Accuracy</span>
              <span className="text-lg font-extrabold text-[#26332F]">
                {activeSOS.accuracy !== null ? `${activeSOS.accuracy}% (Below 30% Threshold)` : 'Manual SOS Triggered'}
              </span>
            </div>

            <div className="bg-white/60 p-3.5 rounded-2xl border border-white/80 space-y-1">
              <span className="text-[#66736D] text-[10px] uppercase block">Triggered Time & Status</span>
              <span className="text-xs font-extrabold text-[#26332F] block">
                {new Date(activeSOS.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="inline-block bg-[#FAF9F4] px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider text-[#26332F] border border-[#E4DED4]">
                Status: {activeSOS.status}
              </span>
            </div>
          </div>

          <div className="bg-white/60 p-3.5 rounded-2xl border border-white/80 text-xs font-semibold leading-relaxed text-[#26332F]">
            {activeSOS.source === 'manual'
              ? `🚨 ${activeSOS.patientName} has pressed the manual emergency help button from the patient interface.`
              : `🚨 The patient's recent cognitive-game accuracy (${activeSOS.accuracy}%) has fallen below the critical threshold (30%). Please check in immediately.`}
          </div>
        </div>
      )}

      {/* ── 2. CAUTION ALERT BANNER ────────────────── */}
      {activeCaution && !activeSOS && (
        <div className="bg-[#F4E4C8] text-[#26332F] rounded-3xl p-6 shadow-sm border border-[#E4DED4] space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E4DED4] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white text-[#176B61] flex items-center justify-center border border-[#E4DED4] shrink-0 font-extrabold">
                <AlertTriangle className="w-6 h-6 text-[#176B61]" />
              </div>
              <div>
                <span className="bg-[#176B61] text-white text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full">
                  ⚠️ ACCURACY CAUTION ALERT
                </span>
                <h3 className="text-xl font-black text-[#26332F] mt-0.5">
                  Patient Accuracy Below 50%
                </h3>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`tel:${emergencyPhone}`}
                className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call ({emergencyPhone})
              </a>
              <button
                onClick={() => handleUpdateStatus(activeCaution.id, 'resolved')}
                className="px-4 py-2 bg-white hover:bg-[#FAF9F4] text-[#26332F] font-bold text-xs rounded-xl border border-[#E4DED4] transition"
              >
                Dismiss Alert
              </button>
            </div>
          </div>

          <div className="text-xs font-semibold text-[#26332F] flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Patient:</strong> {activeCaution.patientName} &nbsp;|&nbsp; <strong>Recent accuracy:</strong> {activeCaution.accuracy}% &nbsp;|&nbsp; <em>"Patient's recent accuracy has dropped below 50% — may want to check in."</em>
            </div>
            <div className="text-[11px] font-mono text-[#66736D]">
              Triggered: {new Date(activeCaution.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        </div>
      )}

      {/* Top Caregiver Header */}
      <div className="bg-[#FAF9F4] text-[#26332F] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-[#E4DED4]">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-[#DDE9D9] text-[#176B61] text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border border-[#BFCFC5]">
              {t('caregiver.portal')}
            </span>
            {availablePatients.length > 1 ? (
              <select
                value={patient.id}
                onChange={async (e) => {
                  const selected = StorageService.getPatientProfile(e.target.value, user?.id);
                  setPatient(selected);
                  StorageService.setActivePatientId(selected.id, user?.id);
                  setCareTeam(CareTeamService.getCareTeam(selected.id));
                  await refreshData(selected.id);
                }}
                className="bg-white border border-[#E4DED4] text-[#26332F] text-xs font-bold rounded-full px-3 py-1 outline-none cursor-pointer"
              >
                {availablePatients.map(p => (
                  <option key={p.id} value={p.id} className="bg-white text-[#26332F]">
                    Patient: {p.basicInfo.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="bg-[#DDE9D9] text-[#176B61] text-xs font-bold px-3 py-1 rounded-full border border-[#BFCFC5] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#176B61] animate-ping"></span> {t('status.synced')}: {patient.basicInfo.name}
              </span>
            )}
            <span className="bg-[#F4EBD7] text-[#26332F] text-xs font-bold px-3 py-1 rounded-full border border-[#E4DED4] flex items-center gap-1">
              {languageProfile.flag} {languageProfile.nativeName} ({state})
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#26332F]">{t('caregiver.title')}</h1>
          <p className="text-sm text-[#66736D] mt-1">
            {t('caregiver.subtitle')} <strong>{patient.basicInfo.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
            title="Preview elderly patient UI without logging out"
          >
            <ExternalLink className="w-4 h-4 text-white" /> Preview Patient View
          </button>
          <button
            onClick={() => setShowDbViewer(true)}
            className="px-4 py-2.5 bg-[#DCEEEF] hover:bg-[#cce5e7] text-[#176B61] font-extrabold text-sm rounded-xl transition flex items-center gap-2 border border-[#B7D4CC] shadow-xs cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#176B61]" /> View Backend Tables
          </button>
          <button
            onClick={() => onNavigate('connect')}
            className="px-4 py-2.5 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] border border-[#E4DED4] font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#176B61]" /> {t('caregiver.pairDevice')}
          </button>
        </div>
      </div>

      {/* ── PATIENT CARE PROFILE ───────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
          <div>
            <span className="text-xs uppercase font-extrabold text-[#176B61] bg-[#DDE9D9] px-3 py-0.5 rounded-full border border-[#B7D4CC]">
              {t('caregiver.patient')} Profile
            </span>
            <h2 className="text-2xl font-extrabold text-[#26332F] mt-1">{patient.basicInfo.name}</h2>
            <p className="text-xs text-[#66736D] font-semibold">
              {t('setup.age')}: {patient.basicInfo.age} | {t('caregiver.patientState')}: {patient.basicInfo.state} | {t('caregiver.primaryLanguage')}: {languageProfile.nativeName}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigate('settings')}
              className="px-3.5 py-2 bg-[#FAF9F4] hover:bg-[#F4EBD7] text-[#176B61] border border-[#B7D4CC] font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Edit elderly patient profile in Settings"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button
              onClick={() => onNavigate('medical-history')}
              className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1 shadow-sm cursor-pointer"
            >
              View Medical History Detail <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Medical & Care History Summary */}
          <div className="bg-white p-5 rounded-2xl border border-[#E4DED4] shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold text-[#26332F] flex items-center gap-2 border-b border-[#E4DED4] pb-2 uppercase">
              <Stethoscope className="w-4 h-4 text-[#176B61]" /> MEDICAL & CARE HISTORY
            </h3>
            <ul className="space-y-1.5 text-xs font-semibold text-[#26332F]">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#176B61]"></span>
                <span>Conditions Recorded: <strong>{patient.medicalHistory.conditions.length}</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#7FAFA5]"></span>
                <span>Medication References: <strong>{patient.medications.length}</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#CD9C8A]"></span>
                <span>Allergies: <strong>{(patient.medicalHistory.allergies || ['Penicillin']).join(', ')}</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#A2A1CD]"></span>
                <span>Care Observations: <strong>{patient.caregiverObservations.length} items</strong></span>
              </li>
            </ul>
            <div className="pt-2 text-[11px] text-[#66736D] font-medium border-t border-[#E4DED4]">
              🔒 Strictly non-diagnostic reference for care contextualization.
            </div>
          </div>

          {/* Cognitive Activity Profile (Separated clearly from medical diagnosis) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E4DED4] shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold text-[#26332F] flex items-center gap-2 border-b border-[#E4DED4] pb-2 uppercase">
              <Brain className="w-4 h-4 text-[#176B61]" /> {t('caregiver.performance')}
            </h3>
            <div className="space-y-2 text-xs font-bold">
              <div>
                <div className="flex justify-between text-[#26332F] mb-1">
                  <span>{t('cat.memory')}</span>
                  <span>{recommendation.categoryScores.memory}%</span>
                </div>
                <div className="h-2 bg-[#E5E1D8] rounded-full overflow-hidden border border-[#DDD9D0]">
                  <div className="h-full bg-[#176B61] rounded-full" style={{ width: `${recommendation.categoryScores.memory}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#26332F] mb-1">
                  <span>{t('cat.attention')}</span>
                  <span>{recommendation.categoryScores.attention}%</span>
                </div>
                <div className="h-2 bg-[#E5E1D8] rounded-full overflow-hidden border border-[#DDD9D0]">
                  <div className="h-full bg-[#7FAFA5] rounded-full" style={{ width: `${recommendation.categoryScores.attention}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#26332F] mb-1">
                  <span>{t('cat.recognition')}</span>
                  <span>{recommendation.categoryScores.recognition}%</span>
                </div>
                <div className="h-2 bg-[#E5E1D8] rounded-full overflow-hidden border border-[#DDD9D0]">
                  <div className="h-full bg-[#A2A1CD] rounded-full" style={{ width: `${recommendation.categoryScores.recognition}%` }}></div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="mt-2 text-xs text-[#176B61] font-extrabold hover:underline block"
            >
              [{t('btn.viewAll')} {t('nav.history')}]
            </button>
          </div>
        </div>
      </div>

      {/* ── FAMILY & FAMILIAR PLACES OVERVIEW CARD ───────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DED4] pb-3">
          <div>
            <span className="text-xs uppercase font-extrabold text-[#176B61] bg-[#DDE9D9] px-3 py-0.5 rounded-full border border-[#B7D4CC]">
              Memory & Recognition
            </span>
            <h3 className="text-xl font-extrabold text-[#26332F] mt-1 flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#176B61]" /> Family Members & Familiar Places
            </h3>
            <p className="text-xs text-[#66736D] font-medium">
              Manage loved ones and important places that power the "Who Is This?" face game, "Familiar Places" game, and Memory Assistant for <strong>{patient.basicInfo.name}</strong>.
            </p>
          </div>

          <button
            onClick={() => onNavigate('family-places')}
            className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            Manage Family & Places <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate('family-places')}
            className="p-4 bg-[#FAF9F4] hover:bg-[#F4EBD7]/60 border border-[#E4DED4] rounded-2xl cursor-pointer transition flex items-center justify-between group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#DDE9D9] text-[#176B61] flex items-center justify-center border border-[#B7D4CC]">
                <Users className="w-6 h-6 text-[#176B61]" />
              </div>
              <div>
                <span className="text-xs text-[#66736D] font-bold block">Family Members Configured</span>
                <span className="text-2xl font-black text-[#26332F]">{peopleCount}</span>
              </div>
            </div>
            <span className="text-xs text-[#176B61] font-bold group-hover:underline flex items-center gap-0.5">
              + Add / View <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div
            onClick={() => onNavigate('family-places')}
            className="p-4 bg-[#FAF9F4] hover:bg-[#F4EBD7]/60 border border-[#E4DED4] rounded-2xl cursor-pointer transition flex items-center justify-between group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#DCEEEF] text-[#176B61] flex items-center justify-center border border-[#B7D4CC]">
                <MapPin className="w-6 h-6 text-[#176B61]" />
              </div>
              <div>
                <span className="text-xs text-[#66736D] font-bold block">Familiar Places Configured</span>
                <span className="text-2xl font-black text-[#26332F]">{placesCount}</span>
              </div>
            </div>
            <span className="text-xs text-[#176B61] font-bold group-hover:underline flex items-center gap-0.5">
              + Add / View <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* ── CARE TEAM COLLABORATION ──────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3 flex-wrap gap-2">
          <div>
            <span className="text-xs uppercase font-extrabold text-[#176B61] bg-[#DDE9D9] px-3 py-0.5 rounded-full border border-[#B7D4CC]">
              Care Team Management
            </span>
            <h3 className="text-xl font-extrabold text-[#26332F] mt-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#176B61]" /> Patient Care Team ({careTeam.length})
            </h3>
            <p className="text-xs text-[#66736D] font-medium">
              Multi-caregiver collaboration: Primary caregiver has administrative authority. Other caregivers assist with daily check-ins.
            </p>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Invite Caregiver
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {careTeam.map((member) => (
            <div
              key={member.id}
              className={`p-4 rounded-2xl border transition ${
                member.isPrimary
                  ? 'bg-[#FAF9F4] border-[#176B61]/40 shadow-xs'
                  : 'bg-white border-[#E4DED4]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                      member.isPrimary
                        ? 'bg-[#DDE9D9] text-[#176B61] border border-[#B7D4CC]'
                        : 'bg-[#DCEEEF] text-[#176B61] border border-[#B7D4CC]'
                    }`}
                  >
                    {member.caregiverName?.slice(0, 2).toUpperCase() || 'CG'}
                  </div>
                  <div>
                    <div className="font-extrabold text-[#26332F] text-sm flex items-center gap-1.5">
                      <span>{member.caregiverName}</span>
                      {member.isPrimary && (
                        <span className="bg-[#DDE9D9] text-[#176B61] text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-[#B7D4CC] flex items-center gap-1">
                          <Crown className="w-3 h-3 text-[#176B61]" /> Primary
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#66736D] font-medium">{member.relationship}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      member.status === 'active'
                        ? 'bg-[#DDE9D9] text-[#176B61] border border-[#B7D4CC]'
                        : 'bg-[#F4EBD7] text-[#26332F] border border-[#E4DED4]'
                    }`}
                  >
                    {member.status}
                  </span>
                  {!member.isPrimary && (
                    <button
                      onClick={() => handleRemoveCaregiver(member.id)}
                      className="p-1 text-[#66736D] hover:text-[#D9A7A8] hover:bg-[#EFD4D3]/50 rounded-lg transition"
                      title="Remove caregiver"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {member.caregiverEmail && (
                <div className="mt-3 pt-2.5 border-t border-[#E4DED4] text-xs text-[#66736D] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#66736D]" />
                  <span className="truncate">{member.caregiverEmail}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI CARE INSIGHTS ───────────────────────────────────────── */}
      <div className="bg-[#F4EBD7] border border-[#E4DED4] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-extrabold tracking-wider text-white bg-[#176B61] px-3 py-1 rounded-full">
            🤖 {t('caregiver.recommendation')}
          </span>
          <span className="text-[11px] text-[#26332F] font-bold">{t('caregiver.nonClinicalNote')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs space-y-1">
            <span className="font-extrabold text-[#26332F] flex items-center gap-1.5 text-sm">
              <Brain className="w-4 h-4 text-[#176B61]" /> Activity Insight
            </span>
            <p className="text-[#66736D] font-medium leading-relaxed">
              Performance in Memory Match exercises has remained consistent over recent sessions, showing steady visual focus.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs space-y-1">
            <span className="font-extrabold text-[#26332F] flex items-center gap-1.5 text-sm">
              <Target className="w-4 h-4 text-[#176B61]" /> {t('caregiver.recommendation')}
            </span>
            <p className="text-[#66736D] font-medium leading-relaxed">
              {recommendation.recommendationReason}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs space-y-1">
            <span className="font-extrabold text-[#26332F] flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-[#176B61]" /> Routine Insight
            </span>
            <p className="text-[#66736D] font-medium leading-relaxed">
              Daily morning routine is active with {routines.length} scheduled caregiver check points.
            </p>
          </div>
        </div>
      </div>

      {/* Multilingual & Regional Voice Control Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
          <h3 className="text-lg font-extrabold text-[#26332F] flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#176B61]" /> {t('caregiver.regionalControl')}
          </h3>
          <span className="text-xs font-bold text-[#176B61] bg-[#DDE9D9] px-3 py-1 rounded-full border border-[#B7D4CC]">
            {t('caregiver.statesSupported')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
          {/* Patient State */}
          <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
            <span className="text-[#66736D] uppercase block text-[10px]">{t('caregiver.patientState')}</span>
            <select
              value={state}
              onChange={(e) => setStateAndSuggestLanguage(e.target.value)}
              className="w-full bg-white border border-[#DDD9D0] p-2 rounded-xl text-xs font-extrabold text-[#26332F] outline-none cursor-pointer focus:border-[#176B61] focus:ring-2 focus:ring-[#B7D4CC]"
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

          {/* Primary Language */}
          <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] space-y-1">
            <span className="text-[#66736D] uppercase block text-[10px]">{t('caregiver.primaryLanguage')}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-white border border-[#DDD9D0] p-2 rounded-xl text-xs font-extrabold text-[#26332F] outline-none cursor-pointer focus:border-[#176B61] focus:ring-2 focus:ring-[#B7D4CC]"
            >
              <option value="en">🇺🇸 English</option>
              <option value="as">🇮🇳 Assamese (অসমীয়া)</option>
              <option value="bn">🇮🇳 Bengali (বাংলা)</option>
              <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            </select>
          </div>

          {/* Voice Assistant Status */}
          <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] flex flex-col justify-between">
            <div>
              <span className="text-[#66736D] uppercase block text-[10px]">{t('caregiver.voiceAssistant')}</span>
              <div className="text-[#26332F] font-extrabold flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4 text-[#176B61]" /> {t('caregiver.voiceEnabled')} ({languageProfile.nativeName})
              </div>
            </div>
            <span className="text-[10px] text-[#66736D] font-normal">Speech Recognition & Synth Active</span>
          </div>

          {/* Bilingual Mode Toggle */}
          <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] flex flex-col justify-between">
            <div>
              <span className="text-[#66736D] uppercase block text-[10px]">{t('caregiver.bilingualSubtitle')}</span>
              <button
                onClick={toggleBilingualMode}
                className={`mt-1 w-full py-2 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  bilingualMode
                    ? 'bg-[#176B61] text-white shadow-sm'
                    : 'bg-white border border-[#DDD9D0] text-[#26332F] hover:bg-[#F4EBD7]'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                {bilingualMode ? 'Bilingual Mode ON' : 'Bilingual OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Progress Chart */}
      <ProgressChart sessions={sessions} categoryScores={profile.categoryScores} />

      {/* Invite Caregiver Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-[#26332F]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#E4DED4] space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#DDE9D9] text-[#176B61] flex items-center justify-center border border-[#B7D4CC]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#26332F] text-lg">Invite Caregiver</h3>
                  <p className="text-xs text-[#66736D]">Collaborate with family members or nurse</p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#66736D] hover:text-[#26332F] p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteCaregiver} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">Caregiver Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#66736D] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                    placeholder="Dr. Rajesh / Sunita"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#66736D] absolute left-3 top-3" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                    placeholder="caregiver@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">Relationship to Patient</label>
                <select
                  value={inviteRel}
                  onChange={(e) => setInviteRel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold text-[#26332F] outline-none cursor-pointer"
                >
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Grandchild">Grandchild</option>
                  <option value="Professional Nurse">Professional Nurse</option>
                  <option value="Family Doctor">Family Doctor</option>
                  <option value="Other Relative">Other Relative</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Database Viewer Modal */}
      <DatabaseViewerModal
        isOpen={showDbViewer}
        onClose={() => setShowDbViewer(false)}
      />
    </div>
  );
};
