import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import {
  Home,
  Gamepad2,
  MessageSquare,
  Bell,
  Settings,
  LayoutDashboard,
  LineChart,
  QrCode,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Brain,
  Heart,
} from 'lucide-react';
import { SiroiLilyLogo } from './SiroiBotanical';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}) => {
  const { role } = useAuth();
  const { t } = useI18n();

  // Patient / Elderly Navigation Items
  const patientNavItems = [
    {
      id: 'home',
      aliases: ['home', '/patient/dashboard'],
      label: t('nav.home') || 'Home',
      icon: Home,
    },
    {
      id: 'games',
      aliases: ['games', '/patient/games'],
      label: t('nav.games') || 'Games',
      icon: Gamepad2,
    },
    {
      id: 'assistant',
      aliases: ['assistant', '/patient/assistant'],
      label: t('nav.memory') || 'Memory Support',
      icon: MessageSquare,
    },
    {
      id: 'reminders',
      aliases: ['reminders', '/patient/reminders', 'alerts', '/patient/alerts'],
      label: t('nav.reminders') || 'Reminders',
      icon: Bell,
    },
    {
      id: 'settings',
      aliases: ['settings', '/settings'],
      label: t('nav.settings') || 'Settings',
      icon: Settings,
    },
  ];

  // Caregiver Navigation Items
  const caregiverNavItems = [
    {
      id: 'dashboard',
      aliases: ['dashboard', '/caregiver/dashboard'],
      label: t('nav.dashboard') || 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'family-places',
      aliases: ['family-places', '/caregiver/family-places'],
      label: t('nav.familyPlaces') || 'Family & Places',
      icon: Heart,
    },
    {
      id: 'analytics',
      aliases: ['analytics', 'history', '/patient/history', '/patient/analytics'],
      label: 'Cognitive Reports',
      icon: LineChart,
    },
    {
      id: 'games',
      aliases: ['games', '/patient/games'],
      label: 'Games & Activities',
      icon: Gamepad2,
    },
    {
      id: 'assistant',
      aliases: ['assistant', '/patient/assistant'],
      label: t('nav.memory') || 'Memory Assistant',
      icon: MessageSquare,
    },
    {
      id: 'reminders',
      aliases: ['reminders', '/patient/reminders', 'alerts', '/patient/alerts'],
      label: t('nav.reminders') || 'Reminders',
      icon: Bell,
    },
    {
      id: 'connect',
      aliases: ['connect', '/connect'],
      label: 'QR Sync / Devices',
      icon: QrCode,
    },
    {
      id: 'settings',
      aliases: ['settings', '/settings'],
      label: t('nav.settings') || 'Settings',
      icon: Settings,
    },
  ];

  const navItems = role === 'caregiver' ? caregiverNavItems : patientNavItems;

  const isItemActive = (aliases: string[]) => {
    return aliases.includes(currentTab);
  };

  const handleSelect = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* ── MOBILE BACKDROP OVERLAY ──────────────────────────── */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR CONTAINER ────────────────────────────────── */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-[#F7F4EC] border-r border-[#E4DED4]
          flex flex-col justify-between
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
          w-72 shadow-lg md:shadow-none
        `}
      >
        {/* Top Header / Branding in Sidebar */}
        <div>
          <div className="flex items-center justify-between p-4 border-b border-[#E4DED4]">
            <div className={`flex items-center gap-2.5 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
              <SiroiLilyLogo className="w-8 h-8 shrink-0 drop-shadow-2xs" />
              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-extrabold text-[#26332F] text-base tracking-tight block truncate">
                    SIROI
                  </span>
                  <span className="text-[10px] text-[#66736D] font-bold block truncate">
                    {role === 'caregiver' ? 'Caregiver Portal' : 'Patient Companion'}
                  </span>
                </div>
              )}
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-[#66736D] hover:text-[#26332F] hover:bg-[#F0E4D8] rounded-xl transition md:hidden cursor-pointer"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links List */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {navItems.map((item) => {
              const active = isItemActive(item.aliases);
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold
                    transition cursor-pointer text-left
                    ${
                      active
                        ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs'
                        : 'text-[#26332F] hover:bg-[#F0E4D8] hover:text-[#176B61]'
                    }
                    ${isCollapsed ? 'justify-center px-2' : ''}
                  `}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${active ? 'text-[#176B61]' : 'text-[#176B61]'}`}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Help Card & Desktop Collapse Toggle */}
        <div className="p-3 border-t border-[#E4DED4] space-y-2">
          {/* Need Help Card */}
          {!isCollapsed ? (
            <div className="p-3.5 bg-white rounded-2xl border border-[#E4DED4] shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#26332F]">
                <HelpCircle className="w-4 h-4 text-[#176B61]" />
                <span>Need Help?</span>
              </div>
              <p className="text-[11px] text-[#66736D] leading-tight">
                Ask the voice assistant or connect with care support anytime.
              </p>
              <button
                onClick={() => handleSelect('assistant')}
                className="w-full py-1.5 bg-[#DDE9D9] hover:bg-[#cde0c8] text-[#176B61] text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                Get Help
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => handleSelect('assistant')}
                className="p-2.5 bg-white hover:bg-[#DDE9D9] text-[#176B61] rounded-xl border border-[#E4DED4] shadow-xs transition cursor-pointer"
                title="Need Help? Get Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex w-full items-center justify-center gap-2 py-2 text-xs font-bold text-[#66736D] hover:text-[#26332F] hover:bg-[#F0E4D8] rounded-xl transition cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[#176B61]" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-[#176B61]" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
