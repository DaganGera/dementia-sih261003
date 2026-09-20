import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { I18nProvider } from './i18n';
import { AccessibilityControls } from './components/AccessibilityControls';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';

// Pages
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { CaregiverLogin } from './pages/CaregiverLogin';
import { PatientLogin } from './pages/PatientLogin';
import { CaregiverSignup } from './pages/CaregiverSignup';
import { AuthCallback } from './pages/AuthCallback';
import { ProfileSetup } from './pages/ProfileSetup';
import { CaregiverDashboard } from './pages/CaregiverDashboard';
import { FamilyPlaces } from './pages/FamilyPlaces';
import { MedicalHistoryDetail } from './pages/MedicalHistoryDetail';
import { ElderlyHome } from './pages/ElderlyHome';
import { GamesHub } from './pages/GamesHub';
import { MemoryAssistant } from './pages/MemoryAssistant';
import { ActivityHistory } from './pages/ActivityHistory';
import { Reminders } from './pages/Reminders';
import { DeviceConnectionPage } from './pages/DeviceConnection';
import { SettingsPage } from './pages/Settings';

import { QRService } from './services/qr';
import { StorageService } from './services/storage';
import { CareTeamService } from './services/careTeamService';
import { runInitialMigration } from './offline/migration';
import { CheckCircle2, Brain } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, role, isAuthenticated, isLoading, switchRole } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/auth/callback' || window.location.hash.includes('access_token')) {
        return '/auth/callback';
      }
      if (path && path !== '/') {
        return path;
      }
    }
    return '/login';
  });

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [qrConnectNotification, setQrConnectNotification] = useState<string | null>(null);

  const navigateTo = (tab: string) => {
    const storedCaregiver = typeof window !== 'undefined' ? localStorage.getItem('mindcare_caregiver_session') : null;
    const storedPatient = typeof window !== 'undefined' ? localStorage.getItem('mindcare_patient_session') : null;
    const hasSession = Boolean(isAuthenticated || user || storedCaregiver || storedPatient);

    let activeRole: string | null = role || user?.role || null;
    if (!activeRole && typeof window !== 'undefined') {
      if (storedCaregiver) activeRole = 'caregiver';
      else if (storedPatient) activeRole = 'patient';
    }

    const isCaregiverOnlyTab = [
      '/caregiver/dashboard',
      '/caregiver/setup',
      '/caregiver/care-team',
      '/caregiver/medical-history',
      'dashboard',
      'setup-profile',
      'caregiver-setup',
      'medical-history',
    ].includes(tab);

    const publicAuthRoutes = [
      '/',
      '/login',
      '/caregiver/login',
      '/caregiver/signup',
      '/patient/login',
      '/auth/callback',
      '/connect',
      'connect',
      'login',
      'caregiver-login',
      'caregiver-signup',
      'patient-login',
      'register',
      'landing',
    ];

    // Guard: Pure patient accounts cannot access caregiver routes
    if (activeRole === 'patient' && isCaregiverOnlyTab) {
      setCurrentTab('/patient/dashboard');
      if (typeof window !== 'undefined') window.history.pushState({}, '', '/patient/dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If caregiver navigates to a caregiver tab, switch role to caregiver if it was in elderly preview
    if ((activeRole === 'caregiver' || role === 'elderly') && isCaregiverOnlyTab) {
      if (role === 'elderly') {
        switchRole('caregiver');
      }
    }

    // Guard: Unauthenticated users redirected to /login on protected pages
    if (!hasSession && !publicAuthRoutes.includes(tab)) {
      setCurrentTab('/login');
      if (typeof window !== 'undefined') window.history.pushState({}, '', '/login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setCurrentTab(tab);
    if (typeof window !== 'undefined' && tab.startsWith('/')) {
      window.history.pushState({}, '', tab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    // Run initial migration from LocalStorage to IndexedDB
    runInitialMigration().catch((e) => console.warn('Migration run notice', e));

    // Handle browser back/forward buttons
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path) {
        setCurrentTab(path);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // QR device pairing handling
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      if (urlToken) {
        const payload = QRService.parseConnectionToken(urlToken);
        if (payload) {
          const updated = {
            id: `dev-conn-${Date.now()}`,
            token: payload.token,
            caregiverName: payload.caregiverName,
            elderlyName: payload.elderlyName,
            connectedAt: new Date().toISOString(),
            status: 'online' as const,
            lastSync: 'Just now',
          };
          StorageService.saveDeviceConnection(updated);
          setQrConnectNotification(`✓ Connected Successfully with ${payload.caregiverName}!`);
          setTimeout(() => setQrConnectNotification(null), 5000);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // When auth state settles or changes:
  useEffect(() => {
    if (!isLoading) {
      if (currentTab === '/auth/callback') {
        return; // Allow callback component to complete its redirect logic
      }

      const publicAuthRoutes = [
        '/',
        '/login',
        '/caregiver/login',
        '/caregiver/signup',
        '/patient/login',
        'login',
        'caregiver-login',
        'caregiver-signup',
        'patient-login',
        'register',
      ];

      const storedCaregiver = typeof window !== 'undefined' ? localStorage.getItem('mindcare_caregiver_session') : null;
      const storedPatient = typeof window !== 'undefined' ? localStorage.getItem('mindcare_patient_session') : null;
      const hasSession = Boolean(isAuthenticated || user || storedCaregiver || storedPatient);

      let activeRole = role || user?.role || null;
      if (!activeRole && typeof window !== 'undefined') {
        if (storedCaregiver) activeRole = 'caregiver';
        else if (storedPatient) activeRole = 'patient';
      }

      // If user has active session and is on an auth/login screen, forward to the right dashboard
      if (hasSession && publicAuthRoutes.includes(currentTab)) {
        if (activeRole === 'caregiver') {
          const hasExistingPatient =
            Boolean(user?.setupCompleted) ||
            Boolean(user?.id && CareTeamService.getActivePatientIdForCaregiver(user.id)) ||
            Boolean(StorageService.getActivePatientId(user?.id) !== 'pat-demo-1');
          navigateTo(hasExistingPatient ? '/caregiver/dashboard' : '/caregiver/setup');
        } else {
          navigateTo('/patient/dashboard');
        }
      }
    }
  }, [isLoading, isAuthenticated, role, user, currentTab]);

  const handlePlayGame = (gameId?: string) => {
    setSelectedGameId(gameId || null);
    navigateTo('/patient/games');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 bg-teal-100 text-teal-800 rounded-3xl flex items-center justify-center animate-pulse border border-teal-200">
          <Brain className="w-8 h-8 text-teal-700" />
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-teal-800">
          Restoring SIROI Session...
        </div>
      </div>
    );
  }

  // Content Renderer with Strict Protected Route Guards
  const renderPage = () => {
    // Only pure patient user accounts are restricted from caregiver routes
    const isPurePatient = role === 'patient' && !localStorage.getItem('mindcare_caregiver_session');

    switch (currentTab) {
      // ── Public Auth Routes ─────────────────────────────────────────
      case '/':
      case '/login':
      case 'login':
        return <Login onNavigate={navigateTo} />;

      case '/caregiver/login':
      case 'caregiver-login':
        return <CaregiverLogin onNavigate={navigateTo} />;

      case '/caregiver/signup':
      case 'caregiver-signup':
      case 'register':
        return <CaregiverSignup onNavigate={navigateTo} />;

      case '/patient/login':
      case 'patient-login':
        return <PatientLogin onNavigate={navigateTo} />;

      case '/auth/callback':
      case 'auth/callback':
        return <AuthCallback onNavigate={navigateTo} />;

      case 'landing':
        return <Landing onNavigate={navigateTo} />;

      // ── Caregiver Protected Routes ─────────────────────────────────
      case '/caregiver/setup':
      case 'caregiver-setup':
      case 'setup-profile':
        if (isPurePatient) return <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />;
        return <ProfileSetup onComplete={() => navigateTo('/caregiver/dashboard')} />;

      case '/caregiver/dashboard':
      case '/caregiver/care-team':
      case 'dashboard':
        if (isPurePatient) return <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />;
        return <CaregiverDashboard onNavigate={navigateTo} />;

      case '/caregiver/family-places':
      case 'family-places':
        if (isPurePatient) return <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />;
        return <FamilyPlaces onNavigate={navigateTo} />;

      case '/caregiver/medical-history':
      case 'medical-history':
        if (isPurePatient) return <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />;
        return <MedicalHistoryDetail onBack={() => navigateTo('/caregiver/dashboard')} />;

      // ── Patient Protected Routes ───────────────────────────────────
      case '/patient/dashboard':
      case 'home':
        return <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />;

      case '/patient/games':
      case 'games':
        return <GamesHub initialGameId={selectedGameId} />;

      case '/patient/assistant':
      case 'assistant':
        return <MemoryAssistant onNavigate={navigateTo} onPlayGame={handlePlayGame} />;

      case '/patient/history':
      case '/patient/analytics':
      case 'history':
      case 'analytics':
        return <ActivityHistory />;

      case '/patient/reminders':
      case '/patient/alerts':
      case 'reminders':
      case 'alerts':
        return <Reminders />;

      case '/connect':
      case 'connect':
        return <DeviceConnectionPage onNavigate={navigateTo} />;

      case '/settings':
      case 'settings':
        return <SettingsPage />;

      default:
        if (isAuthenticated) {
          return role === 'caregiver' ? (
            <CaregiverDashboard onNavigate={navigateTo} />
          ) : (
            <ElderlyHome onNavigate={navigateTo} onPlayGame={handlePlayGame} />
          );
        }
        return <Login onNavigate={navigateTo} />;
    }
  };

  const publicAuthRoutes = [
    '/',
    '/login',
    '/caregiver/login',
    '/caregiver/signup',
    '/patient/login',
    '/auth/callback',
    'login',
    'caregiver-login',
    'caregiver-signup',
    'patient-login',
    'register',
    'landing',
  ];

  const storedCaregiver = typeof window !== 'undefined' ? localStorage.getItem('mindcare_caregiver_session') : null;
  const storedPatient = typeof window !== 'undefined' ? localStorage.getItem('mindcare_patient_session') : null;
  const hasSession = Boolean(isAuthenticated || user || storedCaregiver || storedPatient);
  const shouldShowSidebar = hasSession && !publicAuthRoutes.includes(currentTab);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F4] text-[#26332F] selection:bg-[#176B61] selection:text-white relative">
      {/* QR Code Connection Toast Notification Banner */}
      {qrConnectNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#DDE9D9] text-[#26332F] font-extrabold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-[#176B61] animate-bounce">
          <CheckCircle2 className="w-6 h-6 text-[#176B61] shrink-0" />
          <span className="text-sm">{qrConnectNotification}</span>
        </div>
      )}

      {/* Top Accessibility & Language Bar */}
      <AccessibilityControls />

      {/* Main Navbar Header */}
      <Navbar
        currentTab={currentTab}
        onNavigate={navigateTo}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        showSidebarToggle={shouldShowSidebar}
      />

      {/* Main Layout Body: Left Sidebar + Main Page Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {shouldShowSidebar && (
          <Sidebar
            currentTab={currentTab}
            onNavigate={navigateTo}
            isOpen={isSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
            onCloseMobile={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 md:pb-12">{renderPage()}</main>
      </div>

      {/* Responsive Mobile Bottom Bar */}
      <MobileBottomNav currentTab={currentTab} onNavigate={navigateTo} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <I18nProvider>
        <AccessibilityProvider>
          <MainApp />
        </AccessibilityProvider>
      </I18nProvider>
    </AuthProvider>
  );
};

export default App;
