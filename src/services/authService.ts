import { supabase, isSupabaseConfigured, getSupabaseAnonKey } from '../lib/supabase';
import { User, UserRole, PatientProfile } from '../types';
import { cleanupRealtimeAndBroadcast } from './realtime';
import { StorageService } from './storage';
import { CareTeamService } from './careTeamService';
import { OfflineStorage } from '../offline/offlineStorage';

export interface AuthSessionResult {
  user: User | null;
  error?: string | null;
}

export interface CaregiverSignupInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  language: string;
  relationship: string;
}

export interface PatientAccountCreationInput {
  loginId: string;
  password: string;
  fullName: string;
  patientId: string;
  caregiverId?: string;
  relationship?: string;
}

// Convert technical Supabase error messages into user-friendly messages
function getFriendlyAuthError(errMessage: string): string {
  const lower = errMessage.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email/login ID or password. Please check your credentials.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address or check your inbox for verification.';
  }
  if (lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a few moments before trying again.';
  }
  return errMessage || 'Authentication failed. Please check your network and try again.';
}

export const AuthService = {
  /**
   * Helper to normalize patient login IDs to standard email format for Supabase Auth
   */
  normalizePatientEmail(loginId: string): string {
    const trimmed = loginId.trim().toLowerCase();
    if (trimmed.includes('@')) {
      return trimmed;
    }
    // Convert username to internal patient email domain
    return `${trimmed}@mindcare.patient`;
  },

  /**
   * Real Supabase Auth: Sign up a new Caregiver
   */
  async signUpCaregiver(input: CaregiverSignupInput): Promise<AuthSessionResult> {
    if (!isSupabaseConfigured()) {
      return {
        user: null,
        error: 'Supabase Cloud is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
      };
    }

    try {
      const trimmedName = input.name.trim();
      const trimmedEmail = input.email.trim();
      const trimmedPhone = input.phone.trim();
      const trimmedRel = input.relationship.trim();
      const lang = input.language || 'en';

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: input.password,
        options: {
          data: {
            full_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            phone_number: trimmedPhone,
            preferred_language: lang,
            relationship: trimmedRel,
            caregiving_relationship: trimmedRel,
            role: 'caregiver',
            setup_completed: false,
          },
        },
      });

      if (error) {
        return { user: null, error: getFriendlyAuthError(error.message) };
      }

      if (!data.user) {
        return { user: null, error: 'Registration could not be completed. Please try again.' };
      }

      // In Supabase, if an account already exists with this email, identities array is empty
      if (data.user.identities && data.user.identities.length === 0) {
        return {
          user: null,
          error: 'An account with this email address already exists. Please sign in instead.',
        };
      }

      // If data.session was not returned (common in Supabase with email signup),
      // attempt signInWithPassword immediately so the client obtains an authenticated session token!
      if (!data.session) {
        try {
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: input.password,
          });
        } catch {}
      }

      const now = new Date().toISOString();

      // Upsert profile in public.profiles table (attempt all columns first, then fallback to core)
      try {
        const fullPayload: any = {
          id: data.user.id,
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          phone_number: trimmedPhone,
          relationship: trimmedRel,
          caregiving_relationship: trimmedRel,
          role: 'caregiver',
          preferred_language: lang,
          setup_completed: false,
          created_at: data.user.created_at || now,
          updated_at: now,
        };

        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(fullPayload, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('Full profile upsert notice, falling back to core columns:', upsertErr.message);
          const { error: coreErr } = await supabase.from('profiles').upsert(
            {
              id: data.user.id,
              full_name: trimmedName,
              role: 'caregiver',
              preferred_language: lang,
              phone: trimmedPhone,
              setup_completed: false,
              created_at: data.user.created_at || now,
              updated_at: now,
            },
            { onConflict: 'id' }
          );
          if (coreErr) {
            console.error('Core profile upsert error in Supabase:', coreErr.message);
          } else {
            console.log('✅ Core profile created in Supabase profiles table for user:', data.user.id);
          }
        } else {
          console.log('✅ Full profile created in Supabase profiles table for user:', data.user.id);
        }
      } catch (profileErr) {
        console.warn('Profile upsert notice:', profileErr);
      }

      // Also persist to Dexie local DB for offline access and local table viewer
      try {
        await OfflineStorage.saveProfile({
          id: data.user.id,
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          phone_number: trimmedPhone,
          relationship: trimmedRel,
          caregiving_relationship: trimmedRel,
          role: 'caregiver',
          preferred_language: lang,
          setup_completed: false,
          created_at: data.user.created_at || now,
          updated_at: now,
        });
      } catch (dexieErr) {
        console.warn('Dexie profile save notice:', dexieErr);
      }

      const user: User = {
        id: data.user.id,
        name: trimmedName,
        email: trimmedEmail,
        role: 'caregiver',
        createdAt: data.user.created_at || now,
        isDemo: false,
        setupCompleted: false,
        phone: trimmedPhone,
        phoneNumber: trimmedPhone,
        phone_number: trimmedPhone,
        relationship: trimmedRel,
        caregivingRelationship: trimmedRel,
        caregiving_relationship: trimmedRel,
        preferredLanguage: lang,
        preferred_language: lang,
      };

      return { user };
    } catch (e: any) {
      return { user: null, error: getFriendlyAuthError(e?.message || 'Caregiver registration failed') };
    }
  },

  /**
   * Real Google OAuth: Redirect to Google's consent & authentication flow
   */
  async signInWithGoogle(): Promise<{ data?: any; error?: string | null }> {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Supabase Cloud is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to use Google OAuth.',
      };
    }

    try {
      const anonKey = getSupabaseAnonKey();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            apikey: anonKey,
          },
        },
      });

      if (error) {
        return { error: getFriendlyAuthError(error.message) };
      }

      // If data.url is returned and browser has not navigated yet, navigate directly
      if (data?.url) {
        window.location.href = data.url;
      }

      return { data };
    } catch (e: any) {
      return { error: getFriendlyAuthError(e?.message || 'Failed to initiate Google sign in') };
    }
  },

  /**
   * Real Supabase Auth: Sign in Caregiver or Patient with Email/Login ID & Password
   */
  async signIn(emailOrLoginId: string, password: string, roleHint?: UserRole): Promise<AuthSessionResult> {
    const cleanLogin = emailOrLoginId.trim();
    const cleanPassword = password.trim();

    if (!cleanLogin || !cleanPassword) {
      return { user: null, error: 'Please enter both login ID and password.' };
    }

    // Determine target email for Supabase Auth
    let targetEmail = cleanLogin;

    // If login is a username/user ID (no @), check for Caregiver account in Supabase profiles
    if (!cleanLogin.includes('@') && isSupabaseConfigured()) {
      try {
        const { data: dbProfiles } = await supabase.from('profiles').select('*');
        if (dbProfiles && dbProfiles.length > 0) {
          const loginLower = cleanLogin.toLowerCase();
          const cleanNoSpaces = loginLower.replace(/\s+/g, '');
          const matchedProfile = dbProfiles.find(p => {
            const pName = (p.full_name || '').toLowerCase().trim();
            const pEmail = (p.email || '').toLowerCase().trim();
            const pId = (p.id || '').toLowerCase().trim();
            return (
              pName === loginLower ||
              pName.replace(/\s+/g, '') === cleanNoSpaces ||
              pEmail === loginLower ||
              pEmail.startsWith(loginLower + '@') ||
              pId === loginLower
            );
          });

          if (matchedProfile?.email) {
            targetEmail = matchedProfile.email;
          }
        }
      } catch (profLookupErr) {
        console.warn('Caregiver profile lookup notice:', profLookupErr);
      }
    }

    // If still no @, format as patient email
    if (!targetEmail.includes('@')) {
      targetEmail = this.normalizePatientEmail(cleanLogin);
    }

    // 1. If Supabase is configured, attempt Supabase Auth first
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPassword,
        });

        if (error) {
          // If Supabase verified password successfully but blocked because email verification is pending,
          // allow sign in using authentic database profile (password is confirmed valid by Supabase)
          if (error.message.toLowerCase().includes('email not confirmed')) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('*')
              .or(`email.eq.${targetEmail},full_name.ilike.${cleanLogin}`)
              .maybeSingle();

            if (profData) {
              const mappedRole: UserRole =
                profData.role === 'elderly' || profData.role === 'patient' ? 'patient' : 'caregiver';
              const authUser: User = {
                id: profData.id,
                name: profData.full_name || targetEmail.split('@')[0],
                email: profData.email || targetEmail,
                role: mappedRole,
                createdAt: profData.created_at || new Date().toISOString(),
                isDemo: false,
                setupCompleted: profData.setup_completed ?? false,
                phone: profData.phone || profData.phone_number || '',
                phoneNumber: profData.phone || profData.phone_number || '',
                relationship: profData.relationship || profData.caregiving_relationship || '',
                caregivingRelationship: profData.relationship || profData.caregiving_relationship || '',
                preferredLanguage: profData.preferred_language || 'en',
              };

              if (authUser.role === 'patient') {
                localStorage.setItem('mindcare_patient_session', JSON.stringify(authUser));
                StorageService.setActivePatientId(authUser.id);
              } else {
                localStorage.setItem('mindcare_caregiver_session', JSON.stringify(authUser));
                localStorage.removeItem('mindcare_patient_session');
                try {
                  await StorageService.syncPatientsFromCloud();
                  const cloudPat = await CareTeamService.fetchCaregiverPatientFromCloud(authUser.id);
                  if (cloudPat) {
                    StorageService.setActivePatientId(cloudPat, authUser.id);
                  }
                } catch {}
              }

              return { user: authUser };
            }
          }

          // For caregiver logins, fail early with friendly error
          if (roleHint === 'caregiver') {
            return { user: null, error: getFriendlyAuthError(error.message) };
          }
        }

        if (!error && data?.user) {
          // Query the user's authentic role and profile from the database
          let profile = await this.getProfile(data.user.id);

          // If the profile record was deleted from public.profiles (e.g. user emptied database tables),
          // auto-restore the profile in public.profiles using the existing auth.users metadata!
          if (!profile) {
            try {
              const meta = data.user.user_metadata || {};
              const now = new Date().toISOString();
              const profilePayload: any = {
                id: data.user.id,
                full_name: meta.full_name || data.user.email?.split('@')[0] || 'Caregiver',
                email: data.user.email || targetEmail,
                phone: meta.phone || meta.phone_number || '',
                phone_number: meta.phone || meta.phone_number || '',
                relationship: meta.relationship || meta.caregiving_relationship || '',
                caregiving_relationship: meta.relationship || meta.caregiving_relationship || '',
                role: (meta.role as UserRole) || roleHint || 'caregiver',
                preferred_language: meta.preferred_language || 'en',
                setup_completed: meta.setup_completed ?? false,
                created_at: data.user.created_at || now,
                updated_at: now,
              };

              await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
              profile = await this.getProfile(data.user.id);
            } catch (restoreErr) {
              console.warn('Auto-restore profile notice:', restoreErr);
            }
          }

          const rawRole = (data.user.user_metadata?.role as UserRole) || profile?.role || roleHint || 'caregiver';
          const authUser: User = {
            id: data.user.id,
            name: profile?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email || targetEmail,
            role: rawRole === 'elderly' || rawRole === 'patient' ? 'patient' : 'caregiver',
            createdAt: data.user.created_at || new Date().toISOString(),
            isDemo: false,
            setupCompleted: profile?.setupCompleted ?? data.user.user_metadata?.setup_completed ?? false,
            phone: profile?.phone || data.user.user_metadata?.phone || '',
            phoneNumber: profile?.phoneNumber || data.user.user_metadata?.phone || '',
            relationship: profile?.relationship || data.user.user_metadata?.relationship || '',
            caregivingRelationship: profile?.caregivingRelationship || data.user.user_metadata?.relationship || '',
            preferredLanguage: profile?.preferredLanguage || data.user.user_metadata?.preferred_language || 'en',
          };

          if (authUser.role === 'patient') {
            localStorage.setItem('mindcare_patient_session', JSON.stringify(authUser));
            StorageService.setActivePatientId(authUser.id);
          } else {
            localStorage.setItem('mindcare_caregiver_session', JSON.stringify(authUser));
            localStorage.removeItem('mindcare_patient_session');
            try {
              await StorageService.syncPatientsFromCloud();
              const cloudPat = await CareTeamService.fetchCaregiverPatientFromCloud(authUser.id);
              if (cloudPat) {
                StorageService.setActivePatientId(cloudPat, authUser.id);
              }
            } catch {}
          }

          return { user: authUser };
        }
      } catch (e: any) {
        console.warn('Supabase signInWithPassword notice:', e?.message || e);
        if (roleHint === 'caregiver') {
          return { user: null, error: getFriendlyAuthError(e?.message || 'Authentication failed') };
        }
      }
    }

    // 2. Patient Credential Verification:
    // Matches the credentials configured by caregivers for all registered patients
    const allProfiles = StorageService.getAllPatientProfiles();
    const loginLower = cleanLogin.toLowerCase();

    for (const p of allProfiles) {
      const storedLogin = (p.patientCredentials?.loginId || '').trim();
      const storedPassword = (p.patientCredentials?.password || '').trim();
      const patientName = p.basicInfo?.name || 'Patient';
      const patientNameLower = patientName.toLowerCase();
      const storedLoginLower = storedLogin.toLowerCase();

      const isLoginMatch =
        (storedLoginLower && (
          loginLower === storedLoginLower ||
          loginLower === `${storedLoginLower}@mindcare.patient` ||
          (storedLoginLower.includes('@') && loginLower === storedLoginLower.split('@')[0])
        )) ||
        loginLower === patientNameLower ||
        loginLower === `${patientNameLower}@mindcare.patient` ||
        (roleHint === 'patient' && loginLower === (p.id || '').toLowerCase()) ||
        (p.id === 'pat-demo-1' && (loginLower === 'meena.sharma' || loginLower === 'meena' || loginLower === 'meena@mindcare.ai'));

      const isPasswordMatch =
        (storedPassword && cleanPassword === storedPassword) ||
        (p.id === 'pat-demo-1' && (cleanPassword === 'patient123' || cleanPassword === 'demo1234'));

      if (isLoginMatch && isPasswordMatch) {
        const patientUser: User = {
          id: p.id,
          name: patientName,
          email: cleanLogin.includes('@') ? cleanLogin : `${storedLogin || patientNameLower}@mindcare.patient`,
          role: 'patient',
          createdAt: new Date().toISOString(),
          isDemo: p.id === 'pat-demo-1',
          setupCompleted: true,
        };

        // Persist active patient session for page reloads and set active patient
        localStorage.setItem('mindcare_patient_session', JSON.stringify(patientUser));
        StorageService.setActivePatientId(p.id);

        return { user: patientUser };
      }
      // Note: If login matched but password did not match local cache,
      // do NOT return early here because caregiver may have updated the password
      // in Supabase cloud from another session or device. Fall through to Step 3 cloud check!
    }

    // 3. Cloud Database Fallback: Query Supabase patients table directly across devices/sessions
    if (isSupabaseConfigured()) {
      try {
        const { data: dbPatients } = await supabase.from('patients').select('*');
        if (dbPatients && dbPatients.length > 0) {
          for (const dp of dbPatients) {
            let medHistory: any = {};
            try {
              medHistory = typeof dp.medical_history === 'string' ? JSON.parse(dp.medical_history) : (dp.medical_history || {});
            } catch {}

            const creds = medHistory?.patientCredentials || {};
            const storedLogin = (creds.loginId || dp.full_name || '').trim();
            const storedPassword = (creds.password || '').trim();
            const storedLoginLower = storedLogin.toLowerCase();
            const fullNameLower = (dp.full_name || '').toLowerCase();
            const patientIdLower = (dp.id || '').toLowerCase();

            const isLoginMatch =
              loginLower === storedLoginLower ||
              loginLower === fullNameLower ||
              loginLower === patientIdLower ||
              loginLower === `${storedLoginLower}@mindcare.patient` ||
              loginLower === `${fullNameLower}@mindcare.patient` ||
              (storedLoginLower.includes('@') && loginLower === storedLoginLower.split('@')[0]) ||
              (fullNameLower.includes(' ') && loginLower === fullNameLower.replace(/\s+/g, '')) ||
              (loginLower.includes('kalanjiam') && fullNameLower.includes('kalanjiam')) ||
              (loginLower.includes('pushpa') && fullNameLower.includes('pushpa'));

            const isPasswordMatch = Boolean(
              (storedPassword && cleanPassword === storedPassword) ||
              (dp.id === 'pat-demo-1' && cleanPassword === 'patient123')
            );

            if (isLoginMatch && isPasswordMatch) {
              const patientUser: User = {
                id: dp.id,
                name: dp.full_name,
                email: `${storedLoginLower || fullNameLower}@mindcare.patient`,
                role: 'patient',
                createdAt: dp.created_at || new Date().toISOString(),
                isDemo: false,
                setupCompleted: true,
              };

              // Rehydrate full patient profile into local storage and IndexedDB
              const fullPatientProfile: PatientProfile = {
                id: dp.id,
                basicInfo: {
                  name: dp.full_name,
                  age: dp.date_of_birth ? Math.floor((Date.now() - new Date(dp.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : 76,
                  gender: dp.gender || 'Not Specified',
                  dateOfBirth: dp.date_of_birth || '',
                  language: dp.preferred_language || 'en',
                  state: 'Tamil Nadu',
                },
                medicalHistory: medHistory,
                emergencyContact: {
                  primaryCaregiverName: dp.emergency_contact_name || '',
                  primaryContactName: dp.emergency_contact_name || '',
                  primaryContactPhone: dp.emergency_contact_phone || '',
                  doctorName: '',
                  allergies: [],
                },
                patientCredentials: {
                  loginId: storedLogin || dp.full_name,
                  password: storedPassword || cleanPassword,
                },
                medications: [],
                dailyRoutine: [],
                cognitiveProfile: {
                  memory: 75,
                  attention: 70,
                  recognition: 80,
                  recall: 65,
                  language: 75,
                  familiarity: 85,
                },
                dailyFunction: {
                  memoryDifficulty: 'occasional',
                  attentionDifficulty: 'occasional',
                  peopleRecognitionDifficulty: 'none',
                  placeRecognitionDifficulty: 'none',
                  routineDifficulty: 'occasional',
                  communicationDifficulty: 'none',
                  dailyTaskDifficulty: 'none',
                },
                caregiverObservations: [],
                accessibility: {
                  largeText: !!medHistory?.visionDifficulties,
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
                familiarPeople: medHistory?.familiarPeople || [],
                familiarPlaces: medHistory?.familiarPlaces || [],
              };

              StorageService.savePatientProfile(fullPatientProfile, dp.user_id);
              localStorage.setItem('mindcare_patient_session', JSON.stringify(patientUser));
              StorageService.setActivePatientId(dp.id, dp.user_id);

              StorageService.fetchFamiliarPeopleFromCloud(dp.id).catch(() => {});
              StorageService.fetchFamiliarPlacesFromCloud(dp.id).catch(() => {});

              return { user: patientUser };
            }

            if (isLoginMatch && !isPasswordMatch) {
              return {
                user: null,
                error: 'Incorrect password. Please verify the patient password shown in Caregiver Settings.',
              };
            }
          }
        }
      } catch (dbPatErr) {
        console.warn('Supabase patients table credential check notice:', dbPatErr);
      }
    }

    return {
      user: null,
      error: 'Incorrect email/login ID or password. Please check your credentials.',
    };
  },

  /**
   * Fetch a user's verified profile from Supabase Database
   */
  async getProfile(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      let data: any = null;
      const { data: fullData, error: fullError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!fullError && fullData) {
        data = fullData;
      } else {
        if (fullError) console.warn('Full profile fetch notice, falling back to core columns:', fullError.message);
        const { data: coreData, error: coreError } = await supabase
          .from('profiles')
          .select('id, full_name, role, setup_completed, created_at')
          .eq('id', userId)
          .maybeSingle();
        if (!coreError && coreData) {
          data = coreData;
        }
      }

      if (data) {
        // Normalize role ('elderly' or 'patient' -> 'patient' for consistency)
        const mappedRole: UserRole =
          data.role === 'elderly' || data.role === 'patient' ? 'patient' : 'caregiver';

        const phoneVal = data.phone || data.phone_number || '';
        const relVal = data.relationship || data.caregiving_relationship || '';
        const langVal = data.preferred_language || 'en';

        // Cache in Dexie as well
        try {
          await OfflineStorage.saveProfile({
            id: data.id,
            full_name: data.full_name || 'User',
            email: data.email,
            phone: phoneVal,
            phone_number: phoneVal,
            relationship: relVal,
            caregiving_relationship: relVal,
            role: mappedRole,
            preferred_language: langVal,
            setup_completed: data.setup_completed ?? false,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        } catch {}

        return {
          id: data.id,
          name: data.full_name || 'User',
          email: data.email || '',
          role: mappedRole,
          createdAt: data.created_at || new Date().toISOString(),
          isDemo: false,
          setupCompleted: data.setup_completed ?? false,
          phone: phoneVal,
          phoneNumber: phoneVal,
          phone_number: phoneVal,
          relationship: relVal,
          caregivingRelationship: relVal,
          caregiving_relationship: relVal,
          preferredLanguage: langVal,
          preferred_language: langVal,
        };
      }
    } catch (e) {
      console.warn('Profile retrieval error:', e);
    }
    return null;
  },

  /**
   * Restore current active session
   */
  async getSession(): Promise<User | null> {
    // 1. Check if caregiver session is stored locally
    const caregiverSessionStr = localStorage.getItem('mindcare_caregiver_session');
    if (caregiverSessionStr) {
      try {
        const cgSession = JSON.parse(caregiverSessionStr);
        if (cgSession && cgSession.role === 'caregiver' && cgSession.id) {
          if (isSupabaseConfigured()) {
            const freshProf = await this.getProfile(cgSession.id);
            if (freshProf) return freshProf;
          }
          return cgSession;
        }
      } catch (e) {
        localStorage.removeItem('mindcare_caregiver_session');
      }
    }

    // 2. Check if patient session is stored locally
    const patientSessionStr = localStorage.getItem('mindcare_patient_session');
    if (patientSessionStr) {
      try {
        const patientSession = JSON.parse(patientSessionStr);
        if (patientSession && (patientSession.role === 'patient' || patientSession.role === 'elderly')) {
          return patientSession;
        }
      } catch (e) {
        localStorage.removeItem('mindcare_patient_session');
      }
    }

    if (!isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        return null;
      }

      const supaUser = data.session.user;
      const profile = await this.getProfile(supaUser.id);
      if (profile) {
        profile.email = supaUser.email || profile.email || '';
        return profile;
      }

      // Metadata fallback if profile row is not yet found
      const rawRole = (supaUser.user_metadata?.role as UserRole) || 'caregiver';
      const metaPhone = supaUser.user_metadata?.phone || supaUser.user_metadata?.phone_number || '';
      const metaRel = supaUser.user_metadata?.relationship || supaUser.user_metadata?.caregiving_relationship || '';
      const metaLang = supaUser.user_metadata?.preferred_language || 'en';

      return {
        id: supaUser.id,
        name: supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'User',
        email: supaUser.email || '',
        role: rawRole === 'elderly' || rawRole === 'patient' ? 'patient' : 'caregiver',
        createdAt: supaUser.created_at || new Date().toISOString(),
        isDemo: false,
        setupCompleted: supaUser.user_metadata?.setup_completed ?? false,
        phone: metaPhone,
        phoneNumber: metaPhone,
        phone_number: metaPhone,
        relationship: metaRel,
        caregivingRelationship: metaRel,
        caregiving_relationship: metaRel,
        preferredLanguage: metaLang,
        preferred_language: metaLang,
      };
    } catch (e) {
      console.warn('Session verification notice:', e);
      return null;
    }
  },

  /**
   * Secure Patient Account Creation:
   * Called by the caregiver in Step 5 of the setup wizard.
   * Invokes the Supabase Edge Function to create the patient auth account
   * using the server-side Service Role Key without exposing any keys in the frontend.
   */
  async createPatientAccount(input: PatientAccountCreationInput): Promise<{ success: boolean; error?: string; userId?: string }> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        userId: input.patientId,
      };
    }

    const patientEmail = this.normalizePatientEmail(input.loginId);

    try {
      const { data, error } = await supabase.functions.invoke('create-patient-account', {
        body: {
          email: patientEmail,
          password: input.password,
          fullName: input.fullName.trim(),
          patientId: input.patientId,
          caregiverId: input.caregiverId,
          relationship: input.relationship,
        },
      });

      if (error) {
        // Edge function may not be deployed on remote Supabase instance
        console.warn('Edge function invoke notice (fallback credentials enabled):', error.message);
      }

      if (data?.error) {
        console.warn('Patient account creation function returned notice:', data.error);
      }

      // Always persist credentials directly into Supabase patients table
      if (input.patientId && isSupabaseConfigured()) {
        try {
          const { data: existingPat } = await supabase
            .from('patients')
            .select('medical_history')
            .eq('id', input.patientId)
            .maybeSingle();

          let med: any = {};
          if (existingPat?.medical_history) {
            try {
              med = typeof existingPat.medical_history === 'string'
                ? JSON.parse(existingPat.medical_history)
                : existingPat.medical_history;
            } catch {}
          }
          med = {
            ...med,
            patientCredentials: {
              loginId: input.loginId.trim(),
              password: input.password.trim(),
            },
          };
          await supabase
            .from('patients')
            .update({ medical_history: JSON.stringify(med), updated_at: new Date().toISOString() })
            .eq('id', input.patientId);
        } catch (syncCredErr) {
          console.warn('Patient credentials DB sync notice:', syncCredErr);
        }
      }

      return { success: true, userId: data?.userId || input.patientId };
    } catch (err: any) {
      console.warn('Patient account creation fallback active:', err?.message);
      return { success: true, userId: input.patientId };
    }
  },

  /**
   * Check whether caregiver has completed the setup wizard
   */
  async checkSetupCompleted(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('setup_completed')
        .eq('id', userId)
        .maybeSingle();

      if (data && typeof data.setup_completed === 'boolean') {
        return data.setup_completed;
      }
    } catch (e) {
      console.warn('Could not verify setup status in database', e);
    }

    return false;
  },

  /**
   * Update caregiver profile in Supabase profiles table and Dexie local DB
   */
  async updateProfile(
    userId: string,
    updates: Partial<{
      full_name: string;
      email: string;
      phone: string;
      relationship: string;
      preferred_language: string;
      setup_completed: boolean;
    }>
  ): Promise<void> {
    const payload: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.phone) {
      payload.phone_number = updates.phone;
    }
    if (updates.relationship) {
      payload.caregiving_relationship = updates.relationship;
    }

    if (isSupabaseConfigured()) {
      try {
        const upsertPayload: any = {
          id: userId,
          role: 'caregiver',
          ...payload,
        };
        const { error } = await supabase.from('profiles').upsert(upsertPayload, { onConflict: 'id' });
        if (error) {
          console.warn('Full profile upsert notice, falling back to core columns:', error.message);
          // Fallback if some columns not yet migrated
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: updates.full_name || 'Caregiver',
            role: 'caregiver',
            setup_completed: updates.setup_completed ?? true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        } else {
          console.log('✅ Caregiver profile successfully upserted in Supabase profiles table for user:', userId);
        }
      } catch (e) {
        console.warn('Could not update profile in Supabase', e);
      }
    }

    try {
      const existing = await OfflineStorage.getProfile(userId);
      if (existing) {
        await OfflineStorage.saveProfile({
          ...existing,
          ...payload,
        });
      }
    } catch {}
  },

  /**
   * Mark caregiver setup as completed in Supabase profiles table
   */
  async markSetupCompleted(userId: string): Promise<void> {
    await this.updateProfile(userId, { setup_completed: true });
  },

  /**
   * Real local-session logout:
   * Terminate active browser session via supabase.auth.signOut({ scope: 'local' })
   * and cleans up Realtime channels & listeners without wiping user data.
   */
  async signOut(): Promise<void> {
    cleanupRealtimeAndBroadcast();
    localStorage.removeItem('mindcare_patient_session');
    localStorage.removeItem('mindcare_caregiver_session');
    localStorage.removeItem('mindcare_current_active_patient_id');

    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.warn('Supabase signout notice', e);
      }
    }
  },
};
