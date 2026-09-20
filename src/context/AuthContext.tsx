import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { syncManager } from '../offline/syncManager';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsDemoCaregiver: () => void;
  loginAsDemoElderly: () => void;
  login: (email: string, role: UserRole, name?: string, password?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<{ error?: string | null }>;
  signUp: (email: string, password: string, role: UserRole, name: string) => Promise<{ success: boolean; error?: string }>;
  setAuthenticatedUser: (user: User) => void;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore real Supabase Auth session on startup
  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      try {
        if (isSupabaseConfigured()) {
          const sessionUser = await AuthService.getSession();
          if (sessionUser && isMounted) {
            setUser(sessionUser);
            setRole(sessionUser.role);
            syncManager.startSync().catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Session restoration error:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeSession();

    // Subscribe to realtime Supabase Auth state changes
    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
          session?.user
        ) {
          const sessionUser = await AuthService.getSession();
          if (sessionUser && isMounted) {
            setUser(sessionUser);
            setRole(sessionUser.role);
            syncManager.startSync().catch(() => {});
          }
        } else if (event === 'SIGNED_OUT') {
          // If a patient or caregiver session is active in local storage, do not clear user state
          const patientSession = localStorage.getItem('mindcare_patient_session');
          if (patientSession) {
            try {
              const parsed = JSON.parse(patientSession);
              if (parsed && (parsed.role === 'patient' || parsed.role === 'elderly')) {
                return;
              }
            } catch (err) {}
          }

          const caregiverSession = localStorage.getItem('mindcare_caregiver_session');
          if (caregiverSession) {
            try {
              const parsed = JSON.parse(caregiverSession);
              if (parsed && parsed.role === 'caregiver') {
                return;
              }
            } catch (err) {}
          }

          if (isMounted) {
            setUser(null);
            setRole(null);
          }
        }
      });

      return () => {
        isMounted = false;
        authListener?.subscription?.unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const loginAsDemoCaregiver = () => {
    StorageService.resetDemoData();
    localStorage.removeItem('mindcare_patient_session');
    const demoUser: User = {
      id: 'user-demo-cg',
      name: 'Anitha Sharma (Demo)',
      email: 'caregiver.demo@mindcare.ai',
      role: 'caregiver',
      createdAt: new Date().toISOString(),
      isDemo: true,
      setupCompleted: true,
    };
    localStorage.setItem('mindcare_caregiver_session', JSON.stringify(demoUser));
    setUser(demoUser);
    setRole('caregiver');
  };

  const loginAsDemoElderly = () => {
    StorageService.resetDemoData();
    const demoUser: User = {
      id: 'user-demo-eld',
      name: 'Meena Sharma (Demo)',
      email: 'meena.demo@mindcare.ai',
      role: 'patient',
      createdAt: new Date().toISOString(),
      isDemo: true,
      setupCompleted: true,
    };
    localStorage.setItem('mindcare_patient_session', JSON.stringify(demoUser));
    setUser(demoUser);
    setRole('patient');
  };

  const login = async (
    email: string,
    selectedRole: UserRole,
    name?: string,
    password?: string
  ): Promise<boolean> => {
    if (password) {
      const res = await AuthService.signIn(email, password, selectedRole);
      if (res.user) {
        setUser(res.user);
        setRole(res.user.role);
        syncManager.startSync().catch(() => {});
        return true;
      }
      throw new Error(res.error || 'Authentication failed');
    }

    const patientProfile = StorageService.getPatientProfile();
    const resolvedName = name || (selectedRole === 'caregiver' ? 'Caregiver' : (patientProfile.basicInfo?.name || 'Meena Sharma'));
    const sessionUser: User = {
      id: selectedRole === 'patient' ? (patientProfile.id || 'pat-demo-1') : `user-${Date.now()}`,
      name: resolvedName,
      email,
      role: selectedRole,
      createdAt: new Date().toISOString(),
      isDemo: false,
      setupCompleted: true,
    };
    if (selectedRole === 'patient') {
      localStorage.setItem('mindcare_patient_session', JSON.stringify(sessionUser));
    }
    setUser(sessionUser);
    setRole(selectedRole);
    return true;
  };

  const signInWithGoogle = async (): Promise<{ error?: string | null }> => {
    return AuthService.signInWithGoogle();
  };

  const signUp = async (
    email: string,
    password: string,
    selectedRole: UserRole,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await AuthService.signUpCaregiver({
      name,
      email,
      phone: '',
      password,
      language: 'en',
      relationship: 'Family Caregiver',
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    if (res.user) {
      setUser(res.user);
      setRole(res.user.role);
      syncManager.startSync().catch(() => {});
      return { success: true };
    }

    return { success: true };
  };

  const setAuthenticatedUser = (authUser: User) => {
    setUser(authUser);
    setRole(authUser.role);
    if (authUser.role === 'patient') {
      localStorage.setItem('mindcare_patient_session', JSON.stringify(authUser));
      localStorage.removeItem('mindcare_caregiver_session');
    } else {
      localStorage.setItem('mindcare_caregiver_session', JSON.stringify(authUser));
      localStorage.removeItem('mindcare_patient_session');
    }
    syncManager.startSync().catch(() => {});
  };

  const logout = async () => {
    await AuthService.signOut();
    localStorage.removeItem('mindcare_patient_session');
    localStorage.removeItem('mindcare_caregiver_session');
    setUser(null);
    setRole(null);
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        loginAsDemoCaregiver,
        loginAsDemoElderly,
        login,
        signInWithGoogle,
        signUp,
        setAuthenticatedUser,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
