import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n, SUPPORTED_LANGUAGES_LIST } from '../i18n';
import {
  Brain,
  LogOut,
  User,
  Sun,
  Globe,
  Menu,
} from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { SyncStatus } from './SyncStatus';
import { SiroiLilyLogo } from './SiroiBotanical';

interface NavbarProps {
  currentTab?: string;
  onNavigate?: (tab: string) => void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onToggleSidebar,
  showSidebarToggle = false,
}) => {
  const { user, role, logout } = useAuth();
  const { language, setLanguage, t, languageProfile } = useI18n();
  const { settings, toggleHighContrast } = useAccessibility();

  const isFirstPage = currentTab === '/' || currentTab === '/login' || currentTab === 'login' || currentTab === 'landing' || !currentTab;

  return (
    <header className={`${isFirstPage ? 'bg-[#F4ECE1]/95 border-[#E8DFD3]' : 'bg-[#FAF9F4]/95 border-[#E4DED4]'} backdrop-blur-xs border-b sticky top-0 z-30 shadow-xs`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── BRAND & LOGO WITH HAMBURGER ─────────────────────── */}
          <div className="flex items-center gap-2">
            {showSidebarToggle && (
              <button
                onClick={onToggleSidebar}
                className="p-2 text-[#26332F] hover:bg-[#F0E4D8] rounded-xl transition cursor-pointer flex items-center justify-center"
                title="Toggle Navigation Menu"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5 text-[#176B61]" />
              </button>
            )}

            <button
              onClick={() => onNavigate && onNavigate(role === 'caregiver' ? 'dashboard' : 'home')}
              className="flex items-center gap-2.5 text-left group shrink-0 cursor-pointer"
            >
              {isFirstPage ? (
                <div className="flex items-center gap-2">
                  <SiroiLilyLogo className="w-9 h-9 shrink-0 drop-shadow-2xs" />
                  <span className="font-black text-[#4A3528] text-xl tracking-tight">SIROI</span>
                  <span className="bg-[#F4EBD7] text-[#4A3528] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase hidden sm:inline-block border border-[#E4DED4]">
                    in {languageProfile.nativeName || 'ENGLISH'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <SiroiLilyLogo className="w-9 h-9 shrink-0 drop-shadow-2xs" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#26332F] text-lg tracking-tight">SIROI</span>
                      <span className="bg-[#F4EBD7] text-[#26332F] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase hidden sm:inline-block border border-[#E4DED4]">
                        {languageProfile.flag} {languageProfile.nativeName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* ── RIGHT CONTROLS ────────────────────────────────── */}
          <div className="flex items-center gap-2">
            {/* Realtime & Offline Sync Status Indicator */}
            <SyncStatus />

            {/* Quick Language Selector Dropdown */}
            <div className="flex items-center gap-1 bg-white/80 border border-[#E4DED4] px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <Globe className="w-3.5 h-3.5 text-[#176B61]" />
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-black text-[#26332F] outline-none cursor-pointer pr-1"
              >
                {SUPPORTED_LANGUAGES_LIST.map(lang => (
                  <option key={lang.languageCode} value={lang.languageCode}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>

            {/* High Contrast Toggle Switch Pill */}
            <button
              onClick={toggleHighContrast}
              className="hidden sm:flex items-center gap-1.5 bg-white/80 border border-[#E4DED4] px-2.5 py-1.5 rounded-full text-xs font-extrabold text-[#26332F] shadow-sm hover:border-[#176B61] transition"
            >
              <Sun className="w-3.5 h-3.5 text-[#66736D]" />
              <div className={`w-7 h-3.5 rounded-full p-0.5 transition ${settings.highContrast ? 'bg-[#176B61]' : 'bg-[#DDD9D0]'}`}>
                <div className={`w-2.5 h-2.5 bg-white rounded-full transition transform ${settings.highContrast ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
              </div>
            </button>

            {/* Profile Dropdown Badge & Logout */}
            {user ? (
              <div className="flex items-center gap-2 bg-white/80 border border-[#E4DED4] px-3 py-1.5 rounded-full shadow-sm">
                <User className="w-3.5 h-3.5 text-[#176B61]" />
                <span className="text-xs font-extrabold text-[#26332F] hidden sm:inline truncate max-w-[120px]">{user.name}</span>
                <span className="text-[10px] uppercase font-bold bg-[#DDE9D9] text-[#176B61] px-2 py-0.5 rounded-md hidden md:inline">
                  {user.role}
                </span>
                <button
                  onClick={async () => {
                    await logout();
                    if (onNavigate) onNavigate('/login');
                  }}
                  className="px-2 py-1 bg-[#EFD4D3]/40 hover:bg-[#EFD4D3] text-[#26332F] font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer border border-[#EFD4D3] ml-1"
                  title="Sign out of SIROI"
                >
                  <LogOut className="w-3 h-3 text-[#A56F72]" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate && onNavigate('/login')}
                className={`px-4 py-1.5 text-white font-extrabold text-xs rounded-full shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                  isFirstPage ? 'bg-[#9E5536] hover:bg-[#8A4628]' : 'bg-[#176B61] hover:bg-[#12564E]'
                }`}
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
