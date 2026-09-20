import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storage';
import { CareTeamService } from '../services/careTeamService';
import { Eye, EyeOff, Lock, Mail, ArrowRight, HeartHandshake, UserPlus, Sparkles, Settings, QrCode, User } from 'lucide-react';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface CaregiverLoginProps {
  onNavigate: (page: string) => void;
}

export const CaregiverLogin: React.FC<CaregiverLoginProps> = ({ onNavigate }) => {
  const { setAuthenticatedUser, loginAsDemoCaregiver, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both Email and Password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await AuthService.signIn(email, password, 'caregiver');
      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.user) {
        setAuthenticatedUser(res.user);
        const hasExistingPatient =
          Boolean(res.user.setupCompleted) ||
          Boolean(CareTeamService.getActivePatientIdForCaregiver(res.user.id)) ||
          Boolean(StorageService.getActivePatientId(res.user.id) !== 'pat-demo-1');

        if (hasExistingPatient) {
          onNavigate('/caregiver/dashboard');
        } else {
          const isSetupDone = await AuthService.checkSetupCompleted(res.user.id).catch(() => false);
          onNavigate(isSetupDone ? '/caregiver/dashboard' : '/caregiver/setup');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setShowConfigModal(true);
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res?.error) {
        setError(res.error);
        setGoogleLoading(false);
      }
      // On success, Supabase client automatically redirects browser to Google OAuth consent
    } catch (err: any) {
      setError(err?.message || 'Failed to start Google sign in.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F4] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#FFFFFF] rounded-3xl p-8 border border-[#E4DED4] shadow-xl space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <SiroiLilyLogo className="w-14 h-14 mx-auto mb-2.5 drop-shadow-2xs" />
          <span className="bg-[#DDE9D9] text-[#176B61] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#BFCFC5]">
            Caregiver Portal
          </span>
          <h2 className="text-2xl font-extrabold text-[#26332F] mt-2">Caregiver Login</h2>
          <p className="text-xs text-[#66736D] mt-1">Access clinical analytics, patient alerts, and daily care routines</p>
        </div>

        {error && (
          <div className="bg-[#D9A7A8]/20 border border-[#D9A7A8] text-[#26332F] text-xs p-3.5 rounded-xl font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#26332F] mb-1">Email or User ID</label>
            <div className="relative">
              <User className="w-5 h-5 text-[#66736D] absolute left-3 top-3" />
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none transition text-[#26332F]"
                placeholder="e.g. kavin or kavinkalanjiam@gmail.com"
                required
              />
            </div>
            <p className="text-[11px] text-[#66736D] font-medium mt-1">
              Supports email or registered user ID (e.g. <code>kavin</code>, <code>dhanalakshmi</code>)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#26332F] mb-1">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-[#66736D] absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none transition text-[#26332F]"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#66736D] hover:text-[#26332F]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Login'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* ──────── OR ──────── */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#E4DED4] w-full"></div>
          <span className="bg-white px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#66736D]">
            OR
          </span>
          <div className="border-t border-[#E4DED4] w-full"></div>
        </div>

        {/* Google OAuth Login Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="w-full py-3 px-4 bg-white hover:bg-[#FAF9F4] text-[#26332F] border border-[#E4DED4] font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          {googleLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-[#176B61] border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* New Caregiver Account Prompt */}
        <div className="p-4 bg-[#F4EBD7] rounded-2xl border border-[#E4DED4] text-center space-y-2">
          <p className="text-xs text-[#26332F] font-medium">New caregiver?</p>
          <button
            onClick={() => onNavigate('/caregiver/signup')}
            className="w-full py-2.5 bg-white hover:bg-[#FAF9F4] text-[#176B61] border border-[#E4DED4] font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#176B61]" /> Create Account
          </button>
        </div>

        {/* QR Pair Device Shortcut */}
        <div className="pt-2 border-t border-[#E4DED4] space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/connect')}
            className="w-full py-2.5 px-3 bg-[#F4EBD7] hover:bg-[#ebdcc0] text-[#26332F] border border-[#E4DED4] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <QrCode className="w-4 h-4 text-[#176B61]" /> QR Pair Device / Connection Portal
          </button>
          <button
            onClick={() => {
              loginAsDemoCaregiver();
              onNavigate('/caregiver/dashboard');
            }}
            className="w-full py-2.5 px-3 bg-[#DDE9D9]/50 hover:bg-[#DDE9D9] text-[#26332F] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-[#BFCFC5]"
          >
            👨‍⚕️ Quick Demo Mode: Caregiver (Anitha)
          </button>
        </div>

        {/* Patient Login Link & Cloud Config */}
        <div className="text-center pt-2 space-y-2">
          <div>
            <button
              onClick={() => onNavigate('/patient/login')}
              className="text-xs font-bold text-[#176B61] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Looking for Patient Login? Switch to Patient Portal ➔
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-[11px] text-[#66736D] hover:text-[#176B61] inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              {isSupabaseConfigured() ? 'Supabase Connected (Click to Reconfigure)' : 'Configure Supabase Cloud Backend'}
            </button>
          </div>
        </div>

      </div>

      {/* Supabase Configuration Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSavedAndContinue={() => {
          setShowConfigModal(false);
          // Now proceed with Google OAuth immediately
          handleGoogleSignIn();
        }}
      />
    </div>
  );
};
