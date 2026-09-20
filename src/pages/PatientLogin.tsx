import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Eye, EyeOff, Lock, User, ArrowRight, Brain, Heart, KeyRound, QrCode } from 'lucide-react';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface PatientLoginProps {
  onNavigate: (page: string) => void;
}

export const PatientLogin: React.FC<PatientLoginProps> = ({ onNavigate }) => {
  const { setAuthenticatedUser, loginAsDemoElderly } = useAuth();
  
  // Read caregiver-configured credentials from storage so they are in sync
  const patientProfile = StorageService.getPatientProfile();
  const isDemoOnly = patientProfile.id === 'pat-demo-1';
  const initialLoginId = isDemoOnly ? '' : (patientProfile.patientCredentials?.loginId || patientProfile.basicInfo?.name || '');

  const [loginId, setLoginId] = useState<string>(initialLoginId);
  const [password, setPassword] = useState<string>('');
  const [activeHint, setActiveHint] = useState<string>(initialLoginId || (isDemoOnly ? 'meena.sharma' : ''));
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [availablePatients, setAvailablePatients] = useState<Array<{ id: string; name: string; loginId: string }>>([]);

  useEffect(() => {
    const initPatients = async () => {
      try {
        // First sync patients from cloud so local dictionary is fresh on mobile
        await StorageService.syncPatientsFromCloud();

        if (isSupabaseConfigured()) {
          const { data: dbPatients } = await supabase
            .from('patients')
            .select('*')
            .order('created_at', { ascending: false });

          if (dbPatients && dbPatients.length > 0) {
            const list: Array<{ id: string; name: string; loginId: string }> = [];

            for (const p of dbPatients) {
              let med: any = {};
              try {
                med = typeof p.medical_history === 'string' ? JSON.parse(p.medical_history) : (p.medical_history || {});
              } catch {}
              const creds = med?.patientCredentials;
              const patName = p.full_name || 'Patient';
              const patLogin = (creds?.loginId || patName).trim();

              // Only include actual patient records (exclude empty test records)
              if (patName && patName.toLowerCase() !== 'old') {
                list.push({
                  id: p.id,
                  name: patName,
                  loginId: patLogin,
                });
              }
            }

            setAvailablePatients(list);

            // Default to first real patient ID hint if not already entered
            const preferredPat = list.find(p => p.name.toLowerCase().includes('kalanjiam') || p.name.toLowerCase().includes('pushpa')) || list[0];
            if (preferredPat) {
              setActiveHint(preferredPat.loginId);
              setLoginId(prev => (!prev || prev === 'meena.sharma' || prev.toLowerCase() === 'old' ? preferredPat.loginId : prev));
            }
          }
        }
      } catch (e) {
        console.warn('Patient login credential lookup notice:', e);
      }
    };
    initPatients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginId.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setError('Please enter your Email / Login ID and Password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await AuthService.signIn(cleanId, cleanPass, 'patient');
      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.user) {
        setAuthenticatedUser(res.user);
        // Authenticated patient goes directly to Patient Dashboard
        onNavigate('/patient/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Please verify credentials with your caregiver.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F4] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#FFFFFF] rounded-3xl p-8 sm:p-10 border border-[#E4DED4] shadow-xl space-y-6">
        
        {/* Elderly-Friendly Header */}
        <div className="text-center space-y-2">
          <SiroiLilyLogo className="w-16 h-16 mx-auto mb-1 drop-shadow-2xs" />
          <span className="bg-[#DDE9D9] text-[#176B61] text-xs font-black uppercase px-3 py-1 rounded-full border border-[#BFCFC5]">
            Patient Portal
          </span>
          <h1 className="text-3xl font-extrabold text-[#26332F] tracking-tight">Patient Login</h1>
          <p className="text-sm text-[#66736D] font-medium">
            Welcome back! Enter your login details to start your games & memories.
          </p>
        </div>

        {error && (
          <div className="bg-[#D9A7A8]/20 border border-[#D9A7A8] text-[#26332F] text-sm p-3.5 rounded-2xl font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-black text-[#26332F] mb-1.5">
              Email / Login ID
            </label>
            <div className="relative">
              <User className="w-6 h-6 text-[#66736D] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#DDD9D0] rounded-2xl text-base font-bold text-[#26332F] focus:border-[#176B61] focus:ring-2 focus:ring-[#B7D4CC] outline-none transition"
                placeholder={activeHint || "e.g. Kalanjiam"}
                required
              />
            </div>
            <span className="text-[11px] text-[#66736D] font-semibold mt-1 block">
              Created for you by your caregiver {activeHint ? <span>(Assigned ID: <code className="text-[#176B61] font-bold">{activeHint}</code>)</span> : '(e.g. your first name or assigned ID)'}
            </span>
          </div>

          {availablePatients.length > 0 && (
            <div className="p-3 bg-[#F4EBD7] border border-[#E4DED4] rounded-2xl space-y-1.5">
              <span className="text-[11px] font-extrabold text-[#26332F] uppercase tracking-wider block">
                Quick Select Patient:
              </span>
              <div className="flex flex-wrap gap-2">
                {availablePatients.map(pat => {
                  const isSelected =
                    loginId.trim().toLowerCase() === pat.loginId.toLowerCase() ||
                    loginId.trim().toLowerCase() === pat.name.toLowerCase();
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() => {
                        setLoginId(pat.loginId);
                        setPassword('');
                        setActiveHint(pat.loginId);
                        setError(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#176B61] text-white border-[#176B61] shadow-xs'
                          : 'bg-white text-[#26332F] border-[#E4DED4] hover:bg-[#FAF9F4]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      {pat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-[#26332F] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-6 h-6 text-[#66736D] absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-white border border-[#DDD9D0] rounded-2xl text-base font-bold text-[#26332F] focus:border-[#176B61] focus:ring-2 focus:ring-[#B7D4CC] outline-none transition"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#66736D] hover:text-[#26332F] p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-lg rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Login'} <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Informative Note: Credentials set by caregiver */}
        <div className="p-4 bg-[#F4EBD7] border border-[#E4DED4] rounded-2xl text-xs text-[#26332F] font-medium space-y-1.5">
          <p className="font-bold flex items-center gap-1.5 text-[#26332F]">
            <KeyRound className="w-4 h-4 text-[#176B61] shrink-0" /> Caregiver-Assigned Login Details
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#26332F] bg-white p-2.5 rounded-xl border border-[#E4DED4] font-mono">
            <span>Login ID: <strong className="text-[#26332F]">{activeHint || 'Assigned ID'}</strong></span>
          </div>
          <p className="text-[11px] text-[#66736D]">
            Please use the password provided by your family caregiver. Passwords can be managed in the Caregiver Settings.
          </p>
        </div>

        {/* QR Pair Device Access */}
        <div className="pt-2 border-t border-[#E4DED4] space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/connect')}
            className="w-full py-3 px-4 bg-[#F4EBD7] hover:bg-[#ebdcc0] text-[#26332F] border border-[#E4DED4] rounded-2xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <QrCode className="w-4 h-4 text-[#176B61]" /> QR Pair Device / Scan Caregiver Code
          </button>
          <button
            onClick={() => {
              loginAsDemoElderly();
              onNavigate('/patient/dashboard');
            }}
            className="w-full py-3 px-4 bg-[#DDE9D9]/50 hover:bg-[#DDE9D9] text-[#26332F] border border-[#BFCFC5] rounded-2xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            👵 Quick Demo Mode: Patient (Meena Sharma)
          </button>
        </div>

        {/* Caregiver Portal Link */}
        <div className="text-center pt-1">
          <button
            onClick={() => onNavigate('/caregiver/login')}
            className="text-xs font-bold text-[#176B61] hover:underline cursor-pointer"
          >
            Are you a Caregiver? Switch to Caregiver Portal ➔
          </button>
        </div>

      </div>
    </div>
  );
};
