import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { SUPPORTED_LANGUAGES_LIST } from '../i18n';
import { User, Mail, Lock, Phone, HeartHandshake, ArrowRight, UserPlus, ArrowLeft, Settings } from 'lucide-react';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface CaregiverSignupProps {
  onNavigate: (page: string) => void;
}

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

export const CaregiverSignup: React.FC<CaregiverSignupProps> = ({ onNavigate }) => {
  const { setAuthenticatedUser, signInWithGoogle } = useAuth();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');
  const [relationship, setRelationship] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields (Name, Email, Password).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await AuthService.signUpCaregiver({
        name,
        email,
        phone,
        password,
        language,
        relationship,
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.user) {
        // Registration successful! Set active session and proceed to setup wizard
        setAuthenticatedUser(res.user);
        onNavigate('/caregiver/setup');
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
      setError(err?.message || 'Failed to initiate Google registration.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F4] flex items-center justify-center p-4 py-8">
      <div className="max-w-xl w-full bg-white rounded-3xl p-8 sm:p-10 border border-[#E4DED4] shadow-xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <SiroiLilyLogo className="w-14 h-14 mx-auto mb-2 drop-shadow-2xs" />
          <span className="bg-[#DDE9D9] text-[#176B61] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#BFCFC5]">
            Caregiver Registration
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#26332F] tracking-tight">Create Caregiver Account</h1>
          <p className="text-xs sm:text-sm text-[#66736D]">
            Register as a primary caregiver to set up patient profiles and daily care routines.
          </p>
        </div>

        {error && (
          <div className="bg-[#D9A7A8]/20 border border-[#D9A7A8] text-[#26332F] text-xs p-3.5 rounded-xl font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Full Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#66736D] absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                  placeholder="Anitha Sharma"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#66736D] absolute left-3 top-3.5" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#26332F] mb-1">Email *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#66736D] absolute left-3 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                placeholder="anitha@example.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Caregiving Relationship</label>
              <select
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold text-[#26332F] outline-none cursor-pointer"
              >
                <option value="">Select Relationship</option>
                {RELATIONSHIP_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Preferred Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold text-[#26332F] outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES_LIST.map(lang => (
                  <option key={lang.languageCode} value={lang.languageCode}>
                    {lang.flag} {lang.languageName} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#66736D] absolute left-3 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                  placeholder="Min. 6 characters"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#26332F] mb-1">Confirm Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#66736D] absolute left-3 top-3.5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating Account...' : 'Create Account'} <ArrowRight className="w-4 h-4" />
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

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
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

        <div className="text-center pt-2 border-t border-[#E4DED4] space-y-2">
          <p className="text-xs text-[#66736D]">
            Already have a Caregiver Account?{' '}
            <button
              onClick={() => onNavigate('/caregiver/login')}
              className="font-extrabold text-[#176B61] hover:underline cursor-pointer"
            >
              Sign In here
            </button>
          </p>

          <div>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-[11px] text-[#66736D] hover:text-[#176B61] inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              {isSupabaseConfigured() ? 'Supabase Connected' : 'Configure Supabase Cloud Backend'}
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
          handleGoogleSignUp();
        }}
      />
    </div>
  );
};
