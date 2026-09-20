import React, { useState, useEffect } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { StorageService } from '../services/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PatientService } from '../services/patientService';
import { Settings, Eye, EyeOff, Type, Volume2, ShieldCheck, LogOut, User, KeyRound, Copy, CheckCircle2, Heart, Edit3, Save, X, UserCheck } from 'lucide-react';
import { ElderlyPatientProfileEditor } from '../components/ElderlyPatientProfileEditor';

export const SettingsPage: React.FC = () => {
  const { settings, setTextSize, toggleHighContrast, toggleVoiceGuidance } = useAccessibility();
  const { user, role, logout } = useAuth();
  const [patientProfile, setPatientProfile] = useState(() => StorageService.getPatientProfile(undefined, user?.id));
  const profile = StorageService.getElderlyProfile(patientProfile.id);

  const [showPatientPassword, setShowPatientPassword] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editLoginId, setEditLoginId] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [lastSavedPass, setLastSavedPass] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync latest patient credentials from Supabase on mount
  useEffect(() => {
    const fetchLatestCreds = async () => {
      try {
        await StorageService.syncPatientsFromCloud();
        const current = StorageService.getPatientProfile(undefined, user?.id);
        setPatientProfile(current);

        if (isSupabaseConfigured() && current.id && current.id !== 'pat-demo-1') {
          const { data } = await supabase
            .from('patients')
            .select('full_name, medical_history')
            .eq('id', current.id)
            .maybeSingle();

          if (data?.medical_history) {
            let med: any = typeof data.medical_history === 'string' ? JSON.parse(data.medical_history) : data.medical_history;
            if (med?.patientCredentials) {
              const updated = {
                ...current,
                patientCredentials: med.patientCredentials,
              };
              setPatientProfile(updated);
              StorageService.savePatientProfile(updated, user?.id);
            }
          }
        }
      } catch (e) {
        console.warn('Sync credentials notice:', e);
      }
    };
    fetchLatestCreds();
  }, [user?.id]);

  const patientLoginId = patientProfile.patientCredentials?.loginId || patientProfile.basicInfo?.name || (patientProfile.id === 'pat-demo-1' ? 'meena.sharma' : 'Patient');
  const patientPassword = patientProfile.patientCredentials?.password || (patientProfile.id === 'pat-demo-1' ? 'patient123' : '');

  const handleStartEdit = () => {
    setEditLoginId(patientLoginId);
    setEditPassword(patientPassword);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLoginId.trim() || !editPassword.trim()) {
      setSaveError('Both Login ID and Password are required.');
      return;
    }
    if (editPassword.trim().length < 6) {
      setSaveError('Password must be at least 6 characters long.');
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    try {
      const cleanLogin = editLoginId.trim();
      const cleanPass = editPassword.trim();

      const result = await PatientService.updatePatientCredentials(
        patientProfile.id,
        {
          loginId: cleanLogin,
          password: cleanPass,
        },
        user?.id
      );

      if (!result.success) {
        setSaveError(result.error || 'Failed to update patient password. Please try again.');
        return;
      }

      if (result.profile) {
        setPatientProfile(result.profile);
      }

      setLastSavedPass(cleanPass);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update patient password. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(`Patient Login: ${patientLoginId}\nPassword: ${patientPassword || '(Not set)'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-[#26332F]">
      {/* Header */}
      <div className="flex items-center space-x-3 border-b border-[#E4DED4] pb-4">
        <div className="p-3 bg-[#DDE9D9] text-[#176B61] rounded-2xl border border-[#B7D4CC]">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#26332F]">Settings & Security</h1>
          <p className="text-sm text-[#66736D]">Patient login credentials, interface size, voice output, and account settings</p>
        </div>
      </div>

      {/* ── ELDERLY PATIENT PROFILE CARD (For Caregivers) ── */}
      {role === 'caregiver' && (
        <ElderlyPatientProfileEditor
          onProfileUpdated={(updated) => {
            setPatientProfile(updated);
          }}
          onPatientSelected={(selected) => {
            setPatientProfile(selected);
          }}
        />
      )}

      {/* ── PATIENT LOGIN CREDENTIALS CARD (For Caregivers) ── */}
      {role === 'caregiver' && (
        <div className="bg-[#F4EBD7] p-6 sm:p-7 rounded-3xl border border-[#E4DED4] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4DED4] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#176B61] text-white flex items-center justify-center shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#26332F]">Patient Login Credentials</h3>
                <p className="text-xs text-[#66736D]">Manage the password your patient uses to sign in</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-3.5 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" /> Change Password
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-3.5 py-2 bg-white hover:bg-[#FAF9F4] text-[#26332F] font-extrabold text-xs rounded-xl border border-[#E4DED4] transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#176B61]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#176B61]" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Patient Indicator */}
          <div className="bg-white px-4 py-2.5 rounded-xl border border-[#E4DED4] flex items-center justify-between text-xs font-semibold">
            <span className="text-[#66736D] flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#176B61]" />
              Managing credentials for: <strong className="text-[#176B61] font-bold">{patientProfile.basicInfo?.name || 'Patient'}</strong>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-[#DDE9D9] text-[#176B61] rounded-full border border-[#B7D4CC]">
              ID: {patientProfile.id.substring(0, 8)}...
            </span>
          </div>

          {saveSuccess && (
            <div className="p-3.5 bg-[#DDE9D9] border border-[#B7D4CC] text-[#176B61] rounded-2xl text-xs font-extrabold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-[#176B61] shrink-0" />
              <div>
                <p className="font-black text-sm">Password successfully changed for {patientProfile.basicInfo?.name || 'Patient'}!</p>
                <p className="text-[11px] font-medium text-[#26332F] mt-0.5">
                  The patient can now immediately sign in at <span className="font-mono font-bold text-[#176B61]">/patient/login</span> using Login ID <span className="font-mono font-bold">"{patientLoginId}"</span> and the new password.
                </p>
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-[#EFD4D3] border border-[#DEAFB5] text-[#26332F] rounded-xl text-xs font-bold">
              {saveError}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveCredentials} className="bg-white p-5 rounded-2xl border border-[#E4DED4] shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-[#26332F] mb-1">
                    Patient Login ID / Username
                  </label>
                  <input
                    type="text"
                    value={editLoginId}
                    onChange={e => setEditLoginId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]"
                    placeholder="e.g. Kalanjiam or Pushpa"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#26332F] mb-1">
                    New Patient Password (min. 6 characters)
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-bold text-[#26332F] outline-none focus:border-[#176B61]"
                    placeholder="e.g. secret123"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4DED4]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saveLoading}
                  className="px-4 py-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-xs rounded-xl transition cursor-pointer border border-[#E4DED4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saveLoading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs space-y-1">
                <span className="text-[#66736D] block text-[10px] uppercase font-bold tracking-wider">
                  Patient Email / Login ID
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-[#26332F] font-mono font-extrabold text-sm sm:text-base">
                    {patientLoginId}
                  </span>
                  <span className="text-[10px] font-bold bg-[#DDE9D9] text-[#176B61] px-2 py-0.5 rounded-full border border-[#B7D4CC]">
                    Login ID
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs space-y-1">
                <span className="text-[#66736D] block text-[10px] uppercase font-bold tracking-wider">
                  Caregiver-Assigned Password
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-[#26332F] font-mono font-extrabold text-sm sm:text-base">
                    {patientPassword ? (showPatientPassword ? patientPassword : '••••••••••••') : <span className="text-[#66736D] text-xs font-bold">Not set yet (Click Change Password)</span>}
                  </span>
                  {patientPassword && (
                    <button
                      type="button"
                      onClick={() => setShowPatientPassword(!showPatientPassword)}
                      className="text-[#66736D] hover:text-[#176B61] p-1 cursor-pointer transition"
                      title={showPatientPassword ? 'Hide Password' : 'Show Password'}
                    >
                      {showPatientPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/80 p-3.5 rounded-2xl border border-[#E4DED4] flex items-start gap-2.5 text-xs text-[#66736D]">
            <Heart className="w-4 h-4 text-[#176B61] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Patient Login:</strong> Only the password set above is accepted. The patient simply goes to <code className="text-[#176B61] font-bold">/patient/login</code>, selects their name or types their Login ID, and enters this password.
            </p>
          </div>
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-xs space-y-3">
        <h3 className="text-lg font-extrabold text-[#26332F] flex items-center gap-2">
          <User className="w-5 h-5 text-[#176B61]" /> Account & Profile Info
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-[#66736D] bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4]">
          <div>
            <span className="text-[#66736D] block text-[10px] uppercase font-bold">Active User</span>
            <span className="text-[#26332F] font-extrabold text-base">{user?.name || profile.name}</span>
          </div>
          <div>
            <span className="text-[#66736D] block text-[10px] uppercase font-bold">Role</span>
            <span className="text-[#176B61] font-extrabold uppercase">{role}</span>
          </div>
          <div>
            <span className="text-[#66736D] block text-[10px] uppercase font-bold">Preferred Language</span>
            <span className="text-[#26332F] font-bold">{profile.preferredLanguage}</span>
          </div>
          <div>
            <span className="text-[#66736D] block text-[10px] uppercase font-bold">Caregiver Contact</span>
            <span className="text-[#26332F] font-bold">{profile.emergencyContact}</span>
          </div>
        </div>
      </div>

      {/* Accessibility Controls Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#E4DED4] shadow-xs space-y-5">
        <h3 className="text-lg font-extrabold text-[#26332F] flex items-center gap-2">
          <Type className="w-5 h-5 text-[#176B61]" /> Accessibility Preferences
        </h3>

        {/* Text Size */}
        <div className="flex items-center justify-between p-4 bg-[#FAF9F4] rounded-2xl border border-[#E4DED4]">
          <div>
            <h4 className="text-base font-extrabold text-[#26332F]">Text Display Size</h4>
            <p className="text-xs text-[#66736D]">Adjust overall font size for comfortable reading</p>
          </div>
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#E4DED4]">
            <button
              onClick={() => setTextSize('small')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                settings.textSize === 'small' ? 'bg-[#176B61] text-white' : 'text-[#66736D] hover:bg-[#F4EBD7]'
              }`}
            >
              Small
            </button>
            <button
              onClick={() => setTextSize('medium')}
              className={`px-3 py-1 rounded-lg text-sm font-extrabold cursor-pointer ${
                settings.textSize === 'medium' ? 'bg-[#176B61] text-white' : 'text-[#66736D] hover:bg-[#F4EBD7]'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setTextSize('large')}
              className={`px-3 py-1 rounded-lg text-base font-extrabold cursor-pointer ${
                settings.textSize === 'large' ? 'bg-[#176B61] text-white' : 'text-[#66736D] hover:bg-[#F4EBD7]'
              }`}
            >
              Large
            </button>
          </div>
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between p-4 bg-[#FAF9F4] rounded-2xl border border-[#E4DED4]">
          <div>
            <h4 className="text-base font-extrabold text-[#26332F]">High Contrast Mode</h4>
            <p className="text-xs text-[#66736D]">Enable high contrast colors for maximum visibility</p>
          </div>
          <button
            onClick={toggleHighContrast}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              settings.highContrast
                ? 'bg-[#176B61] text-white border-[#176B61]'
                : 'bg-white text-[#66736D] border-[#E4DED4] hover:bg-[#F4EBD7]'
            }`}
          >
            {settings.highContrast ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Voice Guidance */}
        <div className="flex items-center justify-between p-4 bg-[#FAF9F4] rounded-2xl border border-[#E4DED4]">
          <div>
            <h4 className="text-base font-extrabold text-[#26332F]">Voice Guidance (Text-to-Speech)</h4>
            <p className="text-xs text-[#66736D]">Read game instructions and messages aloud</p>
          </div>
          <button
            onClick={toggleVoiceGuidance}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              settings.voiceGuidance
                ? 'bg-[#176B61] text-white border-[#176B61]'
                : 'bg-white text-[#66736D] border-[#E4DED4] hover:bg-[#F4EBD7]'
            }`}
          >
            {settings.voiceGuidance ? 'Enabled' : 'Muted'}
          </button>
        </div>
      </div>

      {/* Security & Privacy */}
      <div className="bg-[#FAF9F4] border border-[#E4DED4] p-5 rounded-3xl flex items-start space-x-3 text-xs text-[#26332F]">
        <ShieldCheck className="w-6 h-6 text-[#176B61] shrink-0 mt-0.5" />
        <div>
          <h4 className="font-extrabold text-sm text-[#26332F]">Privacy & Data Security Notice</h4>
          <p className="mt-0.5 leading-relaxed text-[#66736D]">
            Your memories, family photos, and cognitive activity logs are strictly confidential and stored securely on your local device.
          </p>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-4 bg-[#EFD4D3] hover:bg-[#ebd0cf] text-[#26332F] border border-[#DEAFB5] font-extrabold text-base rounded-2xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-5 h-5" /> Sign Out of SIROI
        </button>
      </div>
    </div>
  );
};
