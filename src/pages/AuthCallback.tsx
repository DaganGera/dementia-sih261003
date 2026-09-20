import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Brain, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface AuthCallbackProps {
  onNavigate: (page: string) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ onNavigate }) => {
  const { switchRole } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      // 1. Check for error parameters in URL (from Google / OAuth provider)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const errorDescription =
        urlParams.get('error_description') ||
        hashParams.get('error_description') ||
        urlParams.get('error') ||
        hashParams.get('error');

      if (errorDescription) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        }
        return;
      }

      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Supabase is not configured. Please verify environment variables.');
        }
        return;
      }

      try {
        // 2. Retrieve session restored by Supabase Auth Client
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const supaUser = data.session?.user;
        if (!supaUser) {
          // If session is still propagating, listen to auth state change
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && isMounted) {
              authListener.subscription.unsubscribe();
              await processUserSession(session.user);
            }
          });

          // Timeout fallback after 6 seconds
          setTimeout(() => {
            if (isMounted && status === 'processing') {
              setStatus('error');
              setErrorMessage('Authentication timed out. Please try logging in again.');
            }
          }, 6000);
          return;
        }

        await processUserSession(supaUser);
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err?.message || 'Google authentication could not be completed.');
        }
      }
    };

    const processUserSession = async (user: any) => {
      try {
        // 3. Check if user already has a MindCare profile in public.profiles
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, role, setup_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          // Existing user with profile
          if (isMounted) {
            setStatus('success');
            if (profile.role === 'elderly' || profile.role === 'patient') {
              switchRole('patient');
              setTimeout(() => onNavigate('/patient/dashboard'), 800);
            } else {
              switchRole('caregiver');
              if (profile.setup_completed) {
                setTimeout(() => onNavigate('/caregiver/dashboard'), 800);
              } else {
                setTimeout(() => onNavigate('/caregiver/setup'), 800);
              }
            }
          }
          return;
        }

        // 4. New Google User: Default to Caregiver Role (per Section 13)
        // Patient accounts cannot be self-created via Google
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Caregiver';

        const fullPayload: any = {
          id: user.id,
          full_name: fullName,
          email: user.email || '',
          role: 'caregiver',
          preferred_language: 'en',
          setup_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase.from('profiles').upsert(fullPayload);
        if (upsertError) {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: fullName,
            role: 'caregiver',
            preferred_language: 'en',
            setup_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (isMounted) {
          setStatus('success');
          switchRole('caregiver');
          // New caregiver must complete setup wizard
          setTimeout(() => onNavigate('/caregiver/setup'), 800);
        }
      } catch (e: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(e?.message || 'Error configuring user profile after Google sign in.');
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [onNavigate, switchRole]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl text-center space-y-6">
        <SiroiLilyLogo className="w-16 h-16 mx-auto animate-pulse drop-shadow-2xs" />

        {status === 'processing' && (
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold text-slate-900">Verifying Google Session...</h2>
            <p className="text-xs text-slate-500">
              Connecting with Supabase Auth and loading your secure clinical profile.
            </p>
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Authentication Verified!</h2>
            <p className="text-xs text-slate-500">Redirecting to your SIROI portal...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Authentication Error</h2>
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-semibold text-left">
              {errorMessage || 'Unable to complete Google sign-in. Please verify your internet connection.'}
            </div>
            <button
              onClick={() => onNavigate('/login')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md"
            >
              Return to Login <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
